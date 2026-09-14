import { Transaction, TransactionType, RecurrenceType } from '@/types/database'
import pb from '@/lib/pocketbase/client'
import { skipCloud } from '@/lib/skip-cloud'
import { executeWithRetry, runInPool } from '@/lib/pocketbase/retry'
import { PropagationChoice } from '@/components/transactions/RecurrencePropagationModal'
import { computeTargetDate, parseDateParts } from '@/lib/recurring-generation'

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
  if (!desc) return 'Sem descrição'
  let res = desc.replace(/\s*\(Total:\s*R\$[^)]+\)\s*$/i, '').trim()
  res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
  return res || 'Sem descrição'
}

/**
 * Helper to resolve installment number and total for a transaction
 */
export function resolveInstallmentInfo(tx: any): {
  installmentNumber: number
  installmentTotal: number
} {
  if (!tx) return { installmentNumber: 1, installmentTotal: 1 }
  let num = Number(tx.installment_number || 0)
  let total = Number(
    tx.installments_total || tx.installment_total || (tx as any).installments_total || 0,
  )

  if ((!num || !total || total <= 1) && tx.description) {
    const match = String(tx.description).match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/)
    if (match) {
      if (!num) num = parseInt(match[1], 10)
      if (!total || total <= 1) total = parseInt(match[2], 10)
    }
  }

  if (num <= 0) num = 1
  if (total <= 0) total = 1

  return { installmentNumber: num, installmentTotal: total }
}

/**
 * Helper to check if a transaction is an installment
 */
export function isInstallmentTransaction(transaction: Transaction): boolean {
  if (!transaction) return false
  const effectiveParentId =
    transaction.parent_transaction_id && transaction.parent_transaction_id !== transaction.id
      ? transaction.parent_transaction_id
      : ''
  const isRec = Boolean(
    transaction.is_recurring ||
    transaction.recurring ||
    Boolean(transaction.recurrence_type && transaction.recurrence_type.trim().length > 0) ||
    Boolean(
      (transaction as any).recurrence_period &&
      (transaction as any).recurrence_period.trim().length > 0,
    ),
  )
  const total = Number(
    transaction.installments_total ||
      transaction.installment_total ||
      (transaction as any).installments_total ||
      0,
  )
  const num = Number(transaction.installment_number || 0)
  const hasInstallmentPattern = /\(\s*\d+\s*\/\s*\d+\s*\)/.test(transaction.description || '')

  // Se tiver indício explícito de recorrência e não for claramente uma parcela (ex: total <= 1 e sem sufixo x/y)
  if (isRec && total <= 1 && !hasInstallmentPattern) {
    return false
  }

  return Boolean(effectiveParentId || (num > 0 && total > 1) || total > 1 || hasInstallmentPattern)
}

/**
 * Helper to check if a transaction is recurring
 */
export function isRecurringTransaction(transaction: Transaction): boolean {
  if (!transaction) return false
  const hasRecFlag = Boolean(
    transaction.is_recurring ||
    transaction.recurring ||
    Boolean(transaction.recurrence_type && transaction.recurrence_type.trim().length > 0) ||
    Boolean(
      (transaction as any).recurrence_period &&
      (transaction as any).recurrence_period.trim().length > 0,
    ),
  )
  if (!hasRecFlag) return false
  // Não pode ser pai consolidado nem parcela de compra parcelada
  const total = Number(
    transaction.installments_total ||
      transaction.installment_total ||
      (transaction as any).installments_total ||
      0,
  )
  const num = Number(transaction.installment_number || 0)
  if (total > 1 || (num > 0 && /\(\s*\d+\s*\/\s*\d+\s*\)/.test(transaction.description || ''))) {
    return false
  }
  return true
}

/**
 * Normaliza data YYYY-MM-DD para comparação confiável
 */
function normalizeDateStr(dateStr?: string): string {
  if (!dateStr) return ''
  return dateStr.split(/[T\s]/)[0]
}

/**
 * Find sibling transactions belonging to an installment group.
 * Identifica o grupo completo, incluindo:
 * 1. Parcelas filhas (installment_number >= 1)
 * 2. Registro pai consolidado (installment_number = 0 && installment_total > 0), se houver
 */
export function findInstallmentGroup(
  transaction: Transaction,
  allTransactions: Transaction[],
): Transaction[] {
  const sourceCleanDesc = cleanDescription(transaction.description || '').toLowerCase()
  const sourceAccountId = transaction.account_id || ''
  const rawParentId = transaction.parent_transaction_id || ''
  const effectiveParentId =
    rawParentId && rawParentId !== transaction.id
      ? rawParentId
      : isParentTransaction(transaction)
        ? transaction.id
        : ''
  const { installmentTotal: sourceTotal } = resolveInstallmentInfo(transaction)

  // 1. Se soubermos o parentId efetivo, filtramos por ele (filhas com parent_transaction_id == parentId OU pai com id == parentId)
  if (effectiveParentId) {
    const group = allTransactions.filter((t) => {
      if (transaction.control_id && t.control_id && t.control_id !== transaction.control_id) {
        return false
      }
      if (t.id === effectiveParentId) return true
      if (t.parent_transaction_id && t.parent_transaction_id === effectiveParentId) return true
      return false
    })

    if (group.length > 0) {
      return sortInstallmentGroup(group)
    }
  }

  // 2. Se a transação não tem parent_transaction_id, procurar se há um pai consolidado
  const matchedParent = allTransactions.find((t) => {
    if (transaction.control_id && t.control_id && t.control_id !== transaction.control_id) {
      return false
    }
    const { installmentNumber, installmentTotal } = resolveInstallmentInfo(t)
    return (
      (installmentNumber === 0 || isParentTransaction(t)) &&
      installmentTotal === sourceTotal &&
      t.type === transaction.type &&
      (t.account_id || '') === sourceAccountId &&
      cleanDescription(t.description || '').toLowerCase() === sourceCleanDesc
    )
  })

  if (matchedParent) {
    const parentId = matchedParent.id
    const group = allTransactions.filter((t) => {
      if (transaction.control_id && t.control_id && t.control_id !== transaction.control_id) {
        return false
      }
      if (t.id === parentId) return true
      if (t.parent_transaction_id && t.parent_transaction_id === parentId) return true
      return false
    })
    if (group.length > 0) {
      return sortInstallmentGroup(group)
    }
  }

  // 3. Fallback: agrupar por tipo, conta, total de parcelas e descrição base limpa
  const group = allTransactions.filter((t) => {
    if (transaction.control_id && t.control_id && t.control_id !== transaction.control_id) {
      return false
    }
    // Sempre inclui a transação original
    if (t.id === transaction.id) return true

    // Se o item aponta para OUTRO parent_transaction_id explícito (não self-parenting), não agrupa
    const tEffectiveParent =
      t.parent_transaction_id && t.parent_transaction_id !== t.id ? t.parent_transaction_id : ''
    if (tEffectiveParent && effectiveParentId && tEffectiveParent !== effectiveParentId) {
      return false
    }

    const { installmentTotal } = resolveInstallmentInfo(t)
    const matchesTotal =
      installmentTotal === sourceTotal || (sourceTotal <= 1 && installmentTotal > 1)
    const matchesAccount = !sourceAccountId || !t.account_id || t.account_id === sourceAccountId
    const matchesType = t.type === transaction.type
    const matchesDesc = cleanDescription(t.description || '').toLowerCase() === sourceCleanDesc

    return matchesTotal && matchesAccount && matchesType && matchesDesc
  })

  return sortInstallmentGroup(group)
}

function sortInstallmentGroup(group: Transaction[]): Transaction[] {
  const sorted = [...group]
  sorted.sort((a, b) => {
    const isParentA = isParentTransaction(a)
    const isParentB = isParentTransaction(b)
    if (isParentA && !isParentB) return -1
    if (!isParentA && isParentB) return 1

    const numA = a.installment_number || 0
    const numB = b.installment_number || 0
    if (numA !== numB) return numA - numB

    const dateA = normalizeDateStr(a.date)
    const dateB = normalizeDateStr(b.date)
    return dateA.localeCompare(dateB)
  })
  return sorted
}

/**
 * Find transactions belonging to a recurring series.
 * Identifica a série canônica por: tipo + conta + descrição base limpa (NÃO por valor).
 */
export function findRecurringSeries(
  transaction: Transaction,
  allTransactions: Transaction[],
): Transaction[] {
  const rawSourceDesc = (transaction.description || '').trim()
  const cleanSourceDesc = cleanDescription(transaction.description || '')
    .trim()
    .toLowerCase()
  const isGenericDesc =
    !cleanSourceDesc || cleanSourceDesc === 'sem descrição' || cleanSourceDesc === 'sem descricao'

  const currentType = transaction.type
  const currentAccountId = transaction.account_id || ''
  const currentCategoryId = transaction.category_id || ''
  const currentSubcategoryId = transaction.subcategory_id || ''

  // 1. Se houver vínculo explícito de recorrência (parent_transaction_id), usar prioridade máxima
  const rawParentId = transaction.parent_transaction_id || ''
  const effectiveParentId = rawParentId && rawParentId !== transaction.id ? rawParentId : ''

  if (effectiveParentId) {
    const linked = allTransactions.filter((t) => {
      if (transaction.control_id && t.control_id && t.control_id !== transaction.control_id) {
        return false
      }
      if (t.id === transaction.id) return true
      if (t.type !== currentType) return false
      return t.id === effectiveParentId || t.parent_transaction_id === effectiveParentId
    })
    if (linked.length > 0) {
      linked.sort((a, b) => normalizeDateStr(a.date).localeCompare(normalizeDateStr(b.date)))
      return linked
    }
  }

  // 2. Se a descrição for genérica ("Sem descrição" ou vazia) e não houver vínculo explícito,
  // lançamentos de mesmo valor ou de mesma conta NÃO formam uma série compartilhada de recorrência,
  // pois são despesas/receitas independentes. Retorna somente a transação atual.
  if (isGenericDesc) {
    return [transaction]
  }

  const series = allTransactions.filter((t) => {
    if (transaction.control_id && t.control_id && t.control_id !== transaction.control_id) {
      return false
    }
    // A transação original é sempre incluída
    if (t.id === transaction.id) return true
    // Deve ser do mesmo tipo (receita / despesa)
    if (t.type !== currentType) return false

    // Não pode ser pai consolidado nem parcela de compra parcelada
    const instTotal = Number(
      t.installments_total || t.installment_total || (t as any).installments_total || 0,
    )
    const instNum = Number(t.installment_number || 0)
    if (
      isParentTransaction(t) ||
      instTotal > 1 ||
      (instNum > 0 && /\(\s*\d+\s*\/\s*\d+\s*\)/.test(t.description || ''))
    ) {
      return false
    }

    // Deve ser uma transação recorrente
    const isRec = Boolean(
      t.is_recurring ||
      t.recurring ||
      (t.recurrence_type && t.recurrence_type.trim() !== '') ||
      Boolean((t as any).recurrence_period && (t as any).recurrence_period.trim() !== ''),
    )
    if (!isRec) return false

    // Mesma conta (se ambas tiverem conta definida)
    if (currentAccountId && t.account_id && t.account_id !== currentAccountId) {
      return false
    }

    // Se ambas tiverem categoria definida, devem coincidir
    if (currentCategoryId && t.category_id && t.category_id !== currentCategoryId) {
      return false
    }

    // Se ambas tiverem subcategoria definida, devem coincidir
    if (currentSubcategoryId && t.subcategory_id && t.subcategory_id !== currentSubcategoryId) {
      return false
    }

    const itemCleanDesc = cleanDescription(t.description || '')
      .trim()
      .toLowerCase()
    return itemCleanDesc === cleanSourceDesc
  })

  series.sort((a, b) => {
    const dateA = normalizeDateStr(a.date)
    const dateB = normalizeDateStr(b.date)
    return dateA.localeCompare(dateB)
  })
  return series
}

/**
 * Retorna a lista de transações a excluir conforme a opção de propagação (somente esse, este e os próximos, todos)
 */
export function resolvePropagationTargets({
  transaction,
  allTransactions,
  choice = 'single',
}: {
  transaction: Transaction
  allTransactions: Transaction[]
  choice?: PropagationChoice
}): Transaction[] {
  const isInstallment = isInstallmentTransaction(transaction)
  const isRecurring = isRecurringTransaction(transaction)

  // Standalone single transaction ou o usuário escolheu 'single'
  if ((!isInstallment && !isRecurring) || choice === 'single') {
    return [transaction]
  }

  // INSTALLMENT
  if (isInstallment) {
    const group = findInstallmentGroup(transaction, allTransactions)
    const currentNum = transaction.installment_number || 1
    const currentDate = normalizeDateStr(transaction.date)

    if (choice === 'all') {
      // "Todos": todas as parcelas e o registro pai consolidado
      return group.length > 0 ? group : [transaction]
    }

    if (choice === 'future') {
      // "Esse e os próximos": parcelas com número >= número atual (ou data >= data atual se num for 0)
      // O registro pai NÃO é excluído em "future" porque as parcelas passadas continuam existindo
      const futureTargets = group.filter((t) => {
        if (isParentTransaction(t)) return false
        const tNum = t.installment_number || 0
        if (tNum > 0 && currentNum > 0) {
          return tNum >= currentNum
        }
        const tDate = normalizeDateStr(t.date)
        return tDate >= currentDate
      })
      return futureTargets.length > 0 ? futureTargets : [transaction]
    }
  }

  // RECURRING
  if (isRecurring) {
    const series = findRecurringSeries(transaction, allTransactions)
    const currentDate = normalizeDateStr(transaction.date)

    if (choice === 'all') {
      return series.length > 0 ? series : [transaction]
    }

    if (choice === 'future') {
      const futureTargets = series.filter((t) => {
        const tDate = normalizeDateStr(t.date)
        return tDate >= currentDate
      })
      return futureTargets.length > 0 ? futureTargets : [transaction]
    }
  }

  return [transaction]
}

/**
 * Handle deleting a transaction with propagation support for installments and recurring items.
 * Retorna os IDs das transações excluídas para permitir atualização otimista precisa na UI.
 */
export async function deleteTransactionWithPropagation({
  transaction,
  allTransactions,
  choice = 'single',
}: {
  transaction: Transaction
  allTransactions: Transaction[]
  choice?: PropagationChoice
}): Promise<{ deletedIds: string[] }> {
  const targetsToDelete = resolvePropagationTargets({
    transaction,
    allTransactions,
    choice,
  })

  const targetIds = Array.from(new Set(targetsToDelete.map((t) => t.id).filter(Boolean)))
  if (targetIds.length === 0) {
    return { deletedIds: [] }
  }

  const affectedAccountIds = Array.from(
    new Set(targetsToDelete.map((t) => t.account_id).filter(Boolean)),
  )

  // Single transaction rápida
  if (targetIds.length === 1) {
    await executeWithRetry(() => skipCloud.deleteTransaction(targetIds[0]), 5, 1000, 'DELETE_TX')
    return { deletedIds: targetIds }
  }

  // Exclusão em pool resiliente com limite de concorrência e retry contra 429
  await runInPool(
    targetsToDelete,
    async (item) => {
      await skipCloud.deleteTransaction(item.id, true)
    },
    { concurrency: 4, delayBetweenBatchesMs: 25, tag: 'DELETE_PROPAGATION_POOL' },
  )

  // Recalcula o saldo das contas afetadas UMA ÚNICA VEZ ao final
  if (affectedAccountIds.length > 0) {
    await skipCloud.recomputeAccountsBalances(affectedAccountIds)
  }

  return { deletedIds: targetIds }
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
  const isRecurring =
    isRecurringTransaction(transaction) ||
    Boolean(
      formData.is_recurring || (formData.recurrence_type && formData.recurrence_type.trim() !== ''),
    )
  const isInstallment = !isRecurring && isInstallmentTransaction(transaction)

  // If it's a simple standalone transaction or choice is 'single'
  if ((!isInstallment && !isRecurring) || choice === 'single') {
    // Preservar recorrência caso o registro original já fosse recorrente no banco
    // e o usuário não tenha explicitamente alterado para outra coisa em edição individual
    const effectiveIsRecurring = Boolean(
      formData.is_recurring ||
      (formData.recurrence_type && formData.recurrence_type.trim() !== '') ||
      isRecurringTransaction(transaction),
    )
    const effectiveRecurrenceType = effectiveIsRecurring
      ? formData.recurrence_type || transaction.recurrence_type || 'mensal'
      : undefined

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
      is_recurring: effectiveIsRecurring,
      recurrence_type: effectiveRecurrenceType,
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
  const parentId =
    transaction.parent_transaction_id && transaction.parent_transaction_id !== transaction.id
      ? transaction.parent_transaction_id
      : ''
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
      let itemPaymentDate = item.payment_date || item.date

      if (item.id === transaction.id) {
        itemDate = formData.date
        itemPaymentDate = formData.payment_date || formData.date
      } else if (choice === 'all') {
        const diffMonths = (item.installment_number || 1) - currentNum
        itemDate = addMonths(formData.date, diffMonths)
        itemPaymentDate = addMonths(formData.payment_date || formData.date, diffMonths)
      } else {
        // Quando choice === 'future', se o dia do lançamento foi alterado, preservar o ano/mês original da parcela
        // ajustando apenas o dia, ou manter item.date se a data não foi deslocada.
        const origTxParts = parseDateParts(transaction.date)
        const formTxParts = parseDateParts(formData.date)
        const dayChanged = origTxParts.day !== formTxParts.day
        if (dayChanged) {
          const itemParts = parseDateParts(item.date)
          itemDate = computeTargetDate(itemParts.year, itemParts.month, formTxParts.day, 0)
        }
        if (formData.payment_date && transaction.payment_date) {
          const origPayParts = parseDateParts(transaction.payment_date)
          const formPayParts = parseDateParts(formData.payment_date)
          if (origPayParts.day !== formPayParts.day && item.payment_date) {
            const itemPayParts = parseDateParts(item.payment_date)
            itemPaymentDate = computeTargetDate(
              itemPayParts.year,
              itemPayParts.month,
              formPayParts.day,
              0,
            )
          }
        }
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

  // 3. Handle changing the number of installments (increase or decrease) OR creating missing future installments
  // Regra 1: "Todos" -> Não criar novos lançamentos — exceto se o usuário AUMENTOU o número de parcelas (nesse caso criar as parcelas extras).
  // Só excluir parcelas se o usuário DIMINUIU o número de parcelas.
  // Regra 3: "Este e os próximos" -> Só criar novos lançamentos caso não existam lançamentos vinculados futuros (ex: parcelas da série ainda não geradas).
  const isIncrease = newTotal > oldTotal
  const isDecrease = newTotal < oldTotal

  if (isIncrease || (choice === 'future' && newTotal > 1)) {
    // Verificar quais números de parcelas futuras (de currentNum + 1 até newTotal) não existem
    const existingNums = new Set(group.map((t) => t.installment_number || 0).filter((n) => n > 0))
    existingNums.add(currentNum)

    // Se a opção for 'all', criamos apenas se o usuário aumentou o total (de oldTotal + 1 até newTotal)
    // Se a opção for 'future', criamos as parcelas faltantes de currentNum + 1 até newTotal
    const missingIndexes: number[] = []
    const startCheckNum = choice === 'future' ? currentNum + 1 : oldTotal + 1
    for (let i = startCheckNum; i <= newTotal; i++) {
      if (!existingNums.has(i)) {
        missingIndexes.push(i)
      }
    }

    if (missingIndexes.length > 0) {
      const userId = transaction.user_id || (pb.authStore.model as any)?.id || ''
      const baseDate = formData.date

      const newlyCreated = await runInPool(
        missingIndexes,
        async (i) => {
          const diffMonths = i - currentNum
          const parcelDate = addMonths(baseDate, diffMonths)
          const parcelDesc = `${newBaseDesc} (${i}/${newTotal})`

          const payload: Record<string, any> = {
            control_id: transaction.control_id,
            type: formData.type,
            amount: formData.amount,
            description: parcelDesc,
            date: parcelDate,
            payment_date: addMonths(formData.payment_date || formData.date, diffMonths),
            paid: false, // Future created parcels default to pending
            is_recurring: false,
            installments_total: newTotal,
            installment_total: newTotal,
            installment_number: i,
          }

          if (userId && userId.trim() !== '') {
            payload.user_id = userId.trim()
          }
          if (formData.category_id && formData.category_id.trim() !== '') {
            payload.category_id = formData.category_id.trim()
          }
          if (formData.subcategory_id && formData.subcategory_id.trim() !== '') {
            payload.subcategory_id = formData.subcategory_id.trim()
          }
          if (formData.account_id && formData.account_id.trim() !== '') {
            payload.account_id = formData.account_id.trim()
          }
          if (parentId && parentId.trim() !== '') {
            payload.parent_transaction_id = parentId.trim()
          }
          if (formData.notes && formData.notes.trim() !== '') {
            payload.notes = formData.notes.trim()
          }

          const rec = await executeWithRetry(
            () => pb.collection('transactions').create(payload),
            7,
            1000,
            'CREATE_INSTALLMENT',
            30000,
          )
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
            date: rec.date ? String(rec.date).split(/[T\s]/)[0] : parcelDate,
            payment_date: rec.payment_date
              ? String(rec.payment_date).split(/[T\s]/)[0]
              : addMonths(formData.payment_date || formData.date, diffMonths),
            paid: false,
            is_recurring: false,
            recurrence_type: undefined,
            installment_number: rec.installment_number || i,
            installments_total: rec.installment_total || rec.installments_total || newTotal,
            parent_transaction_id: rec.parent_transaction_id || parentId,
            notes: rec.notes,
            created_at: rec.created,
          } as Transaction
        },
        { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'CREATE_INSTALLMENT' },
      )
      createdItems.push(...newlyCreated)
    }
  }

  if (isDecrease) {
    // Só excluir parcelas se o usuário DIMINUIU o número de parcelas (Regra 1)
    // Exceeding installments to remove (e.g. reduced from 10 to 6 -> delete 7, 8, 9, 10)
    const excessItems = group.filter((t) => (t.installment_number || 0) > newTotal)
    excessItems.forEach((excess) => {
      affectedAccountIds.add(excess.account_id)
      deletedIds.push(excess.id)
    })

    if (excessItems.length > 0) {
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
    // Regra 1: "Todos" -> atualizar TODOS os lançamentos referentes ao mexido, SOMENTE isso. Não criar novos.
    targetsToUpdate = series.length > 0 ? series : [transaction]
  } else if (choice === 'future') {
    // Regra 3: "Este e os próximos" -> atualizar os dados dos lançamentos futuros referentes ao mexido.
    // Só criar novos lançamentos caso não existam lançamentos vinculados futuros.
    const currentDate = normalizeDateStr(transaction.date)
    targetsToUpdate = series.filter((t) => normalizeDateStr(t.date) >= currentDate)
    if (targetsToUpdate.length === 0) targetsToUpdate = [transaction]
  }

  const affectedAccountIds = new Set<string>()
  affectedAccountIds.add(formData.account_id)
  targetsToUpdate.forEach((t) => affectedAccountIds.add(t.account_id))

  // Preservar as datas reais das outras ocorrências mensais da série recorrente.
  // Se o usuário alterou o dia da data (ex: mudou de dia 10 para dia 15), ajusta apenas o dia
  // mantendo o ano e o mês de cada ocorrência futura respectiva (com limite no último dia do mês).
  const origTxDateParts = parseDateParts(transaction.date)
  const newTxDateParts = parseDateParts(formData.date)
  const dayChanged = origTxDateParts.day !== newTxDateParts.day

  const origPayDateParts = transaction.payment_date
    ? parseDateParts(transaction.payment_date)
    : null
  const newPayDateParts = formData.payment_date ? parseDateParts(formData.payment_date) : null
  const payDayChanged =
    origPayDateParts && newPayDateParts && origPayDateParts.day !== newPayDateParts.day

  // Determina a recorrência efetiva da série / formulário para evitar que uma edição
  // apague a recorrência de um registro que já era recorrente no banco.
  const isEffectiveRecurring = Boolean(
    formData.is_recurring ||
    (formData.recurrence_type && formData.recurrence_type.trim() !== '') ||
    isRecurringTransaction(transaction),
  )
  const effectiveRecurrenceType: RecurrenceType = isEffectiveRecurring
    ? formData.recurrence_type || transaction.recurrence_type || 'mensal'
    : 'mensal'

  // Update in controlled concurrent pool (concurrency = 4)
  const updatedItems = await runInPool(
    targetsToUpdate,
    async (item) => {
      let targetDate = item.date
      let targetPaymentDate = item.payment_date || item.date

      if (item.id === transaction.id) {
        targetDate = formData.date
        targetPaymentDate = formData.payment_date || formData.date
      } else {
        if (dayChanged) {
          const itemParts = parseDateParts(item.date)
          targetDate = computeTargetDate(itemParts.year, itemParts.month, newTxDateParts.day, 0)
        }
        if (payDayChanged && item.payment_date) {
          const itemPayParts = parseDateParts(item.payment_date)
          targetPaymentDate = computeTargetDate(
            itemPayParts.year,
            itemPayParts.month,
            newPayDateParts!.day,
            0,
          )
        }
      }

      // Preservar a recorrência: se a série/transação ou o form for recorrente, nunca desmarcar
      const itemIsRecurring = isEffectiveRecurring || isRecurringTransaction(item)
      const itemRecurrenceType = itemIsRecurring
        ? effectiveRecurrenceType || item.recurrence_type || 'mensal'
        : undefined

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
          is_recurring: itemIsRecurring,
          recurrence_type: itemRecurrenceType,
        },
        true, // skip per-request balance update
      )
    },
    { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'UPDATE_RECURRING' },
  )

  const createdItems: Transaction[] = []

  // Regra 3 (continuação): Para a opção "Este e os próximos", só criar novos lançamentos caso não existam
  // lançamentos vinculados futuros (ex.: meses da janela de recorrência ainda sem ocorrência).
  // Se a opção for 'all', NUNCA criar novos lançamentos (Regra 1: "Não criar novos lançamentos").
  // Se o lançamento for recorrente (ou marcado como recorrente no form), projetar suas ocorrências futuras.
  // Mesmo quando a descrição for genérica ("Sem descrição"), o lançamento editado em si ainda deve gerar
  // suas próprias ocorrências futuras faltantes (ele não agrupa outras independentes, mas gera as suas).
  const cleanDesc = cleanDescription(formData.description).trim()
  const effectiveDescription = formData.description?.trim() || cleanDesc || 'Sem descrição'
  const isGenericFormDesc =
    !cleanDesc ||
    cleanDesc.toLowerCase() === 'sem descrição' ||
    cleanDesc.toLowerCase() === 'sem descricao'

  const effectiveParentId =
    transaction.parent_transaction_id && transaction.parent_transaction_id !== transaction.id
      ? transaction.parent_transaction_id
      : ''

  const shouldProjectFuture =
    choice === 'future' && isEffectiveRecurring && (!isGenericFormDesc || isEffectiveRecurring)

  console.info('[handleRecurringPropagation] Gate de criação de meses futuros:', {
    choice,
    isEffectiveRecurring,
    isGenericFormDesc,
    shouldProjectFuture,
    txId: transaction.id,
    description: effectiveDescription,
  })

  if (shouldProjectFuture) {
    // Identificar meses existentes nesta série
    // Montamos conjunto com todas as transações da série (incluindo as já atualizadas)
    const existingSeriesMonths = new Set<string>()
    for (const t of series) {
      if (t.date) existingSeriesMonths.add(normalizeDateStr(t.date).substring(0, 7))
    }

    // Garantir que o mês do formData.date, o mês original de transaction.date E o mês do relógio atual estejam registrados
    // no conjunto existingSeriesMonths antes do loop de preenchimento de meses futuros.
    const formYM = normalizeDateStr(formData.date).substring(0, 7)
    const origYM = normalizeDateStr(transaction.date).substring(0, 7)
    const todayYM = new Date().toISOString().substring(0, 7)

    if (formYM) existingSeriesMonths.add(formYM)
    if (origYM) existingSeriesMonths.add(origYM)

    const updatedTxDateParts = parseDateParts(formData.date)
    const baseYear = updatedTxDateParts.year
    const baseMonth = updatedTxDateParts.month
    const origDay = updatedTxDateParts.day

    // Blindagem (v0.0.93): O mês do lançamento editado (formYM), o mês original (origYM) e o mês atual
    // do calendário JAMAIS podem receber novas ocorrências.
    // Lançamentos novos são criados rigorosamente a partir do mês seguinte ao do lançamento editado (e nunca no mês atual nem passados).
    let minAllowedYM = formYM
    if (origYM > minAllowedYM) minAllowedYM = origYM
    if (todayYM > minAllowedYM) minAllowedYM = todayYM

    const userId =
      transaction.user_id || (pb.authStore.model as any)?.id || (formData as any)?.user_id || ''

    // Planejar apenas os meses faltantes na janela de 12 meses
    const missingCandidates: any[] = []
    for (let m = 1; m <= 12; m++) {
      const targetDateStr = computeTargetDate(baseYear, baseMonth, origDay, m)
      const targetYM = targetDateStr.substring(0, 7)

      // Bloqueio explícito: nunca criar no mês do lançamento ou mês atual ou qualquer mês anterior
      if (targetYM <= minAllowedYM) {
        continue
      }

      if (existingSeriesMonths.has(targetYM)) {
        continue
      }
      existingSeriesMonths.add(targetYM)

      let calcPaymentDate = targetDateStr.split(/[T\s]/)[0]
      if (formData.payment_date) {
        const payParts = parseDateParts(formData.payment_date)
        calcPaymentDate = computeTargetDate(payParts.year, payParts.month, payParts.day, m).split(
          /[T\s]/,
        )[0]
      }

      missingCandidates.push({
        control_id: transaction.control_id,
        user_id: userId,
        type: formData.type,
        amount: formData.amount,
        description: effectiveDescription,
        category_id: formData.category_id || '',
        subcategory_id: formData.subcategory_id || '',
        account_id: formData.account_id,
        date: targetDateStr,
        payment_date: calcPaymentDate,
        paid: false,
        is_recurring: true,
        recurrence_type: effectiveRecurrenceType,
        parent_transaction_id: effectiveParentId || undefined,
        notes: formData.notes?.trim() || 'Gerado automaticamente: recorrência mensal',
      })
    }

    if (missingCandidates.length > 0) {
      // Antes de criar qualquer ocorrência nova, verificar contra TODAS as transações do controle
      // se já existe ocorrência vinculada (por parent_transaction_id ou tipo + conta + descrição base + categoria + ano-mês).
      // Se a descrição for genérica, NUNCA agrupar transações independentes por valor nem por categoria;
      // apenas atualiza se houver vínculo explícito de parent_transaction_id.
      const normalizedDesc = cleanDesc.toLowerCase()
      const candidatesToCreate: any[] = []

      for (const candidate of missingCandidates) {
        const candidateYM = candidate.date.substring(0, 7)
        const existingTxInControl = allTransactions.find((t) => {
          if (transaction.control_id && t.control_id && t.control_id !== transaction.control_id) {
            return false
          }
          if (t.type !== candidate.type) return false
          const tYM = normalizeDateStr(t.date).substring(0, 7)
          if (tYM !== candidateYM) return false

          // Vínculo explícito tem precedência total
          if (effectiveParentId && t.parent_transaction_id === effectiveParentId) {
            return true
          }

          // Se a descrição for genérica e não tiver vínculo explícito, NÃO agrupa com outras
          // despesas independentes para evitar alterar lançamentos de outros gastos da mesma conta/mês
          if (isGenericFormDesc) {
            return false
          }

          if ((t.account_id || '') !== (candidate.account_id || '')) return false
          if (candidate.category_id && t.category_id && t.category_id !== candidate.category_id) {
            return false
          }
          const tCleanDesc = cleanDescription(t.description || '')
            .trim()
            .toLowerCase()
          return tCleanDesc === normalizedDesc
        })

        if (existingTxInControl) {
          // Atualizar o registro existente em vez de criar duplicata
          const updatedExisting = await skipCloud.updateTransaction(
            existingTxInControl.id,
            {
              description: candidate.description,
              amount: candidate.amount,
              type: candidate.type,
              account_id: candidate.account_id,
              category_id: candidate.category_id,
              subcategory_id: candidate.subcategory_id || '',
              date: candidate.date,
              payment_date: candidate.payment_date,
              notes: candidate.notes,
              is_recurring: true,
              recurrence_type: candidate.recurrence_type,
            },
            true,
          )
          updatedItems.push(updatedExisting)
        } else {
          candidatesToCreate.push(candidate)
        }
      }

      if (candidatesToCreate.length > 0) {
        // Sanitizar payload para o PocketBase:
        // - Relações vazias omitidas (category_id, subcategory_id, account_id, parent_transaction_id)
        // - user_id só enviado se não for vazio
        // - payment_date nunca vazio (cai para date)
        // - Execução com retry anti-429 resiliente
        const newlyCreated = await runInPool(
          candidatesToCreate,
          async (candidate) => {
            const payload: Record<string, any> = {
              control_id: candidate.control_id,
              type: candidate.type,
              amount: candidate.amount,
              description: candidate.description,
              date: candidate.date,
              payment_date: candidate.payment_date || candidate.date,
              paid: false,
              is_recurring: true,
              recurrence_type: candidate.recurrence_type || effectiveRecurrenceType || 'mensal',
            }

            if (candidate.user_id && candidate.user_id.trim() !== '') {
              payload.user_id = candidate.user_id.trim()
            }
            if (candidate.category_id && candidate.category_id.trim() !== '') {
              payload.category_id = candidate.category_id.trim()
            }
            if (candidate.subcategory_id && candidate.subcategory_id.trim() !== '') {
              payload.subcategory_id = candidate.subcategory_id.trim()
            }
            if (candidate.account_id && candidate.account_id.trim() !== '') {
              payload.account_id = candidate.account_id.trim()
            }
            if (candidate.parent_transaction_id && candidate.parent_transaction_id.trim() !== '') {
              payload.parent_transaction_id = candidate.parent_transaction_id.trim()
            }
            if (candidate.notes && candidate.notes.trim() !== '') {
              payload.notes = candidate.notes.trim()
            }

            const rec = await executeWithRetry(
              () => pb.collection('transactions').create(payload),
              7,
              1000,
              'CREATE_MISSING_RECURRING',
              30000,
            )

            const mapped: Transaction = {
              id: rec.id,
              control_id: rec.control_id || candidate.control_id,
              user_id: rec.user_id || candidate.user_id,
              type: rec.type,
              amount: Number(rec.amount),
              description: rec.description,
              category_id: rec.category_id || '',
              subcategory_id: rec.subcategory_id || undefined,
              account_id: rec.account_id || '',
              date: rec.date
                ? String(rec.date).split(/[T\s]/)[0]
                : candidate.date.split(/[T\s]/)[0],
              payment_date: rec.payment_date
                ? String(rec.payment_date).split(/[T\s]/)[0]
                : candidate.payment_date,
              paid: false,
              is_recurring: true,
              recurrence_type: rec.recurrence_type,
              notes: rec.notes || undefined,
              created_at: rec.created || new Date().toISOString(),
            }
            return mapped
          },
          {
            concurrency: 2,
            delayBetweenBatchesMs: 200,
            maxRetries: 7,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            tag: 'CREATE_MISSING_RECURRING',
          },
        )
        createdItems.push(...newlyCreated)
      }
    }
  }

  // Recompute balance once at end for all affected accounts
  await skipCloud.recomputeAccountsBalances(Array.from(affectedAccountIds))

  return { updated: updatedItems, created: createdItems, deletedIds: [] }
}
