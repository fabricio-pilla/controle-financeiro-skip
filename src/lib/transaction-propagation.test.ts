import { describe, it, expect, vi } from 'vitest'
import {
  findRecurringSeries,
  findInstallmentGroup,
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
})
