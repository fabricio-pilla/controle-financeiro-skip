import { describe, it, expect, vi } from 'vitest'
import {
  findRecurringSeries,
  findInstallmentGroup,
  resolvePropagationTargets,
  deleteTransactionWithPropagation,
  updateTransactionWithPropagation,
  UpdateTransactionPayload,
} from './transaction-propagation'
import { Transaction } from '@/types/database'

// Mock pocketbase
vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: vi.fn(() => ({
      update: vi
        .fn()
        .mockImplementation((id: string, data: any) => Promise.resolve({ id, ...data })),
      create: vi
        .fn()
        .mockImplementation((data: any) =>
          Promise.resolve({ id: `new_${Math.random().toString(36).substring(2, 7)}`, ...data }),
        ),
      delete: vi.fn().mockResolvedValue(true),
    })),
  },
}))

describe('transaction-propagation', () => {
  describe('findRecurringSeries', () => {
    it('finds recurring series matching clean description even if value differs', () => {
      const tx1: Transaction = {
        id: 'rec_1',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Netflix Mensal',
        category_id: 'cat_streaming',
        account_id: 'acc_1',
        date: '2026-01-10 00:00:00.000Z',
        paid: true,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-10T00:00:00.000Z',
      }
      const tx2: Transaction = {
        id: 'rec_2',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Netflix Mensal',
        category_id: 'cat_streaming',
        account_id: 'acc_1',
        date: '2026-02-10 00:00:00.000Z',
        paid: false,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-10T00:00:00.000Z',
      }
      const tx3: Transaction = {
        id: 'rec_3',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Netflix Mensal',
        category_id: 'cat_streaming',
        account_id: 'acc_1',
        date: '2026-03-10 00:00:00.000Z',
        paid: false,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-10T00:00:00.000Z',
      }

      const series = findRecurringSeries(tx2, [tx1, tx2, tx3])
      expect(series.length).toBe(3)
      expect(series.map((t) => t.id)).toEqual(['rec_1', 'rec_2', 'rec_3'])
    })

    it('does NOT confuse installment transactions with recurring series', () => {
      const recTx: Transaction = {
        id: 'rec_1',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 100,
        description: 'Celular',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-01-10 00:00:00.000Z',
        paid: true,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-10T00:00:00.000Z',
      }
      const instTx: Transaction = {
        id: 'inst_1',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 100,
        description: 'Celular (1/10)',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-01-10 00:00:00.000Z',
        paid: true,
        installment_number: 1,
        installments_total: 10,
        created_at: '2026-01-10T00:00:00.000Z',
      }

      const series = findRecurringSeries(recTx, [recTx, instTx])
      expect(series.length).toBe(1)
      expect(series[0].id).toBe('rec_1')
    })
  })

  describe('updateTransactionWithPropagation for recurring series', () => {
    it('updates current and future occurrences without creating new rows when choice is "future"', async () => {
      const tx1: Transaction = {
        id: 'rec_1',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Netflix',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-01-15 00:00:00.000Z',
        paid: true,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-15T00:00:00.000Z',
      }
      const tx2: Transaction = {
        id: 'rec_2',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Netflix',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-02-15 00:00:00.000Z',
        paid: false,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-15T00:00:00.000Z',
      }
      const tx3: Transaction = {
        id: 'rec_3',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Netflix',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-03-15 00:00:00.000Z',
        paid: false,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-15T00:00:00.000Z',
      }

      const all = [tx1, tx2, tx3]
      const formData: UpdateTransactionPayload = {
        type: 'despesa',
        amount: 60, // novo valor
        description: 'Netflix 4K',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-02-15 00:00:00.000Z',
        is_recurring: true,
        recurrence_type: 'mensal',
      }

      const result = await updateTransactionWithPropagation({
        transaction: tx2,
        allTransactions: all,
        formData,
        choice: 'future',
      })

      // Atualizou tx2 e tx3, não mexeu em tx1 (passado)
      expect(result.created.length).toBe(0)
      expect(result.updated.length).toBe(2)
      expect(result.updated.map((u) => u.id)).toEqual(['rec_2', 'rec_3'])
      expect(result.updated.every((u) => u.amount === 60)).toBe(true)
      expect(result.updated.every((u) => u.description === 'Netflix 4K')).toBe(true)
    })

    it('updates ALL occurrences (past and future) when choice is "all"', async () => {
      const tx1: Transaction = {
        id: 'rec_1',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Academia',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-01-10 00:00:00.000Z',
        paid: true,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-10T00:00:00.000Z',
      }
      const tx2: Transaction = {
        id: 'rec_2',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Academia',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-02-10 00:00:00.000Z',
        paid: false,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-10T00:00:00.000Z',
      }

      const all = [tx1, tx2]
      const result = await updateTransactionWithPropagation({
        transaction: tx2,
        allTransactions: all,
        formData: {
          type: 'despesa',
          amount: 80,
          description: 'Academia',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-02-10 00:00:00.000Z',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'all',
      })

      expect(result.created.length).toBe(0)
      expect(result.updated.length).toBe(2)
      expect(result.updated.every((u) => u.amount === 80)).toBe(true)
    })

    it('updates "este e os próximos" of a 12-month recurring series without creating duplicates and preserving month dates', async () => {
      // 12 monthly occurrences: 2026-01-10 to 2026-12-10
      const recurringList: Transaction[] = []
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0')
        recurringList.push({
          id: `rec_aluguel_${mm}`,
          control_id: 'ctrl_1',
          user_id: 'usr_1',
          type: 'despesa',
          amount: 1200,
          description: 'Aluguel Apartamento',
          category_id: 'cat_moradia',
          account_id: 'acc_1',
          date: `2026-${mm}-10`,
          payment_date: `2026-${mm}-10`,
          paid: m < 4,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01T00:00:00.000Z',
        })
      }

      // User selects month 4 (April) and updates amount from 1200 to 1400 and day from 10 to 15
      const targetTx = recurringList[3] // 2026-04-10
      const result = await updateTransactionWithPropagation({
        transaction: targetTx,
        allTransactions: recurringList,
        formData: {
          type: 'despesa',
          amount: 1400,
          description: 'Aluguel Apartamento',
          category_id: 'cat_moradia',
          account_id: 'acc_1',
          date: '2026-04-15',
          payment_date: '2026-04-15',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'future',
      })

      // Zero new transactions created!
      expect(result.created.length).toBe(0)
      // Exactly 9 transactions updated (months 04 to 12)
      expect(result.updated.length).toBe(9)
      expect(result.updated.every((u) => u.amount === 1400)).toBe(true)

      // Check dates: month 04 is 2026-04-15, month 05 is 2026-05-15, ..., month 12 is 2026-12-15
      const updatedDates = result.updated.map((u) => u.date)
      expect(updatedDates).toEqual([
        '2026-04-15',
        '2026-05-15',
        '2026-06-15',
        '2026-07-15',
        '2026-08-15',
        '2026-09-15',
        '2026-10-15',
        '2026-11-15',
        '2026-12-15',
      ])

      // Each month must appear only once, never multiple in the same month
      const months = updatedDates.map((d) => d.substring(0, 7))
      const uniqueMonths = new Set(months)
      expect(uniqueMonths.size).toBe(9)
    })

    it('creates missing future months when window of 12 is incomplete, never duplicating an existing month', async () => {
      // Only 3 occurrences exist: 2026-01-10, 2026-02-10, 2026-03-10
      const partialList: Transaction[] = [
        {
          id: 'rec_acad_01',
          control_id: 'ctrl_1',
          user_id: 'usr_1',
          type: 'despesa',
          amount: 100,
          description: 'Academia',
          category_id: 'cat_saude',
          account_id: 'acc_1',
          date: '2026-01-10',
          paid: true,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'rec_acad_02',
          control_id: 'ctrl_1',
          user_id: 'usr_1',
          type: 'despesa',
          amount: 100,
          description: 'Academia',
          category_id: 'cat_saude',
          account_id: 'acc_1',
          date: '2026-02-10',
          paid: true,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'rec_acad_03',
          control_id: 'ctrl_1',
          user_id: 'usr_1',
          type: 'despesa',
          amount: 100,
          description: 'Academia',
          category_id: 'cat_saude',
          account_id: 'acc_1',
          date: '2026-03-10',
          paid: false,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]

      // Edit month 03 with 'future': updates month 03 and fills up to 12 months ahead (months 04..12)
      const result = await updateTransactionWithPropagation({
        transaction: partialList[2],
        allTransactions: partialList,
        formData: {
          type: 'despesa',
          amount: 120,
          description: 'Academia',
          category_id: 'cat_saude',
          account_id: 'acc_1',
          date: '2026-03-10',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'future',
      })

      // Updates month 03
      expect(result.updated.length).toBe(1)
      expect(result.updated[0].id).toBe('rec_acad_03')
      expect(result.updated[0].amount).toBe(120)

      // Creates months 04 to 12 (9 months)
      expect(result.created.length).toBe(9)
      const createdMonths = result.created.map((c) => c.date.substring(0, 7))
      const uniqueCreatedMonths = new Set(createdMonths)
      // Exactly 1 per month, no duplicates in any month
      expect(uniqueCreatedMonths.size).toBe(9)
      expect(createdMonths).not.toContain('2026-01')
      expect(createdMonths).not.toContain('2026-02')
      expect(createdMonths).not.toContain('2026-03')
    })

    it('updates ONLY the selected transaction when choice is "single"', async () => {
      const tx1: Transaction = {
        id: 'rec_1',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Internet',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-01-10 00:00:00.000Z',
        paid: true,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-10T00:00:00.000Z',
      }
      const tx2: Transaction = {
        id: 'rec_2',
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 50,
        description: 'Internet',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-02-10 00:00:00.000Z',
        paid: false,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-01-10T00:00:00.000Z',
      }

      const all = [tx1, tx2]
      const result = await updateTransactionWithPropagation({
        transaction: tx2,
        allTransactions: all,
        formData: {
          type: 'despesa',
          amount: 75,
          description: 'Internet',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-02-10 00:00:00.000Z',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'single',
      })

      expect(result.created.length).toBe(0)
      expect(result.updated.length).toBe(1)
      expect(result.updated[0].id).toBe('rec_2')
      expect(result.updated[0].amount).toBe(75)
    })
  })

  describe('deleteTransactionWithPropagation', () => {
    it('deletes "esse e os próximos" of a 12-month recurring series (removes future, keeps past)', async () => {
      // 12 monthly occurrences: months 01 to 12
      const recurringList: Transaction[] = []
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0')
        recurringList.push({
          id: `rec_netflix_${mm}`,
          control_id: 'ctrl_1',
          user_id: 'usr_1',
          type: 'despesa',
          amount: 55.9,
          description: 'Netflix Mensal',
          category_id: 'cat_streaming',
          account_id: 'acc_nubank',
          date: `2026-${mm}-15`,
          paid: m < 4,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: `2026-01-01T00:00:00.000Z`,
        })
      }

      // User selects month 04 (April) and chooses "Esse e os próximos" ('future')
      const targetTx = recurringList[3] // month 04 (2026-04-15)
      expect(targetTx.id).toBe('rec_netflix_04')

      const targets = resolvePropagationTargets({
        transaction: targetTx,
        allTransactions: recurringList,
        choice: 'future',
      })

      // Must delete months 04 to 12 (9 occurrences)
      expect(targets.length).toBe(9)
      const targetIds = targets.map((t) => t.id)
      expect(targetIds).toEqual([
        'rec_netflix_04',
        'rec_netflix_05',
        'rec_netflix_06',
        'rec_netflix_07',
        'rec_netflix_08',
        'rec_netflix_09',
        'rec_netflix_10',
        'rec_netflix_11',
        'rec_netflix_12',
      ])

      // Past occurrences (01, 02, 03) must NOT be targeted
      expect(targetIds).not.toContain('rec_netflix_01')
      expect(targetIds).not.toContain('rec_netflix_02')
      expect(targetIds).not.toContain('rec_netflix_03')

      // Now test the actual delete call
      const { deletedIds } = await deleteTransactionWithPropagation({
        transaction: targetTx,
        allTransactions: recurringList,
        choice: 'future',
      })

      expect(deletedIds.length).toBe(9)
      expect(deletedIds).toEqual(targetIds)
    })

    it('deletes "todos" of an installment series with 6 installments + consolidated parent record', async () => {
      const parentId = 'parent_inst_geladeira'
      const parentTx: Transaction = {
        id: parentId,
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 3000,
        description: 'Geladeira Frost Free',
        category_id: 'cat_eletro',
        account_id: 'acc_itau',
        date: '2026-01-10',
        paid: false,
        installment_number: 0,
        installments_total: 6,
        installment_total: 6,
        created_at: '2026-01-10T00:00:00.000Z',
      }

      const daughters: Transaction[] = []
      for (let i = 1; i <= 6; i++) {
        const mm = String(i).padStart(2, '0')
        daughters.push({
          id: `inst_geladeira_part_${i}`,
          control_id: 'ctrl_1',
          user_id: 'usr_1',
          type: 'despesa',
          amount: 500,
          description: `Geladeira Frost Free (${i}/6)`,
          category_id: 'cat_eletro',
          account_id: 'acc_itau',
          date: `2026-${mm}-10`,
          paid: i <= 2,
          installment_number: i,
          installments_total: 6,
          installment_total: 6,
          parent_transaction_id: parentId,
          created_at: '2026-01-10T00:00:00.000Z',
        })
      }

      const allTransactions = [parentTx, ...daughters]

      // Clicks on installment 3 (or any installment) and chooses "Todos os registros" ('all')
      const clickedDaughter = daughters[2] // installment 3/6
      const targets = resolvePropagationTargets({
        transaction: clickedDaughter,
        allTransactions,
        choice: 'all',
      })

      // Must delete all 6 installments AND the consolidated parent record (total: 7)
      expect(targets.length).toBe(7)
      const targetIds = targets.map((t) => t.id)
      expect(targetIds).toContain(parentId)
      for (let i = 1; i <= 6; i++) {
        expect(targetIds).toContain(`inst_geladeira_part_${i}`)
      }

      // Execute delete
      const { deletedIds } = await deleteTransactionWithPropagation({
        transaction: clickedDaughter,
        allTransactions,
        choice: 'all',
      })

      expect(deletedIds.length).toBe(7)
      expect(deletedIds).toContain(parentId)
      expect(deletedIds).toContain('inst_geladeira_part_1')
      expect(deletedIds).toContain('inst_geladeira_part_6')
    })

    it('deletes ONLY single record when choice is "single" even if installment or recurring', async () => {
      const parentId = 'parent_inst_celular'
      const parentTx: Transaction = {
        id: parentId,
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 2000,
        description: 'Smartphone',
        category_id: 'cat_eletronicos',
        account_id: 'acc_itau',
        date: '2026-01-05',
        installment_number: 0,
        installments_total: 4,
        installment_total: 4,
        created_at: '2026-01-05T00:00:00.000Z',
      }
      const daughters: Transaction[] = [1, 2, 3, 4].map((i) => ({
        id: `inst_cel_${i}`,
        control_id: 'ctrl_1',
        user_id: 'usr_1',
        type: 'despesa',
        amount: 500,
        description: `Smartphone (${i}/4)`,
        category_id: 'cat_eletronicos',
        account_id: 'acc_itau',
        date: `2026-0${i}-05`,
        installment_number: i,
        installments_total: 4,
        installment_total: 4,
        parent_transaction_id: parentId,
        created_at: '2026-01-05T00:00:00.000Z',
      }))

      const all = [parentTx, ...daughters]

      const targets = resolvePropagationTargets({
        transaction: daughters[1], // installment 2
        allTransactions: all,
        choice: 'single',
      })

      expect(targets.length).toBe(1)
      expect(targets[0].id).toBe('inst_cel_2')

      const { deletedIds } = await deleteTransactionWithPropagation({
        transaction: daughters[1],
        allTransactions: all,
        choice: 'single',
      })

      expect(deletedIds).toEqual(['inst_cel_2'])
    })
  })

  // =========================================================================
  // CENÁRIOS ESPECÍFICOS DO BUG: EDIÇÃO RECORRENTE E BLINDAGEM DE MESES
  // =========================================================================
  describe('Cenários específicos de edição recorrente e blindagem', () => {
    it('Edição recorrente com "Este e os próximos" quando todos os futuros existem -> 0 criadas, apenas atualizadas', async () => {
      // 12 meses existentes para uma série recorrente (ex: 2026-01 a 2026-12)
      const fullSeries: Transaction[] = []
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, '0')
        fullSeries.push({
          id: `tx_rec_${mm}`,
          control_id: 'y9ewjfbhzoihnq0',
          user_id: 'u1',
          type: 'despesa',
          amount: 840,
          description: 'Sem descrição',
          category_id: 'cat_1',
          account_id: '4xftudvb9g7gnfy',
          date: `2026-${mm}-07 00:00:00.000Z`,
          payment_date: `2026-${mm}-07 00:00:00.000Z`,
          paid: false,
          is_recurring: true,
          recurring: true,
          recurrence_type: 'mensal',
          installment_number: 1,
          installment_total: 0,
          created_at: '2026-01-01T00:00:00.000Z',
        })
      }

      // Edita a transação de setembro (mês 9) com "future"
      const septTx = fullSeries[8] // 2026-09-07
      expect(septTx.id).toBe('tx_rec_09')

      const result = await updateTransactionWithPropagation({
        transaction: septTx,
        allTransactions: fullSeries,
        formData: {
          description: 'Sem descrição',
          amount: 900, // alterou valor
          type: 'despesa',
          account_id: '4xftudvb9g7gnfy',
          category_id: 'cat_1',
          date: '2026-09-07 00:00:00.000Z',
          payment_date: '2026-09-07 00:00:00.000Z',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'future',
      })

      // EXATAMENTE 0 criadas, apenas atualizadas
      expect(result.created.length).toBe(0)
      // Meses 09, 10, 11, 12 atualizados (4 transações)
      expect(result.updated.length).toBe(4)
      expect(result.updated.map((t) => t.id)).toEqual([
        'tx_rec_09',
        'tx_rec_10',
        'tx_rec_11',
        'tx_rec_12',
      ])
      expect(result.updated.every((t) => t.amount === 900)).toBe(true)
    })

    it('Quando falta algum mês futuro -> cria SOMENTE nos meses futuros faltantes, NUNCA no mês atual', async () => {
      // Cenário: temos meses 09, 10 e 12 (falta o mês 11 e faltam os meses além de 12)
      const existingList: Transaction[] = [
        {
          id: 'tx_rec_09',
          control_id: 'y9ewjfbhzoihnq0',
          user_id: 'u1',
          type: 'despesa',
          amount: 840,
          description: 'Sem descrição',
          category_id: 'cat_1',
          account_id: '4xftudvb9g7gnfy',
          date: '2026-09-07 00:00:00.000Z',
          payment_date: '2026-09-07 00:00:00.000Z',
          paid: false,
          is_recurring: true,
          recurring: true,
          recurrence_type: 'mensal',
          installment_number: 1,
          installment_total: 0,
          created_at: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 'tx_rec_10',
          control_id: 'y9ewjfbhzoihnq0',
          user_id: 'u1',
          type: 'despesa',
          amount: 840,
          description: 'Sem descrição',
          category_id: 'cat_1',
          account_id: '4xftudvb9g7gnfy',
          date: '2026-10-07 00:00:00.000Z',
          payment_date: '2026-10-07 00:00:00.000Z',
          paid: false,
          is_recurring: true,
          recurring: true,
          recurrence_type: 'mensal',
          installment_number: 1,
          installment_total: 0,
          created_at: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 'tx_rec_12',
          control_id: 'y9ewjfbhzoihnq0',
          user_id: 'u1',
          type: 'despesa',
          amount: 840,
          description: 'Sem descrição',
          category_id: 'cat_1',
          account_id: '4xftudvb9g7gnfy',
          date: '2026-12-07 00:00:00.000Z',
          payment_date: '2026-12-07 00:00:00.000Z',
          paid: false,
          is_recurring: true,
          recurring: true,
          recurrence_type: 'mensal',
          installment_number: 1,
          installment_total: 0,
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ]

      const septTx = existingList[0] // 2026-09-07

      const result = await updateTransactionWithPropagation({
        transaction: septTx,
        allTransactions: existingList,
        formData: {
          description: 'Sem descrição',
          amount: 850,
          type: 'despesa',
          account_id: '4xftudvb9g7gnfy',
          category_id: 'cat_1',
          date: '2026-09-07 00:00:00.000Z',
          payment_date: '2026-09-07 00:00:00.000Z',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'future',
      })

      // Transações existentes atualizadas: 09, 10, 12
      expect(result.updated.map((t) => t.id)).toEqual(['tx_rec_09', 'tx_rec_10', 'tx_rec_12'])

      // Criadas: deve conter mês 11 (2026-11) e os seguintes até completar a janela de 12 meses
      // MAS NUNCA no mês atual (2026-09) nem anterior
      const createdMonths = result.created.map((c) => c.date.substring(0, 7))
      expect(createdMonths).not.toContain('2026-09') // NUNCA no mês atual
      expect(createdMonths).not.toContain('2026-08') // NUNCA anterior
      expect(createdMonths).not.toContain('2026-10') // Já existia
      expect(createdMonths).not.toContain('2026-12') // Já existia
      expect(createdMonths).toContain('2026-11') // Mês futuro faltante criado!

      // Todas as criadas devem ter targetYM > '2026-09'
      for (const ym of createdMonths) {
        expect(ym > '2026-09').toBe(true)
      }
    })

    it('Se já existir registro com mesmo tipo + conta + cleanDesc + ano-mês no controle (fora da série filtrada), atualiza em vez de criar', async () => {
      // Registro na mesma conta, mesmo tipo, mesma descrição e mesmo ano-mês (ex: 2026-10),
      // mas que não estava marcado como recorrente antes ou com ID separado
      const targetTx: Transaction = {
        id: 'tx_rec_base',
        control_id: 'ctrl_dup_check',
        user_id: 'u1',
        type: 'despesa',
        amount: 300,
        description: 'Internet Fibra',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-09-10 00:00:00.000Z',
        paid: false,
        is_recurring: true,
        recurrence_type: 'mensal',
        created_at: '2026-09-01T00:00:00.000Z',
      }

      const existingInControlNotInSeries: Transaction = {
        id: 'tx_other_in_control',
        control_id: 'ctrl_dup_check',
        user_id: 'u1',
        type: 'despesa',
        amount: 300,
        description: 'Internet Fibra',
        category_id: 'cat_1',
        account_id: 'acc_1',
        date: '2026-10-10 00:00:00.000Z',
        paid: false,
        is_recurring: false, // não estava na série filtrada
        created_at: '2026-09-01T00:00:00.000Z',
      }

      const result = await updateTransactionWithPropagation({
        transaction: targetTx,
        allTransactions: [targetTx, existingInControlNotInSeries],
        formData: {
          description: 'Internet Fibra',
          amount: 350,
          type: 'despesa',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-09-10 00:00:00.000Z',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'future',
      })

      // O registro em 2026-10 foi atualizado em vez de criar uma duplicata naquele mês!
      expect(result.updated.some((u) => u.id === 'tx_other_in_control')).toBe(true)
      const createdMonths = result.created.map((c) => c.date.substring(0, 7))
      expect(createdMonths).not.toContain('2026-09')
      expect(createdMonths).not.toContain('2026-10')
    })

    it('"Todos" -> 0 criações', async () => {
      const series: Transaction[] = [
        {
          id: 'rec_t1',
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 100,
          description: 'Academia',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-01-10',
          paid: true,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01',
        },
        {
          id: 'rec_t2',
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 100,
          description: 'Academia',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-02-10',
          paid: false,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01',
        },
      ]

      const result = await updateTransactionWithPropagation({
        transaction: series[0],
        allTransactions: series,
        formData: {
          description: 'Academia Nova',
          amount: 120,
          type: 'despesa',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-01-10',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'all',
      })

      // Regra: "Todos" -> 0 criações
      expect(result.created.length).toBe(0)
      expect(result.updated.length).toBe(2)
      expect(result.updated.every((u) => u.description === 'Academia Nova')).toBe(true)
    })

    it('"Somente esse" -> só o registro alvo é tocado', async () => {
      const series: Transaction[] = [
        {
          id: 'rec_s1',
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50,
          description: 'Serviço Streaming',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-01-15',
          paid: true,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01',
        },
        {
          id: 'rec_s2',
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50,
          description: 'Serviço Streaming',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-02-15',
          paid: false,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01',
        },
      ]

      const result = await updateTransactionWithPropagation({
        transaction: series[1],
        allTransactions: series,
        formData: {
          description: 'Serviço Streaming VIP',
          amount: 80,
          type: 'despesa',
          category_id: 'cat_1',
          account_id: 'acc_1',
          date: '2026-02-15',
          is_recurring: true,
          recurrence_type: 'mensal',
        },
        choice: 'single',
      })

      // Só o registro alvo é tocado
      expect(result.created.length).toBe(0)
      expect(result.updated.length).toBe(1)
      expect(result.updated[0].id).toBe('rec_s2')
      expect(result.updated[0].description).toBe('Serviço Streaming VIP')
      expect(result.updated[0].amount).toBe(80)
    })
  })

  // =========================================================================
  // AUDITORIA DAS 6 REGRAS EXPLÍCITAS DEFINIDAS PELO USUÁRIO
  // =========================================================================
  describe('Auditoria das 6 Regras Explícitas de Propagação', () => {
    // -----------------------------------------------------------------------
    // REGRA 1: Atualizar "Todos"
    // Atualizar TODOS os lançamentos referentes ao mexido, SOMENTE isso.
    // Não criar novos lançamentos — exceto se aumentou parcelas (criar extras).
    // Só excluir parcelas se diminuiu parcelas (excluir excedentes).
    // -----------------------------------------------------------------------
    describe('Regra 1: Atualização "Todos"', () => {
      it('1a: Atualiza todos os lançamentos recorrentes sem criar novos', async () => {
        const series: Transaction[] = [
          {
            id: 'rec_s1_01',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 50,
            description: 'Spotify',
            category_id: 'cat_m',
            account_id: 'acc_1',
            date: '2026-01-10',
            paid: true,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
          {
            id: 'rec_s1_02',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 50,
            description: 'Spotify',
            category_id: 'cat_m',
            account_id: 'acc_1',
            date: '2026-02-10',
            paid: false,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
          {
            id: 'rec_s1_03',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 50,
            description: 'Spotify',
            category_id: 'cat_m',
            account_id: 'acc_1',
            date: '2026-03-10',
            paid: false,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
        ]

        // Editar parcela 2 com "all"
        const result = await updateTransactionWithPropagation({
          transaction: series[1],
          allTransactions: series,
          formData: {
            description: 'Spotify Premium Família',
            amount: 60,
            type: 'despesa',
            account_id: 'acc_1',
            category_id: 'cat_m',
            date: '2026-02-12', // mudou dia de 10 para 12
            is_recurring: true,
            recurrence_type: 'mensal',
          },
          choice: 'all',
        })

        // Atualizou TODOS os 3
        expect(result.updated.length).toBe(3)
        expect(result.updated.every((t) => t.amount === 60)).toBe(true)
        expect(result.updated.every((t) => t.description === 'Spotify Premium Família')).toBe(true)
        // NÃO criou novos lançamentos
        expect(result.created.length).toBe(0)
        // NÃO excluiu lançamentos
        expect(result.deletedIds.length).toBe(0)
      })

      it('1b: Atualiza parcelas com "all" sem alterar total (não cria nada, não exclui nada)', async () => {
        const parentId = 'p_compra_tv'
        const parentTx: Transaction = {
          id: parentId,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 1500,
          description: 'Smart TV',
          category_id: 'cat_eletr',
          account_id: 'acc_1',
          date: '2026-01-10',
          paid: false,
          installment_number: 0,
          installments_total: 3,
          created_at: '2026-01-01',
        }
        const parcels: Transaction[] = [1, 2, 3].map((n) => ({
          id: `tv_part_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 500,
          description: `Smart TV (${n}/3)`,
          category_id: 'cat_eletr',
          account_id: 'acc_1',
          date: `2026-0${n}-10`,
          paid: n === 1,
          installment_number: n,
          installments_total: 3,
          parent_transaction_id: parentId,
          created_at: '2026-01-01',
        }))

        const all = [parentTx, ...parcels]

        const result = await updateTransactionWithPropagation({
          transaction: parcels[1], // mexendo na parcela 2
          allTransactions: all,
          formData: {
            description: 'Smart TV LG',
            amount: 550,
            type: 'despesa',
            account_id: 'acc_1',
            category_id: 'cat_eletr',
            date: '2026-02-10',
            installments_total: 3, // manteve 3
            is_recurring: false,
          },
          choice: 'all',
        })

        // Atualizou todas as 3 parcelas
        expect(result.updated.length).toBe(3)
        expect(result.updated.every((p) => p.amount === 550)).toBe(true)
        // Zero criadas, zero excluídas
        expect(result.created.length).toBe(0)
        expect(result.deletedIds.length).toBe(0)
      })

      it('1c: Aumentou número de parcelas (3 -> 5) -> cria as parcelas extras (4 e 5)', async () => {
        const parentId = 'p_compra_sofa'
        const parcels: Transaction[] = [1, 2, 3].map((n) => ({
          id: `sofa_part_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 300,
          description: `Sofá (${n}/3)`,
          category_id: 'cat_moveis',
          account_id: 'acc_1',
          date: `2026-0${n}-15`,
          paid: false,
          installment_number: n,
          installments_total: 3,
          parent_transaction_id: parentId,
          created_at: '2026-01-01',
        }))

        const result = await updateTransactionWithPropagation({
          transaction: parcels[0], // mexendo na parcela 1
          allTransactions: parcels,
          formData: {
            description: 'Sofá Retrátil',
            amount: 300,
            type: 'despesa',
            account_id: 'acc_1',
            category_id: 'cat_moveis',
            date: '2026-01-15',
            installments_total: 5, // aumentou de 3 para 5
            is_recurring: false,
          },
          choice: 'all',
        })

        // Atualizou as 3 existentes com o novo total (x/5)
        expect(result.updated.length).toBe(3)
        // Criou as 2 parcelas extras (4/5 e 5/5)
        expect(result.created.length).toBe(2)
        expect(result.created.map((c) => c.installment_number)).toEqual([4, 5])
        expect(result.created.every((c) => c.installments_total === 5)).toBe(true)
        expect(result.deletedIds.length).toBe(0)
      })

      it('1d: Diminuiu número de parcelas (5 -> 3) -> exclui as parcelas excedentes (4 e 5)', async () => {
        const parentId = 'p_compra_mesa'
        const parcels: Transaction[] = [1, 2, 3, 4, 5].map((n) => ({
          id: `mesa_part_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 200,
          description: `Mesa Jantar (${n}/5)`,
          category_id: 'cat_moveis',
          account_id: 'acc_1',
          date: `2026-0${n}-20`,
          paid: false,
          installment_number: n,
          installments_total: 5,
          parent_transaction_id: parentId,
          created_at: '2026-01-01',
        }))

        const result = await updateTransactionWithPropagation({
          transaction: parcels[1], // mexendo na parcela 2
          allTransactions: parcels,
          formData: {
            description: 'Mesa Jantar 6 Cadeiras',
            amount: 200,
            type: 'despesa',
            account_id: 'acc_1',
            category_id: 'cat_moveis',
            date: '2026-02-20',
            installments_total: 3, // reduziu de 5 para 3
            is_recurring: false,
          },
          choice: 'all',
        })

        // Atualizou as parcelas mantidas (1, 2, 3)
        expect(result.updated.length).toBe(3)
        // Zero criadas
        expect(result.created.length).toBe(0)
        // Excluiu as parcelas 4 e 5
        expect(result.deletedIds).toEqual(['mesa_part_4', 'mesa_part_5'])
      })
    })

    // -----------------------------------------------------------------------
    // REGRA 2: Atualizar "Somente esse"
    // Atualizar apenas esse lançamento. Nada mais (não criar, não atualizar, não excluir outros).
    // -----------------------------------------------------------------------
    describe('Regra 2: Atualização "Somente esse"', () => {
      it('Atualiza APENAS o lançamento selecionado, sem tocar nos outros', async () => {
        const series: Transaction[] = [
          {
            id: 'rec_net_1',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 50,
            description: 'Internet Fibra',
            category_id: 'cat_net',
            account_id: 'acc_1',
            date: '2026-01-05',
            paid: true,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
          {
            id: 'rec_net_2',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 50,
            description: 'Internet Fibra',
            category_id: 'cat_net',
            account_id: 'acc_1',
            date: '2026-02-05',
            paid: false,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
          {
            id: 'rec_net_3',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 50,
            description: 'Internet Fibra',
            category_id: 'cat_net',
            account_id: 'acc_1',
            date: '2026-03-05',
            paid: false,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
        ]

        const result = await updateTransactionWithPropagation({
          transaction: series[1], // mês 2
          allTransactions: series,
          formData: {
            description: 'Internet Fibra (com desconto)',
            amount: 35,
            type: 'despesa',
            account_id: 'acc_1',
            category_id: 'cat_net',
            date: '2026-02-05',
            is_recurring: true,
            recurrence_type: 'mensal',
          },
          choice: 'single',
        })

        // Apenas rec_net_2 atualizado
        expect(result.updated.length).toBe(1)
        expect(result.updated[0].id).toBe('rec_net_2')
        expect(result.updated[0].amount).toBe(35)
        expect(result.updated[0].description).toBe('Internet Fibra (com desconto)')
        // Nada criado, nada excluído
        expect(result.created.length).toBe(0)
        expect(result.deletedIds.length).toBe(0)
      })
    })

    // -----------------------------------------------------------------------
    // REGRA 3: Atualizar "Este e os próximos"
    // Atualizar os dados dos lançamentos futuros referentes ao mexido.
    // Só criar novos lançamentos caso não existam lançamentos vinculados futuros.
    // Se as ocorrências futuras já existem, apenas atualizá-las.
    // -----------------------------------------------------------------------
    describe('Regra 3: Atualização "Este e os próximos"', () => {
      it('3a: Se as ocorrências futuras já existem, apenas atualizá-las (zero criadas)', async () => {
        // Série completa de 12 meses existente
        const fullSeries: Transaction[] = []
        for (let m = 1; m <= 12; m++) {
          const mm = String(m).padStart(2, '0')
          fullSeries.push({
            id: `rec_aluguel_${mm}`,
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 2000,
            description: 'Aluguel Casa',
            category_id: 'cat_moradia',
            account_id: 'acc_1',
            date: `2026-${mm}-01`,
            paid: m < 3,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          })
        }

        // Mexer no mês 3 com "Este e os próximos"
        const result = await updateTransactionWithPropagation({
          transaction: fullSeries[2], // 2026-03-01
          allTransactions: fullSeries,
          formData: {
            description: 'Aluguel Casa Reajustado',
            amount: 2200,
            type: 'despesa',
            account_id: 'acc_1',
            category_id: 'cat_moradia',
            date: '2026-03-01',
            is_recurring: true,
            recurrence_type: 'mensal',
          },
          choice: 'future',
        })

        // Atualizou meses 03 até 12 (10 ocorrências)
        expect(result.updated.length).toBe(10)
        expect(result.updated.every((u) => u.amount === 2200)).toBe(true)
        expect(result.updated.every((u) => u.description === 'Aluguel Casa Reajustado')).toBe(true)
        // As ocorrências futuras já existiam -> ZERO novas criadas!
        expect(result.created.length).toBe(0)
        expect(result.deletedIds.length).toBe(0)
      })

      it('3b: Só cria novos lançamentos caso não existam lançamentos vinculados futuros (preenche faltantes)', async () => {
        // Apenas meses 01, 02 e 03 existem
        const partialSeries: Transaction[] = [
          {
            id: 'rec_cond_01',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 400,
            description: 'Condomínio',
            category_id: 'cat_moradia',
            account_id: 'acc_1',
            date: '2026-01-10',
            paid: true,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
          {
            id: 'rec_cond_02',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 400,
            description: 'Condomínio',
            category_id: 'cat_moradia',
            account_id: 'acc_1',
            date: '2026-02-10',
            paid: true,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
          {
            id: 'rec_cond_03',
            control_id: 'ctrl_1',
            user_id: 'u1',
            type: 'despesa',
            amount: 400,
            description: 'Condomínio',
            category_id: 'cat_moradia',
            account_id: 'acc_1',
            date: '2026-03-10',
            paid: false,
            is_recurring: true,
            recurrence_type: 'mensal',
            created_at: '2026-01-01',
          },
        ]

        // Mexer no mês 3 com "Este e os próximos"
        const result = await updateTransactionWithPropagation({
          transaction: partialSeries[2], // mês 3
          allTransactions: partialSeries,
          formData: {
            description: 'Condomínio',
            amount: 450,
            type: 'despesa',
            account_id: 'acc_1',
            category_id: 'cat_moradia',
            date: '2026-03-10',
            is_recurring: true,
            recurrence_type: 'mensal',
          },
          choice: 'future',
        })

        // Atualizou o mês 3 existente
        expect(result.updated.length).toBe(1)
        expect(result.updated[0].id).toBe('rec_cond_03')
        expect(result.updated[0].amount).toBe(450)

        // Criou apenas os meses faltantes na janela futura (meses 04 a 12 -> 9 ocorrências)
        expect(result.created.length).toBe(9)
        const createdMonths = result.created.map((c) => c.date.substring(0, 7))
        expect(createdMonths).not.toContain('2026-01')
        expect(createdMonths).not.toContain('2026-02')
        expect(createdMonths).not.toContain('2026-03')
        expect(createdMonths).toContain('2026-04')
        expect(createdMonths).toContain('2026-12')
      })

      it('3c: Parcelado com "Este e os próximos" cria apenas parcelas faltantes da série', async () => {
        // Série de 6 parcelas onde apenas 1, 2 e 3 foram geradas até agora
        const parentId = 'p_curso_ingles'
        const parcels: Transaction[] = [1, 2, 3].map((n) => ({
          id: `curso_part_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 250,
          description: `Curso Inglês (${n}/6)`,
          category_id: 'cat_educacao',
          account_id: 'acc_1',
          date: `2026-0${n}-10`,
          paid: n === 1,
          installment_number: n,
          installments_total: 6,
          parent_transaction_id: parentId,
          created_at: '2026-01-01',
        }))

        // Editar parcela 2 com "future"
        const result = await updateTransactionWithPropagation({
          transaction: parcels[1], // parcela 2
          allTransactions: parcels,
          formData: {
            description: 'Curso Inglês VIP',
            amount: 260,
            type: 'despesa',
            account_id: 'acc_1',
            category_id: 'cat_educacao',
            date: '2026-02-10',
            installments_total: 6,
            is_recurring: false,
          },
          choice: 'future',
        })

        // Atualizou as parcelas 2 e 3 existentes
        expect(result.updated.map((u) => u.id)).toEqual(['curso_part_2', 'curso_part_3'])
        // Criou apenas as parcelas faltantes (4, 5, 6)
        expect(result.created.length).toBe(3)
        expect(result.created.map((c) => c.installment_number)).toEqual([4, 5, 6])
      })
    })

    // -----------------------------------------------------------------------
    // REGRA 4: Excluir "Somente esse"
    // Excluir somente esse lançamento.
    // -----------------------------------------------------------------------
    describe('Regra 4: Exclusão "Somente esse"', () => {
      it('Exclui estritamente apenas o lançamento alvo selecionado', async () => {
        const series: Transaction[] = [1, 2, 3].map((n) => ({
          id: `rec_academia_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 100,
          description: 'Academia',
          category_id: 'cat_saude',
          account_id: 'acc_1',
          date: `2026-0${n}-01`,
          paid: false,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01',
        }))

        const { deletedIds } = await deleteTransactionWithPropagation({
          transaction: series[1], // parcela 2
          allTransactions: series,
          choice: 'single',
        })

        expect(deletedIds).toEqual(['rec_academia_2'])
      })
    })

    // -----------------------------------------------------------------------
    // REGRA 5: Excluir "Todos"
    // Excluir todos os lançamentos referentes ao excluído
    // (série inteira — passadas e futuras, ou todas as parcelas + registro pai).
    // -----------------------------------------------------------------------
    describe('Regra 5: Exclusão "Todos"', () => {
      it('5a: Exclui série inteira de recorrências (passadas e futuras)', async () => {
        const series: Transaction[] = [1, 2, 3, 4, 5].map((n) => ({
          id: `rec_netflix_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 55,
          description: 'Netflix',
          category_id: 'cat_stream',
          account_id: 'acc_1',
          date: `2026-0${n}-15`,
          paid: n <= 2,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01',
        }))

        // Clica na ocorrência 3 e escolhe "all"
        const { deletedIds } = await deleteTransactionWithPropagation({
          transaction: series[2],
          allTransactions: series,
          choice: 'all',
        })

        // Todas as 5 excluídas
        expect(deletedIds.length).toBe(5)
        expect(deletedIds).toEqual([
          'rec_netflix_1',
          'rec_netflix_2',
          'rec_netflix_3',
          'rec_netflix_4',
          'rec_netflix_5',
        ])
      })

      it('5b: Exclui todas as parcelas + registro pai consolidado do parcelamento', async () => {
        const parentId = 'p_notebook'
        const parentTx: Transaction = {
          id: parentId,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 4000,
          description: 'Notebook Dell',
          category_id: 'cat_info',
          account_id: 'acc_1',
          date: '2026-01-02',
          installment_number: 0,
          installments_total: 4,
          created_at: '2026-01-01',
        }
        const parcels: Transaction[] = [1, 2, 3, 4].map((n) => ({
          id: `note_part_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 1000,
          description: `Notebook Dell (${n}/4)`,
          category_id: 'cat_info',
          account_id: 'acc_1',
          date: `2026-0${n}-02`,
          installment_number: n,
          installments_total: 4,
          parent_transaction_id: parentId,
          created_at: '2026-01-01',
        }))

        const all = [parentTx, ...parcels]

        const { deletedIds } = await deleteTransactionWithPropagation({
          transaction: parcels[2], // clica na parcela 3
          allTransactions: all,
          choice: 'all',
        })

        // Excluiu o pai e todas as 4 parcelas (5 registros)
        expect(deletedIds.length).toBe(5)
        expect(deletedIds).toContain(parentId)
        expect(deletedIds).toContain('note_part_1')
        expect(deletedIds).toContain('note_part_4')
      })
    })

    // -----------------------------------------------------------------------
    // REGRA 6: Excluir "Este e os próximos"
    // Excluir esse lançamento e os lançamentos FUTUROS referentes a ele.
    // Manter os passados intactos.
    // -----------------------------------------------------------------------
    describe('Regra 6: Exclusão "Este e os próximos"', () => {
      it('6a: Recorrência: exclui esse e os futuros, mantém passados intactos', async () => {
        const series: Transaction[] = [1, 2, 3, 4, 5, 6].map((n) => ({
          id: `rec_seguro_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 150,
          description: 'Seguro Auto',
          category_id: 'cat_seguro',
          account_id: 'acc_1',
          date: `2026-0${n}-10`,
          paid: n < 3,
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-01-01',
        }))

        // Clica no mês 3 e escolhe "future"
        const { deletedIds } = await deleteTransactionWithPropagation({
          transaction: series[2], // mês 3
          allTransactions: series,
          choice: 'future',
        })

        // Excluiu meses 3, 4, 5, 6
        expect(deletedIds).toEqual(['rec_seguro_3', 'rec_seguro_4', 'rec_seguro_5', 'rec_seguro_6'])
        // Meses 1 e 2 mantidos intactos (não estão nos deletedIds)
        expect(deletedIds).not.toContain('rec_seguro_1')
        expect(deletedIds).not.toContain('rec_seguro_2')
      })

      it('6b: Parcelamento: exclui esse e parcelas futuras, mantém passadas intactas e não remove pai', async () => {
        const parentId = 'p_iphone'
        const parentTx: Transaction = {
          id: parentId,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 6000,
          description: 'iPhone 15',
          category_id: 'cat_telefonia',
          account_id: 'acc_1',
          date: '2026-01-05',
          installment_number: 0,
          installments_total: 6,
          created_at: '2026-01-01',
        }
        const parcels: Transaction[] = [1, 2, 3, 4, 5, 6].map((n) => ({
          id: `iphone_part_${n}`,
          control_id: 'ctrl_1',
          user_id: 'u1',
          type: 'despesa',
          amount: 1000,
          description: `iPhone 15 (${n}/6)`,
          category_id: 'cat_telefonia',
          account_id: 'acc_1',
          date: `2026-0${n}-05`,
          installment_number: n,
          installments_total: 6,
          parent_transaction_id: parentId,
          created_at: '2026-01-01',
        }))

        const all = [parentTx, ...parcels]

        // Excluir da parcela 4 em diante com "future"
        const { deletedIds } = await deleteTransactionWithPropagation({
          transaction: parcels[3], // parcela 4
          allTransactions: all,
          choice: 'future',
        })

        // Exclui parcelas 4, 5, 6
        expect(deletedIds).toEqual(['iphone_part_4', 'iphone_part_5', 'iphone_part_6'])
        // Parcelas 1, 2, 3 mantidas intactas
        expect(deletedIds).not.toContain('iphone_part_1')
        expect(deletedIds).not.toContain('iphone_part_2')
        expect(deletedIds).not.toContain('iphone_part_3')
        // Registro pai mantido intacto para preservar histórico das parcelas passadas
        expect(deletedIds).not.toContain(parentId)
      })
    })

    // -----------------------------------------------------------------------
    // REGRA 7: Independência de lançamentos com mesmo valor (Bug v0.0.93)
    // -----------------------------------------------------------------------
    describe('Regra 7: Lançamentos independentes com mesmo valor (Bug v0.0.93)', () => {
      it('findRecurringSeries não agrupa despesas com mesmo valor mas descrições diferentes ou sem descrição', () => {
        const txTarget: Transaction = {
          id: 'tx_alvo',
          control_id: 'c1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50.21,
          description: '',
          account_id: 'acc1',
          category_id: 'cat1',
          date: '2026-08-10',
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-08-10',
        }

        const independentTx1: Transaction = {
          id: 'tx_indep1',
          control_id: 'c1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50.21,
          description: '',
          account_id: 'acc1',
          category_id: 'cat2', // categoria diferente
          date: '2026-08-08',
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-08-08',
        }

        const independentTx2: Transaction = {
          id: 'tx_indep2',
          control_id: 'c1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50.21,
          description: 'Café da manhã',
          account_id: 'acc1',
          category_id: 'cat3',
          date: '2026-08-09',
          is_recurring: false,
          created_at: '2026-08-09',
        }

        // Lançamento com descrição genérica/vazia e sem parent_transaction_id NÃO deve agrupar independentes
        const series = findRecurringSeries(txTarget, [txTarget, independentTx1, independentTx2])
        expect(series).toHaveLength(1)
        expect(series[0].id).toBe('tx_alvo')
      })

      it('findRecurringSeries diferencia categorias distintas mesmo se ambas forem recorrentes', () => {
        const tx1: Transaction = {
          id: 'tx1',
          control_id: 'c1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50.21,
          description: 'Serviço',
          account_id: 'acc1',
          category_id: 'cat_servico_a',
          date: '2026-08-10',
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-08-10',
        }

        const tx2: Transaction = {
          id: 'tx2',
          control_id: 'c1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50.21,
          description: 'Serviço',
          account_id: 'acc1',
          category_id: 'cat_servico_b', // categoria diferente
          date: '2026-09-10',
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-09-10',
        }

        const series = findRecurringSeries(tx1, [tx1, tx2])
        expect(series).toHaveLength(1)
        expect(series[0].id).toBe('tx1')
      })

      it('updateTransactionWithPropagation com escolha future nunca cria ocorrências no mês atual nem altera independentes', async () => {
        const targetTx: Transaction = {
          id: 'tx_alvo',
          control_id: 'c1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50.21,
          description: 'Netflix',
          account_id: 'acc1',
          category_id: 'cat_stream',
          date: '2026-09-10',
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-09-10',
        }

        const otherSameAmount: Transaction = {
          id: 'tx_outra',
          control_id: 'c1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50.21,
          description: 'Farmácia',
          account_id: 'acc1',
          category_id: 'cat_saude',
          date: '2026-09-08',
          is_recurring: false,
          created_at: '2026-09-08',
        }

        const futureTx: Transaction = {
          id: 'tx_futura',
          control_id: 'c1',
          user_id: 'u1',
          type: 'despesa',
          amount: 50.21,
          description: 'Netflix',
          account_id: 'acc1',
          category_id: 'cat_stream',
          date: '2026-10-10',
          is_recurring: true,
          recurrence_type: 'mensal',
          created_at: '2026-09-10',
        }

        const allTransactions = [targetTx, otherSameAmount, futureTx]

        const result = await updateTransactionWithPropagation({
          transaction: targetTx,
          allTransactions,
          formData: {
            description: 'Netflix Premium',
            amount: 55.9,
            type: 'despesa',
            account_id: 'acc1',
            category_id: 'cat_stream',
            date: '2026-09-10',
            is_recurring: true,
            recurrence_type: 'mensal',
          },
          choice: 'future',
        })

        // 1. targetTx e futureTx foram atualizados
        const updatedIds = result.updated.map((t) => t.id)
        expect(updatedIds).toContain('tx_alvo')
        expect(updatedIds).toContain('tx_futura')
        // 2. otherSameAmount NÃO foi alterado
        expect(updatedIds).not.toContain('tx_outra')
        // 3. ZERO criações no mês atual (2026-09)
        const currentMonthCreated = result.created.filter((t) => t.date.startsWith('2026-09'))
        expect(currentMonthCreated).toHaveLength(0)
      })
    })
  })
})
