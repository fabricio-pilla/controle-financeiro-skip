import { Transaction, TransactionType, RecurrenceType } from '@/types/database'
import pb from '@/lib/pocketbase/client'
import { skipCloud } from '@/lib/skip-cloud'
import { executeWithRetry, runInPool } from '@/lib/pocketbase/retry'
import { PropagationChoice } from '@/components/transactions/RecurrencePropagationModal'

export interface UpdateTransactionPayload {
  description: string
  amount: number
  type: TransactionType
  account_id: string
  category_id: string
  subcategory_id?: string
  date: string
  payment_date?: string
  is_recurring: boolean
  recurrence_type?: RecurrenceType
  notes?: string
  installments_total?: number
  paid?: boolean
}

// Utility to add months safely
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  const targetMonthLastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (day > targetMonthLastDay) d.setDate(targetMonthLastDay)
  return d.toISOString().split('T')[0]
}

// Clean title from "(X/Y)" suffix if present
/**
 * Helper to check if a transaction record is a consolidated parent record of an installment series.
 * Parent records must be completely excluded from all sums, statistics, charts, and list views.
 */
export function isParentTransaction(
  transaction: Pick<Transaction, 'installment_number' | 'installments_total'> | any,
): boolean {
  if (!transaction) return false
  const num = transaction.installment_number ?? 0
  const total = transaction.installments_total ?? transaction.installment_total ?? 0
  return (num === 0 || num === undefined) && total > 0
}

export function cleanDescription(desc: string): string {
  return desc.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
}

/**
 * Helper to check if a transaction is an installment
 */
export function isInstallmentTransaction(transaction: Transaction): boolean {
  return Boolean(
    transaction.parent_transaction_id ||
    (transaction.installment_number && transaction.installment_number > 0) ||
    (transaction.installments_total && transaction.installments_total > 1) ||
    /\(\s*\d+\s*\/\s*\d+\s*\)/.test(transaction.description || ''),
  )
}

/**
 * Helper to check if a transaction is recurring
 */
export function isRecurringTransaction(transaction: Transaction): boolean {
  return Boolean(
    transaction.is_recurring ||
    transaction.recurring ||
    Boolean(transaction.recurrence_type && transaction.recurrence_type.length > 0),
  )
}

/**
 * Find sibling transactions belonging to an installment group
 */
export function findInstallmentGroup(
  transaction: Transaction,
  allTransactions: Transaction[],
): Transaction[] {
  const parentId = transaction.parent_transaction_id || transaction.id
  const originalDesc = cleanDescription(transaction.description)

  const group = allTransactions.filter(
    (t) =>
      (t.parent_transaction_id && t.parent_transaction_id === parentId) ||
      t.id === parentId ||
      (transaction.parent_transaction_id && t.id === transaction.parent_transaction_id) ||
      (cleanDescription(t.description) === originalDesc &&
        (t.installments_total || 0) > 1 &&
        t.type === transaction.type),
  )

  group.sort((a, b) => {
    const numA = a.installment_number || 0
    const numB = b.installment_number || 0
    if (numA !== numB) return numA - numB
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  return group
}

/**
 * Find transactions belonging to a recurring series
 */
export function findRecurringSeries(
  transaction: Transaction,
  allTransactions: Transaction[],
): Transaction[] {
  const originalDesc = transaction.description.trim()
  const currentCatId = transaction.category_id
  const currentType = transaction.type

  const series = allTransactions.filter(
    (t) =>
      t.control_id === transaction.control_id &&
      (t.is_recurring || t.recurring || Boolean(t.recurrence_type)) &&
      t.type === currentType &&
      (t.id === transaction.id ||
        t.description.trim().toLowerCase() === originalDesc.toLowerCase() ||
        (t.category_id === currentCatId &&
          t.description.trim().toLowerCase() === originalDesc.toLowerCase())),
  )

  series.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  return series
}

/**
 * Handle deleting a transaction with propagation support for installments and recurring items.
 */
export async function deleteTransactionWithPropagation({
  transaction,
  allTransactions,
  choice = 'single',
}: {
  transaction: Transaction
  allTransactions: Transaction[]
  choice?: PropagationChoice
}): Promise<void> {
  const isInstallment = isInstallmentTransaction(transaction)
  const isRecurring = isRecurringTransaction(transaction)

  // Standalone single transaction or user chose 'single'
  if ((!isInstallment && !isRecurring) || choice === 'single') {
    await executeWithRetry(() => skipCloud.deleteTransaction(transaction.id), 5, 1000, 'DELETE_TX')
    return
  }

  // Handle INSTALLMENT deletion
  if (isInstallment) {
    const group = findInstallmentGroup(transaction, allTransactions)
    const currentNum = transaction.installment_number || 1

    let targetsToDelete: Transaction[] = []
    if (choice === 'all') {
      targetsToDelete = group.length > 0 ? group : [transaction]
    } else if (choice === 'future') {
      targetsToDelete = group.filter((t) => (t.installment_number || 0) >= currentNum)
      if (targetsToDelete.length === 0) targetsToDelete = [transaction]
    }

    const affectedAccountIds = Array.from(new Set(targetsToDelete.map((t) => t.account_id)))

    // Delete targets in controlled concurrent pool (concurrency: 4)
    await runInPool(
      targetsToDelete,
      async (item) => {
        await skipCloud.deleteTransaction(item.id, true)
      },
      { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'DELETE_INSTALLMENT' },
    )

    // Recompute balance once at end
    await skipCloud.recomputeAccountsBalances(affectedAccountIds)
    return
  }

  // Handle RECURRING deletion
  if (isRecurring) {
    const series = findRecurringSeries(transaction, allTransactions)
    const currentDate = new Date(transaction.date).getTime()

    let targetsToDelete: Transaction[] = []
    if (choice === 'all') {
      targetsToDelete = series.length > 0 ? series : [transaction]
    } else if (choice === 'future') {
      targetsToDelete = series.filter((t) => new Date(t.date).getTime() >= currentDate)
      if (targetsToDelete.length === 0) targetsToDelete = [transaction]
    }

    const affectedAccountIds = Array.from(new Set(targetsToDelete.map((t) => t.account_id)))

    // Delete targets in controlled concurrent pool (concurrency: 4)
    await runInPool(
      targetsToDelete,
      async (item) => {
        await skipCloud.deleteTransaction(item.id, true)
      },
      { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'DELETE_RECURRING' },
    )

    // Recompute balance once at end
    await skipCloud.recomputeAccountsBalances(affectedAccountIds)
    return
  }
}

/**
 * Handle updating a transaction with propagation support for installments and recurring items.
 */
export async function updateTransactionWithPropagation({
  transaction,
  allTransactions,
  formData,
  choice,
}: {
  transaction: Transaction
  allTransactions: Transaction[]
  formData: UpdateTransactionPayload
  choice?: PropagationChoice
}): Promise<{ updated: Transaction[]; created: Transaction[]; deletedIds: string[] }> {
  const isInstallment = Boolean(
    transaction.parent_transaction_id ||
    (transaction.installment_number && transaction.installment_number > 0) ||
    (transaction.installments_total && transaction.installments_total > 1),
  )

  const isRecurring = Boolean(transaction.is_recurring || transaction.recurring)

  // If it's a simple standalone transaction or choice is 'single'
  if ((!isInstallment && !isRecurring) || choice === 'single') {
    const updated = await skipCloud.updateTransaction(transaction.id, {
      description: formData.description.trim(),
      amount: formData.amount,
      type: formData.type,
      account_id: formData.account_id,
      category_id: formData.category_id,
      subcategory_id: formData.subcategory_id || '',
      date: formData.date,
      payment_date: formData.payment_date || formData.date,
      notes: formData.notes?.trim() || '',
      is_recurring: formData.is_recurring,
      recurrence_type: formData.is_recurring ? formData.recurrence_type : undefined,
    })
    return { updated: [updated], created: [], deletedIds: [] }
  }

  // Handle INSTALLMENT Propagation
  if (isInstallment) {
    return await handleInstallmentPropagation({
      transaction,
      allTransactions,
      formData,
      choice: choice || 'all',
    })
  }

  // Handle RECURRING Propagation
  if (isRecurring) {
    return await handleRecurringPropagation({
      transaction,
      allTransactions,
      formData,
      choice: choice || 'all',
    })
  }

  return { updated: [], created: [], deletedIds: [] }
}

/**
 * Installments propagation logic
 */
async function handleInstallmentPropagation({
  transaction,
  allTransactions,
  formData,
  choice,
}: {
  transaction: Transaction
  allTransactions: Transaction[]
  formData: UpdateTransactionPayload
  choice: PropagationChoice
}): Promise<{ updated: Transaction[]; created: Transaction[]; deletedIds: string[] }> {
  const parentId = transaction.parent_transaction_id || transaction.id
  const newBaseDesc = cleanDescription(formData.description)

  // Find all sibling transactions in this installment group
  const group = findInstallmentGroup(transaction, allTransactions)

  // Determine which items to update based on choice
  const currentNum = transaction.installment_number || 1
  const oldTotal = transaction.installments_total || group.length || 1
  const newTotal =
    formData.installments_total && formData.installments_total > 0
      ? formData.installments_total
      : oldTotal

  let targetsToUpdate: Transaction[] = []
  if (choice === 'all') {
    targetsToUpdate = group.length > 0 ? group : [transaction]
  } else if (choice === 'future') {
    targetsToUpdate = group.filter((t) => (t.installment_number || 0) >= currentNum)
    if (targetsToUpdate.length === 0) targetsToUpdate = [transaction]
  }

  const affectedAccountIds = new Set<string>()
  affectedAccountIds.add(formData.account_id)
  targetsToUpdate.forEach((t) => affectedAccountIds.add(t.account_id))

  // 1. Update existing target transactions concurrently
  const updatedItems = await runInPool(
    targetsToUpdate,
    async (item) => {
      const itemNum = item.installment_number || 1
      const desc = newTotal > 1 ? `${newBaseDesc} (${itemNum}/${newTotal})` : newBaseDesc

      let itemDate = item.date
      if (item.id === transaction.id) {
        itemDate = formData.date
      } else {
        const diffMonths = (item.installment_number || 1) - currentNum
        itemDate = addMonths(formData.date, diffMonths)
      }

      let itemPaymentDate = item.payment_date || itemDate
      if (item.id === transaction.id) {
        itemPaymentDate = formData.payment_date || formData.date
      } else {
        const diffMonths = (item.installment_number || 1) - currentNum
        itemPaymentDate = addMonths(formData.payment_date || formData.date, diffMonths)
      }

      return await skipCloud.updateTransaction(
        item.id,
        {
          description: desc,
          amount: formData.amount,
          type: formData.type,
          account_id: formData.account_id,
          category_id: formData.category_id,
          subcategory_id: formData.subcategory_id || '',
          date: itemDate,
          payment_date: itemPaymentDate,
          notes: formData.notes?.trim() || '',
          installment_number: itemNum,
          installments_total: newTotal,
          parent_transaction_id: parentId,
          is_recurring: false,
        },
        true, // skip per-request balance update
      )
    },
    { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'UPDATE_INSTALLMENT' },
  )

  // 2. Also update installment_total & description suffix on prior items if choice was 'future' and total changed
  if (choice === 'future' && newTotal !== oldTotal) {
    const priorItems = group.filter((t) => (t.installment_number || 0) < currentNum)
    const priorUpdated = await runInPool(
      priorItems,
      async (prior) => {
        const priorNum = prior.installment_number || 1
        const priorDesc = `${cleanDescription(prior.description)} (${priorNum}/${newTotal})`
        return await skipCloud.updateTransaction(
          prior.id,
          {
            description: priorDesc,
            installments_total: newTotal,
          },
          true,
        )
      },
      { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'UPDATE_PRIOR_INSTALLMENTS' },
    )
    updatedItems.push(...priorUpdated)
  }

  const createdItems: Transaction[] = []
  const deletedIds: string[] = []

  // 3. Handle changing the number of installments (increase or decrease)
  if (newTotal !== oldTotal) {
    if (newTotal > oldTotal) {
      // Create missing installments
      const maxExistingNum = Math.max(...group.map((t) => t.installment_number || 0), oldTotal)
      const userId = transaction.user_id || (pb.authStore.model as any)?.id || ''
      const baseDate = formData.date

      const missingIndexes: number[] = []
      for (let i = maxExistingNum + 1; i <= newTotal; i++) {
        missingIndexes.push(i)
      }

      const newlyCreated = await runInPool(
        missingIndexes,
        async (i) => {
          const diffMonths = i - currentNum
          const parcelDate = addMonths(baseDate, diffMonths)
          const parcelDesc = `${newBaseDesc} (${i}/${newTotal})`

          const payload: any = {
            control_id: transaction.control_id,
            user_id: userId,
            type: formData.type,
            amount: formData.amount,
            description: parcelDesc,
            category_id: formData.category_id || '',
            subcategory_id: formData.subcategory_id || '',
            account_id: formData.account_id,
            date: parcelDate,
            payment_date: addMonths(formData.payment_date || formData.date, diffMonths),
            paid: false, // Future created parcels default to pending
            is_recurring: false,
            recurrence_type: '',
            installments_total: newTotal,
            installment_total: newTotal,
            installment_number: i,
            parent_transaction_id: parentId,
            notes: formData.notes?.trim() || '',
          }
          const rec = await pb.collection('transactions').create(payload)
          return {
            id: rec.id,
            control_id: rec.control_id,
            user_id: rec.user_id,
            type: rec.type,
            amount: Number(rec.amount),
            description: rec.description,
            category_id: rec.category_id,
            subcategory_id: rec.subcategory_id,
            account_id: rec.account_id,
            date: rec.date,
            payment_date: rec.payment_date,
            paid: rec.paid,
            is_recurring: rec.is_recurring,
            recurrence_type: rec.recurrence_type,
            installment_number: rec.installment_number,
            installments_total: rec.installment_total || rec.installments_total,
            parent_transaction_id: rec.parent_transaction_id,
            notes: rec.notes,
            created_at: rec.created,
          } as Transaction
        },
        { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'CREATE_INSTALLMENT' },
      )
      createdItems.push(...newlyCreated)
    } else if (newTotal < oldTotal) {
      // Exceeding installments to remove (e.g. reduced from 10 to 6 -> delete 7, 8, 9, 10)
      const excessItems = group.filter((t) => (t.installment_number || 0) > newTotal)
      excessItems.forEach((excess) => {
        affectedAccountIds.add(excess.account_id)
        deletedIds.push(excess.id)
      })

      await runInPool(
        excessItems,
        async (excess) => {
          await skipCloud.deleteTransaction(excess.id, true)
        },
        { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'DELETE_EXCESS_INSTALLMENTS' },
      )
    }
  }

  // Recompute balance once at end for all affected accounts
  await skipCloud.recomputeAccountsBalances(Array.from(affectedAccountIds))

  return { updated: updatedItems, created: createdItems, deletedIds }
}

/**
 * Recurring transactions propagation logic
 */
async function handleRecurringPropagation({
  transaction,
  allTransactions,
  formData,
  choice,
}: {
  transaction: Transaction
  allTransactions: Transaction[]
  formData: UpdateTransactionPayload
  choice: PropagationChoice
}): Promise<{ updated: Transaction[]; created: Transaction[]; deletedIds: string[] }> {
  // Find all transactions that belong to this recurring series
  const series = findRecurringSeries(transaction, allTransactions)

  let targetsToUpdate: Transaction[] = []
  if (choice === 'all') {
    targetsToUpdate = series.length > 0 ? series : [transaction]
  } else if (choice === 'future') {
    const currentDate = new Date(transaction.date).getTime()
    targetsToUpdate = series.filter((t) => new Date(t.date).getTime() >= currentDate)
    if (targetsToUpdate.length === 0) targetsToUpdate = [transaction]
  }

  const affectedAccountIds = new Set<string>()
  affectedAccountIds.add(formData.account_id)
  targetsToUpdate.forEach((t) => affectedAccountIds.add(t.account_id))

  // Update in controlled concurrent pool (concurrency = 4)
  const updatedItems = await runInPool(
    targetsToUpdate,
    async (item) => {
      const targetDate = item.id === transaction.id ? formData.date : item.date
      const targetPaymentDate =
        item.id === transaction.id
          ? formData.payment_date || formData.date
          : item.payment_date || item.date

      return await skipCloud.updateTransaction(
        item.id,
        {
          description: formData.description.trim(),
          amount: formData.amount,
          type: formData.type,
          account_id: formData.account_id,
          category_id: formData.category_id,
          subcategory_id: formData.subcategory_id || '',
          date: targetDate,
          payment_date: targetPaymentDate,
          notes: formData.notes?.trim() || '',
          is_recurring: formData.is_recurring,
          recurrence_type: formData.is_recurring ? formData.recurrence_type : undefined,
        },
        true, // skip per-request balance update
      )
    },
    { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'UPDATE_RECURRING' },
  )

  // Recompute balance once at end for all affected accounts
  await skipCloud.recomputeAccountsBalances(Array.from(affectedAccountIds))

  return { updated: updatedItems, created: [], deletedIds: [] }
}
