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
})
