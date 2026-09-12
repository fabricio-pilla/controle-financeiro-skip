import { describe, it, expect } from 'vitest'
import {
  cleanDescription,
  computeTargetDate,
  parseDateParts,
  planOccurrencesForSingleRecurring,
  planNextRecurringTransactions,
  planNextInstallmentTransactions,
  planOccurrencesForSingleInstallment,
} from './recurring-generation'
import { Transaction, Account } from '@/types/database'

describe('recurring-generation engine', () => {
  describe('cleanDescription', () => {
    it('removes installment suffix', () => {
      expect(cleanDescription('Fast Escova (32/36)')).toBe('Fast Escova')
      expect(cleanDescription('Aluguel (1/12)')).toBe('Aluguel')
      expect(cleanDescription('Notebook (Total: R$ 5.000,00)')).toBe('Notebook')
      expect(cleanDescription('Gympass')).toBe('Gympass')
    })
  })

  describe('computeTargetDate', () => {
    it('generates next month with same day', () => {
      // Setembro 2026 -> +1 mês = Outubro 2026 dia 15
      const res = computeTargetDate(2026, 9, 15, 1)
      expect(res).toBe('2026-10-15 00:00:00.000Z')
    })

    it('caps day to last day of target month (e.g. 31 in Nov or Feb)', () => {
      // +2 meses a partir de set/2026 -> nov/2026 (tem 30 dias)
      const resNov = computeTargetDate(2026, 9, 31, 2)
      expect(resNov).toBe('2026-11-30 00:00:00.000Z')

      // +5 meses a partir de set/2026 -> fev/2027 (tem 28 dias)
      const resFeb = computeTargetDate(2026, 9, 31, 5)
      expect(resFeb).toBe('2027-02-28 00:00:00.000Z')
    })

    it('rolls over year correctly for 12 months', () => {
      const res12 = computeTargetDate(2026, 9, 10, 12)
      expect(res12).toBe('2027-09-10 00:00:00.000Z')
    })
  })

  describe('planNextRecurringTransactions', () => {
    const mockSeed: Transaction = {
      id: 'tx_rec_1',
      control_id: 'ctrl_1',
      user_id: 'usr_1',
      type: 'despesa',
      amount: 150,
      description: 'Academia',
      category_id: 'cat_1',
      subcategory_id: 'sub_1',
      account_id: 'acc_1',
      date: '2026-09-10 00:00:00.000Z',
      paid: true,
      is_recurring: true,
      recurring: true,
      recurrence_type: 'mensal',
      installment_number: 1,
      installments_total: 0,
      created_at: '2026-09-10T00:00:00.000Z',
    }

    it('generates exactly 12 future occurrences starting in the NEXT month', () => {
      const candidates = planNextRecurringTransactions({
        currentMonthTransactions: [mockSeed],
        existingTransactions: [mockSeed],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
        currentYear: 2026,
        currentMonth: 9,
      })

      expect(candidates.length).toBe(12)
      // Primeiro deve ser mês seguinte (10/2026)
      expect(candidates[0].date).toBe('2026-10-10 00:00:00.000Z')
      expect(candidates[0].paid).toBe(false)
      expect(candidates[0].is_recurring).toBe(true)

      // Último deve ser mês 12 (09/2027)
      expect(candidates[11].date).toBe('2027-09-10 00:00:00.000Z')

      // Nenhum lançamento gerado para o mês atual (09/2026)
      expect(candidates.some((c) => c.date.startsWith('2026-09'))).toBe(false)
    })

    it('is idempotent and skips already existing months', () => {
      // Suponha que outubro/2026 já tenha sido gerado
      const existingOct: Transaction = {
        ...mockSeed,
        id: 'tx_rec_oct',
        date: '2026-10-10 00:00:00.000Z',
      }

      const candidates = planNextRecurringTransactions({
        currentMonthTransactions: [mockSeed],
        existingTransactions: [mockSeed, existingOct],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
        currentYear: 2026,
        currentMonth: 9,
      })

      // Deverá gerar 11 (pulando outubro/2026)
      expect(candidates.length).toBe(11)
      expect(candidates.some((c) => c.date.startsWith('2026-10'))).toBe(false)
      expect(candidates[0].date).toBe('2026-11-10 00:00:00.000Z')
    })

    it('picks recurring transactions from past and future months when allTransactions is provided', () => {
      // Transação em OUTUBRO/2026 (mês futuro em relação a setembro/2026)
      const futureSeed: Transaction = {
        ...mockSeed,
        id: 'tx_rec_oct_seed',
        description: 'Vale Alimentação',
        amount: 1444.91,
        type: 'receita',
        date: '2026-10-01 00:00:00.000Z',
      }

      // Transação em AGOSTO/2026 (mês passado em relação a setembro/2026)
      const pastSeed: Transaction = {
        ...mockSeed,
        id: 'tx_rec_past',
        description: 'Internet Fibra',
        amount: 99.9,
        date: '2026-08-05 00:00:00.000Z',
      }

      const candidates = planNextRecurringTransactions({
        allTransactions: [futureSeed, pastSeed],
        existingTransactions: [futureSeed, pastSeed],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
        currentYear: 2026,
        currentMonth: 9, // Mês atual = setembro/2026
      })

      // Deve gerar 12 ocorrências para Vale Alimentação (começando em novembro/2026)
      const vaCandidates = candidates.filter((c) => c.description === 'Vale Alimentação')
      expect(vaCandidates.length).toBe(12)
      expect(vaCandidates[0].date).toBe('2026-11-01 00:00:00.000Z')
      expect(vaCandidates[11].date).toBe('2027-10-01 00:00:00.000Z')

      // Deve gerar 12 ocorrências para Internet Fibra (começando no mês seguinte ao atual: outubro/2026)
      const internetCandidates = candidates.filter((c) => c.description === 'Internet Fibra')
      expect(internetCandidates.length).toBe(12)
      expect(internetCandidates[0].date).toBe('2026-10-05 00:00:00.000Z')
      expect(internetCandidates[11].date).toBe('2027-09-05 00:00:00.000Z')
    })
  })

  describe('planOccurrencesForSingleRecurring', () => {
    it('generates 12 future occurrences starting in the month following the transaction date', () => {
      const tx = {
        id: 'rec_va',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'receita' as const,
        amount: 1444.91,
        description: 'Vale Alimentação',
        category_id: 'cat_va',
        subcategory_id: '',
        account_id: 'acc_1',
        date: '2026-10-01 00:00:00.000Z',
        is_recurring: true,
        recurrence_type: 'mensal',
      }

      const candidates = planOccurrencesForSingleRecurring({
        sourceTransaction: tx,
        existingTransactions: [tx as any],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
      })

      expect(candidates.length).toBe(12)
      // Mês seguinte a 01/10/2026 é novembro/2026
      expect(candidates[0].date).toBe('2026-11-01 00:00:00.000Z')
      expect(candidates[0].amount).toBe(1444.91)
      expect(candidates[0].type).toBe('receita')
      expect(candidates[0].paid).toBe(false)
      expect(candidates[11].date).toBe('2027-10-01 00:00:00.000Z')
    })

    it('does not duplicate existing occurrences', () => {
      const tx = {
        id: 'rec_va',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'receita' as const,
        amount: 1444.91,
        description: 'Vale Alimentação',
        category_id: 'cat_va',
        subcategory_id: '',
        account_id: 'acc_1',
        date: '2026-10-01 00:00:00.000Z',
        is_recurring: true,
        recurrence_type: 'mensal',
      }

      const existingNov = {
        ...tx,
        id: 'rec_va_nov',
        date: '2026-11-01 00:00:00.000Z',
      }

      const candidates = planOccurrencesForSingleRecurring({
        sourceTransaction: tx,
        existingTransactions: [tx as any, existingNov as any],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
      })

      expect(candidates.length).toBe(11)
      expect(candidates.some((c) => c.date.startsWith('2026-11'))).toBe(false)
      expect(candidates[0].date).toBe('2026-12-01 00:00:00.000Z')
    })
  })

  describe('planNextInstallmentTransactions', () => {
    it('case 1: installment in current month is 7/10 -> generates 3 installments (8, 9, 10)', () => {
      const daughter7: Transaction = {
        id: 'inst_7',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 100,
        description: 'Sofá (7/10)',
        category_id: 'cat_1',
        subcategory_id: '',
        account_id: 'acc_1',
        date: '2026-09-15 00:00:00.000Z',
        paid: true,
        installment_number: 7,
        installments_total: 10,
        parent_transaction_id: 'parent_sofa',
        created_at: '2026-09-15T00:00:00.000Z',
      }

      const candidates = planNextInstallmentTransactions({
        currentMonthTransactions: [daughter7],
        allCompanyTransactions: [daughter7],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
        currentYear: 2026,
        currentMonth: 9,
      })

      expect(candidates.length).toBe(3)
      expect(candidates[0].installment_number).toBe(8)
      expect(candidates[0].installment_total).toBe(10)
      expect(candidates[0].description).toBe('Sofá (8/10)')
      expect(candidates[0].date).toBe('2026-10-15 00:00:00.000Z') // Mês seguinte!
      expect(candidates[0].paid).toBe(false)

      expect(candidates[1].installment_number).toBe(9)
      expect(candidates[1].date).toBe('2026-11-15 00:00:00.000Z')

      expect(candidates[2].installment_number).toBe(10)
      expect(candidates[2].date).toBe('2026-12-15 00:00:00.000Z')
    })

    it('case 2: installment in current month is 3/79 -> generates exactly 12 installments (4/79 to 15/79)', () => {
      const daughter3: Transaction = {
        id: 'inst_3',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 250,
        description: 'Financiamento Imóvel (3/79)',
        category_id: 'cat_hab',
        subcategory_id: '',
        account_id: 'acc_1',
        date: '2026-09-05 00:00:00.000Z',
        paid: true,
        installment_number: 3,
        installments_total: 79,
        parent_transaction_id: 'parent_fin',
        created_at: '2026-09-05T00:00:00.000Z',
      }

      const candidates = planNextInstallmentTransactions({
        currentMonthTransactions: [daughter3],
        allCompanyTransactions: [daughter3],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
        currentYear: 2026,
        currentMonth: 9,
      })

      expect(candidates.length).toBe(12)
      expect(candidates[0].installment_number).toBe(4)
      expect(candidates[0].description).toBe('Financiamento Imóvel (4/79)')
      expect(candidates[0].date).toBe('2026-10-05 00:00:00.000Z') // Começa mês seguinte

      expect(candidates[11].installment_number).toBe(15)
      expect(candidates[11].description).toBe('Financiamento Imóvel (15/79)')
      expect(candidates[11].date).toBe('2027-09-05 00:00:00.000Z')
    })

    it('case 3: series already finished in current month (e.g. 10/10) -> generates 0 installments', () => {
      const daughter10: Transaction = {
        id: 'inst_10',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 100,
        description: 'Sofá (10/10)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-09-15 00:00:00.000Z',
        paid: true,
        installment_number: 10,
        installments_total: 10,
        parent_transaction_id: 'parent_sofa',
        created_at: '2026-09-15T00:00:00.000Z',
      }

      const candidates = planNextInstallmentTransactions({
        currentMonthTransactions: [daughter10],
        allCompanyTransactions: [daughter10],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
        currentYear: 2026,
        currentMonth: 9,
      })

      expect(candidates.length).toBe(0)
    })

    it('case 4: idempotency - clicking again does not duplicate already generated installments', () => {
      const daughter7: Transaction = {
        id: 'inst_7',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 100,
        description: 'Sofá (7/10)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-09-15 00:00:00.000Z',
        paid: true,
        installment_number: 7,
        installments_total: 10,
        parent_transaction_id: 'parent_sofa',
        created_at: '2026-09-15T00:00:00.000Z',
      }

      const daughter8: Transaction = {
        id: 'inst_8',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 100,
        description: 'Sofá (8/10)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-10-15 00:00:00.000Z',
        paid: false,
        installment_number: 8,
        installments_total: 10,
        parent_transaction_id: 'parent_sofa',
        created_at: '2026-10-15T00:00:00.000Z',
      }

      const daughter9: Transaction = {
        id: 'inst_9',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 100,
        description: 'Sofá (9/10)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-11-15 00:00:00.000Z',
        paid: false,
        installment_number: 9,
        installments_total: 10,
        parent_transaction_id: 'parent_sofa',
        created_at: '2026-11-15T00:00:00.000Z',
      }

      const daughter10: Transaction = {
        id: 'inst_10',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 100,
        description: 'Sofá (10/10)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-12-15 00:00:00.000Z',
        paid: false,
        installment_number: 10,
        installments_total: 10,
        parent_transaction_id: 'parent_sofa',
        created_at: '2026-12-15T00:00:00.000Z',
      }

      // Se todas já existem no controle, não gera nenhuma nova
      const candidates = planNextInstallmentTransactions({
        currentMonthTransactions: [daughter7],
        allCompanyTransactions: [daughter7, daughter8, daughter9, daughter10],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
        currentYear: 2026,
        currentMonth: 9,
      })

      expect(candidates.length).toBe(0)
    })

    it('case 5: separates distinct series with same base description but different accounts or parent IDs', () => {
      const parentA: Transaction = {
        id: 'parent_A',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50000,
        description: 'Financiamento (Total: R$ 50.000,00)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-09-10 00:00:00.000Z',
        paid: true,
        installment_number: 0,
        installments_total: 79,
        created_at: '2026-09-10T00:00:00.000Z',
      }

      const parentB: Transaction = {
        id: 'parent_B',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 90000,
        description: 'Financiamento (Total: R$ 90.000,00)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-09-10 00:00:00.000Z',
        paid: true,
        installment_number: 0,
        installments_total: 79,
        created_at: '2026-09-10T00:00:00.000Z',
      }

      const daughterA35: Transaction = {
        id: 'inst_A_35',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 632.91,
        description: 'Financiamento (35/79)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-09-10 00:00:00.000Z',
        paid: true,
        installment_number: 35,
        installments_total: 79,
        parent_transaction_id: 'parent_A',
        created_at: '2026-09-10T00:00:00.000Z',
      }

      const daughterB4: Transaction = {
        id: 'inst_B_4',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 1139.24,
        description: 'Financiamento (4/79)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-09-10 00:00:00.000Z',
        paid: true,
        installment_number: 4,
        installments_total: 79,
        parent_transaction_id: 'parent_B',
        created_at: '2026-09-10T00:00:00.000Z',
      }

      const candidates = planNextInstallmentTransactions({
        currentMonthTransactions: [daughterA35, daughterB4],
        allCompanyTransactions: [parentA, parentB, daughterA35, daughterB4],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
        currentYear: 2026,
        currentMonth: 9,
      })

      // Série A: 35/79 -> gera 36..47 (12 parcelas) no mês seguinte (10/2026..09/2027)
      // Série B: 4/79 -> gera 5..16 (12 parcelas) no mês seguinte (10/2026..09/2027)
      const candA = candidates.filter((c) => c.parent_transaction_id === 'parent_A')
      const candB = candidates.filter((c) => c.parent_transaction_id === 'parent_B')

      expect(candA.length).toBe(12)
      expect(candA[0].installment_number).toBe(36)
      expect(candA[0].date).toBe('2026-10-10 00:00:00.000Z')
      expect(candA[11].installment_number).toBe(47)
      expect(candA[11].date).toBe('2027-09-10 00:00:00.000Z')

      expect(candB.length).toBe(12)
      expect(candB[0].installment_number).toBe(5)
      expect(candB[0].date).toBe('2026-10-10 00:00:00.000Z')
      expect(candB[11].installment_number).toBe(16)
      expect(candB[11].date).toBe('2027-09-10 00:00:00.000Z')
    })
  })

  describe('planOccurrencesForSingleInstallment', () => {
    it('generates the remaining 5 installments when saving 31/36 (32..36)', () => {
      const tx31: Transaction = {
        id: 'tx_parcela_31',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 250,
        description: 'Curso Especialização (31/36)',
        category_id: 'cat_educacao',
        subcategory_id: 'sub_pos',
        account_id: 'acc_corrente',
        date: '2026-03-15 00:00:00.000Z',
        payment_date: '2026-03-15',
        paid: true,
        installment_number: 31,
        installments_total: 36,
        parent_transaction_id: 'parent_curso_123',
        created_at: '2026-03-15T00:00:00.000Z',
      }

      const candidates = planOccurrencesForSingleInstallment({
        sourceTransaction: tx31,
        existingTransactions: [tx31],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
      })

      expect(candidates.length).toBe(5)
      // 32/36
      expect(candidates[0].installment_number).toBe(32)
      expect(candidates[0].installment_total).toBe(36)
      expect(candidates[0].description).toBe('Curso Especialização (32/36)')
      expect(candidates[0].date).toBe('2026-04-15 00:00:00.000Z')
      expect(candidates[0].paid).toBe(false)
      expect(candidates[0].parent_transaction_id).toBe('parent_curso_123')
      expect(candidates[0].account_id).toBe('acc_corrente')
      expect(candidates[0].category_id).toBe('cat_educacao')
      expect(candidates[0].subcategory_id).toBe('sub_pos')

      // 33/36
      expect(candidates[1].installment_number).toBe(33)
      expect(candidates[1].date).toBe('2026-05-15 00:00:00.000Z')

      // 34/36
      expect(candidates[2].installment_number).toBe(34)
      expect(candidates[2].date).toBe('2026-06-15 00:00:00.000Z')

      // 35/36
      expect(candidates[3].installment_number).toBe(35)
      expect(candidates[3].date).toBe('2026-07-15 00:00:00.000Z')

      // 36/36 (última)
      expect(candidates[4].installment_number).toBe(36)
      expect(candidates[4].description).toBe('Curso Especialização (36/36)')
      expect(candidates[4].date).toBe('2026-08-15 00:00:00.000Z')
    })

    it('returns empty array if the series is already complete (e.g. 36/36)', () => {
      const tx36: Transaction = {
        id: 'tx_parcela_36',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 250,
        description: 'Curso Especialização (36/36)',
        category_id: 'cat_educacao',
        account_id: 'acc_corrente',
        date: '2026-08-15 00:00:00.000Z',
        paid: false,
        installment_number: 36,
        installments_total: 36,
        parent_transaction_id: 'parent_curso_123',
        created_at: '2026-08-15T00:00:00.000Z',
      }

      const candidates = planOccurrencesForSingleInstallment({
        sourceTransaction: tx36,
        existingTransactions: [tx36],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
      })

      expect(candidates.length).toBe(0)
    })

    it('returns empty array if transaction is not installment (installment_total <= 1)', () => {
      const txSingle: Transaction = {
        id: 'tx_single',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 250,
        description: 'Mercado',
        category_id: 'cat_mercado',
        account_id: 'acc_corrente',
        date: '2026-03-15 00:00:00.000Z',
        paid: true,
        installment_number: 1,
        installments_total: 1,
        created_at: '2026-03-15T00:00:00.000Z',
      }

      const candidates = planOccurrencesForSingleInstallment({
        sourceTransaction: txSingle,
        existingTransactions: [txSingle],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
      })

      expect(candidates.length).toBe(0)
    })

    it('is strictly idempotent: does not duplicate already existing installments', () => {
      const tx31: Transaction = {
        id: 'tx_parcela_31',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 250,
        description: 'Curso Especialização (31/36)',
        category_id: 'cat_educacao',
        account_id: 'acc_corrente',
        date: '2026-03-15 00:00:00.000Z',
        paid: true,
        installment_number: 31,
        installments_total: 36,
        parent_transaction_id: 'parent_curso_123',
        created_at: '2026-03-15T00:00:00.000Z',
      }

      const tx32Existing: Transaction = {
        id: 'tx_parcela_32_existente',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 250,
        description: 'Curso Especialização (32/36)',
        category_id: 'cat_educacao',
        account_id: 'acc_corrente',
        date: '2026-04-15 00:00:00.000Z',
        paid: false,
        installment_number: 32,
        installments_total: 36,
        parent_transaction_id: 'parent_curso_123',
        created_at: '2026-04-15T00:00:00.000Z',
      }

      const candidates = planOccurrencesForSingleInstallment({
        sourceTransaction: tx31,
        existingTransactions: [tx31, tx32Existing],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
      })

      // Deverá gerar apenas 33, 34, 35, 36 (4 parcelas, pulando 32)
      expect(candidates.length).toBe(4)
      expect(candidates[0].installment_number).toBe(33)
      expect(candidates.some((c) => c.installment_number === 32)).toBe(false)
    })

    it('does not confuse distinct series with identical description (homonymous series)', () => {
      // Duas séries homônimas "Financiamento (X/79)" vinculadas a pais distintos
      const parentAlpha = 'parent_alpha_uuid'
      const parentBeta = 'parent_beta_uuid'

      const txAlpha31: Transaction = {
        id: 'tx_alpha_31',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 600,
        description: 'Financiamento Imóvel (31/79)',
        category_id: 'cat_hab',
        account_id: 'acc_alpha',
        date: '2026-03-10 00:00:00.000Z',
        paid: true,
        installment_number: 31,
        installments_total: 79,
        parent_transaction_id: parentAlpha,
        created_at: '2026-03-10T00:00:00.000Z',
      }

      // Parcela 32 que pertence à outra série Beta
      const txBeta32: Transaction = {
        id: 'tx_beta_32',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 900,
        description: 'Financiamento Imóvel (32/79)',
        category_id: 'cat_hab',
        account_id: 'acc_beta',
        date: '2026-04-10 00:00:00.000Z',
        paid: false,
        installment_number: 32,
        installments_total: 79,
        parent_transaction_id: parentBeta,
        created_at: '2026-04-10T00:00:00.000Z',
      }

      const candidates = planOccurrencesForSingleInstallment({
        sourceTransaction: txAlpha31,
        existingTransactions: [txAlpha31, txBeta32],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
      })

      // Não pode achar que a parcela 32 da série Alpha já existe só porque a Beta 32 existe!
      expect(candidates[0].installment_number).toBe(32)
      expect(candidates[0].parent_transaction_id).toBe(parentAlpha)
      expect(candidates[0].account_id).toBe('acc_alpha')
      expect(candidates[0].amount).toBe(600)
    })

    it('applies credit card closing and due date calculation for payment_date', () => {
      // Cartão com fechamento dia 10 e vencimento dia 20
      const creditCard: Account = {
        id: 'acc_card_nubank',
        control_id: 'ctrl_1',
        name: 'Cartão Nubank',
        type: 'credito',
        balance: 0,
        closing_day: 10,
        due_day: 20,
        color: '#820AD1',
        is_primary: false,
        created_at: '2026-01-01T00:00:00.000Z',
      }

      // Parcela 31/36 comprada no dia 15 (após fechamento dia 10 -> fatura fecha no mês seguinte e vence dia 20)
      const txCard31: Transaction = {
        id: 'tx_card_31',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 150,
        description: 'Notebook Dell (31/36)',
        category_id: 'cat_ti',
        account_id: 'acc_card_nubank',
        date: '2026-03-15 00:00:00.000Z',
        paid: true,
        installment_number: 31,
        installments_total: 36,
        parent_transaction_id: 'parent_dell',
        created_at: '2026-03-15T00:00:00.000Z',
      }

      const candidates = planOccurrencesForSingleInstallment({
        sourceTransaction: txCard31,
        existingTransactions: [txCard31],
        accounts: [creditCard],
        currentCompanyId: 'ctrl_1',
        currentUserId: 'usr_1',
      })

      expect(candidates.length).toBe(5)
      // Parcela 32 tem data de compra 2026-04-15 (dia 15 >= closing 10 -> vencimento em maio/2026 dia 20)
      expect(candidates[0].date).toBe('2026-04-15 00:00:00.000Z')
      expect(candidates[0].payment_date).toBe('2026-05-20')

      // Parcela 33 tem data de compra 2026-05-15 -> vencimento em junho/2026 dia 20
      expect(candidates[1].date).toBe('2026-05-15 00:00:00.000Z')
      expect(candidates[1].payment_date).toBe('2026-06-20')
    })
  })
})
