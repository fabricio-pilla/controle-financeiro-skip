import { describe, it, expect } from 'vitest'
import { getTxEffectiveDate } from './formatters'
import { Transaction } from '@/types/database'

describe('Transactions Sorting and Grouping by Effective Payment Date', () => {
  const createMockTx = (partial: Partial<Transaction>): Transaction => ({
    id: 'tx-' + Math.random().toString(36).substring(2, 9),
    control_id: 'ctrl-1',
    user_id: 'user-1',
    type: 'despesa',
    amount: 100,
    description: 'Item Teste',
    date: '2026-05-15',
    payment_date: '2026-05-15',
    paid: true,
    created_at: new Date().toISOString(),
    ...partial,
  })

  describe('getTxEffectiveDate helper', () => {
    it('retorna payment_date quando preenchida', () => {
      const tx = createMockTx({
        date: '2026-05-10',
        payment_date: '2026-06-18',
      })
      expect(getTxEffectiveDate(tx)).toBe('2026-06-18')
    })

    it('faz fallback para date quando payment_date estiver vazia ou ausente', () => {
      const txEmptyPayDate = createMockTx({
        date: '2026-05-10',
        payment_date: '',
      })
      expect(getTxEffectiveDate(txEmptyPayDate)).toBe('2026-05-10')

      const txUndefinedPayDate = createMockTx({
        date: '2026-05-10',
        payment_date: undefined,
      })
      expect(getTxEffectiveDate(txUndefinedPayDate)).toBe('2026-05-10')
    })

    it('retorna string vazia quando ambas forem vazias', () => {
      const txEmpty = createMockTx({
        date: '',
        payment_date: '',
      })
      expect(getTxEffectiveDate(txEmpty)).toBe('')
    })
  })

  describe('Ordenação crescente da menor para a maior data efetiva', () => {
    it('ordena lançamentos da data menor para a maior (ordem crescente)', () => {
      const tx1 = createMockTx({
        id: '1',
        description: 'Compra A',
        date: '2026-05-20',
        payment_date: '2026-06-10',
      })
      const tx2 = createMockTx({
        id: '2',
        description: 'Compra B',
        date: '2026-04-10',
        payment_date: '2026-04-10',
      })
      const tx3 = createMockTx({
        id: '3',
        description: 'Compra C',
        date: '2026-05-01',
        payment_date: '2026-05-15',
      })
      const tx4 = createMockTx({
        id: '4',
        description: 'Compra D',
        date: '2026-05-25',
        payment_date: '',
      }) // fallback: 2026-05-25

      const list = [tx1, tx2, tx3, tx4]

      // Comparador idêntico ao de TransactionsPage com sortField === 'date' e sortDirection === 'asc'
      list.sort((a, b) => {
        const dateA = getTxEffectiveDate(a)
        const dateB = getTxEffectiveDate(b)
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })

      // Ordem esperada:
      // 1. tx2 -> 2026-04-10
      // 2. tx3 -> 2026-05-15
      // 3. tx4 -> 2026-05-25 (fallback de payment_date vazia)
      // 4. tx1 -> 2026-06-10
      expect(list.map((t) => t.id)).toEqual(['2', '3', '4', '1'])
    })

    it('compara corretamente lançamentos com cartão de crédito (vencimento posterior à data da compra)', () => {
      // Compra feita em 25/04 cuja fatura vence em 10/05 deve ficar após compra de 05/05 paga à vista em 05/05
      const txCartaoAbril = createMockTx({
        id: 'cartao',
        description: 'Mercado no cartão',
        date: '2026-04-25',
        payment_date: '2026-05-10',
      })
      const txPixMaio = createMockTx({
        id: 'pix',
        description: 'Almoço no PIX',
        date: '2026-05-05',
        payment_date: '2026-05-05',
      })

      const list = [txCartaoAbril, txPixMaio]
      list.sort((a, b) => {
        const dateA = getTxEffectiveDate(a)
        const dateB = getTxEffectiveDate(b)
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })

      // PIX (05/05) vem antes do cartão (10/05), mesmo a compra do cartão tendo sido em 25/04
      expect(list[0].id).toBe('pix')
      expect(list[1].id).toBe('cartao')
    })
  })

  describe('Agrupamento/Filtro por mês baseado na data de pagamento', () => {
    it('filtra lançamentos do mês baseado em payment_date com fallback para date', () => {
      const monthFilter = '2026-05'

      const txCartaoAbrilParaMaio = createMockTx({
        id: 't1',
        description: 'Compra 28/04 com pgto 10/05',
        date: '2026-04-28',
        payment_date: '2026-05-10',
      })
      const txCompraMaioParaJunho = createMockTx({
        id: 't2',
        description: 'Compra 25/05 com pgto 10/06',
        date: '2026-05-25',
        payment_date: '2026-06-10',
      })
      const txPixMaio = createMockTx({
        id: 't3',
        description: 'PIX 12/05 com pgto 12/05',
        date: '2026-05-12',
        payment_date: '2026-05-12',
      })
      const txSemPgtoMaio = createMockTx({
        id: 't4',
        description: 'Compra 15/05 sem payment_date explícito',
        date: '2026-05-15',
        payment_date: '',
      })

      const all = [txCartaoAbrilParaMaio, txCompraMaioParaJunho, txPixMaio, txSemPgtoMaio]

      const filteredForMay = all.filter((tx) => {
        const effDate = getTxEffectiveDate(tx)
        return effDate.startsWith(monthFilter)
      })

      // Deve incluir:
      // - t1 (pgto em maio)
      // - t3 (pgto em maio)
      // - t4 (sem pgto -> data da compra em maio)
      // NÃO deve incluir:
      // - t2 (compra em maio, mas pgto em junho)
      expect(filteredForMay.map((t) => t.id)).toEqual(['t1', 't3', 't4'])
    })

    it('deriva corretamente os meses disponíveis a partir da data de pagamento', () => {
      const all = [
        createMockTx({ date: '2026-01-25', payment_date: '2026-02-10' }), // Cai em 2026-02
        createMockTx({ date: '2026-03-01', payment_date: '' }), // Cai em 2026-03 (fallback)
        createMockTx({ date: '2026-04-28', payment_date: '2026-05-15' }), // Cai em 2026-05
      ]

      const monthSet = new Set<string>()
      all.forEach((tx) => {
        const effDate = getTxEffectiveDate(tx)
        if (effDate) {
          const ym = effDate.substring(0, 7)
          if (/^\d{4}-\d{2}$/.test(ym)) {
            monthSet.add(ym)
          }
        }
      })

      expect(monthSet.has('2026-02')).toBe(true)
      expect(monthSet.has('2026-03')).toBe(true)
      expect(monthSet.has('2026-05')).toBe(true)
      expect(monthSet.has('2026-01')).toBe(false) // Compra de 01/2026 foi paga em 02/2026
    })
  })
})
