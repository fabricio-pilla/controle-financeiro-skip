import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useCompany } from '@/contexts/CompanyContext'
import { Transaction, TransactionType, RecurrenceType, Account } from '@/types/database'
import { toast } from 'sonner'
import {
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Tag,
  Wallet,
  CreditCard,
  Package,
  Repeat,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { calculatePaymentDate } from '@/lib/invoice-helper'
import { RecurrencePropagationModal, PropagationChoice } from './RecurrencePropagationModal'
import {
  updateTransactionWithPropagation,
  UpdateTransactionPayload,
  isRecurringTransaction,
} from '@/lib/transaction-propagation'
import { isCategoryAllowedForType } from '@/lib/nlp-parser'

interface TransactionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  defaultType?: TransactionType
}

export function TransactionModal({
  open,
  onOpenChange,
  transaction,
  defaultType = 'despesa',
}: TransactionModalProps) {
  const {
    currentCompany,
    accounts,
    categories,
    subcategories,
    transactions,
    createTransaction,
    updateTransaction,
    applyTransactionsBatchUpdate,
    reloadCompanyData,
  } = useCompany()

  const isEditing = Boolean(transaction)
  const isInstallment = Boolean(
    transaction &&
    ((transaction.parent_transaction_id && transaction.parent_transaction_id !== transaction.id) ||
      (transaction.installment_number &&
        transaction.installment_number > 0 &&
        (transaction.installments_total || 0) > 1)),
  )
  const parentTransaction = React.useMemo(() => {
    if (!transaction?.parent_transaction_id || transaction.parent_transaction_id === transaction.id)
      return null
    return transactions.find((t) => t.id === transaction.parent_transaction_id) || null
  }, [transaction, transactions])

  // Helper to resolve effective total installments from transaction, description or parent
  const resolvedInstallmentsTotal = React.useMemo(() => {
    if (!transaction) return 1
    if (transaction.installments_total && transaction.installments_total > 1) {
      return transaction.installments_total
    }
    // Try extract from description (e.g. "Emprestimo (7/10)")
    const match = transaction.description?.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/)
    if (match) {
      const tot = parseInt(match[2], 10)
      if (tot > 1) return tot
    }
    // Try check parent transaction
    if (parentTransaction?.installments_total && parentTransaction.installments_total > 1) {
      return parentTransaction.installments_total
    }
    // Fallback if it's installment number > 1
    if (transaction.installment_number && transaction.installment_number > 1) {
      return transaction.installment_number
    }
    return 1
  }, [transaction, parentTransaction])

  // Resolved current installment number
  const resolvedInstallmentNumber = React.useMemo(() => {
    if (!transaction) return 1
    if (transaction.installment_number && transaction.installment_number > 0) {
      return transaction.installment_number
    }
    const match = transaction.description?.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > 0) return num
    }
    return 1
  }, [transaction])

  // Conta principal/padrão do controle (fallback em todos os cenários)
  const primaryAccount = useMemo(
    () => accounts.find((a) => a.is_primary) || accounts[0] || null,
    [accounts],
  )

  const [type, setType] = useState<TransactionType>(transaction?.type || defaultType)
  const [description, setDescription] = useState(transaction?.description || '')
  const [amountStr, setAmountStr] = useState(transaction ? String(transaction.amount) : '')
  const [accountId, setAccountId] = useState(transaction?.account_id || primaryAccount?.id || '')
  const [categoryId, setCategoryId] = useState(transaction?.category_id || '')
  const [subcategoryId, setSubcategoryId] = useState(transaction?.subcategory_id || '')
  const [date, setDate] = useState(transaction?.date || new Date().toISOString().split('T')[0])
  const [paymentDate, setPaymentDate] = useState(
    transaction?.payment_date || transaction?.date || new Date().toISOString().split('T')[0],
  )
  const [isRecurring, setIsRecurring] = useState(
    transaction ? isRecurringTransaction(transaction) : false,
  )
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    transaction?.recurrence_type || 'mensal',
  )
  const [notes, setNotes] = useState(transaction?.notes || '')
  const [installmentsTotal, setInstallmentsTotal] = useState(resolvedInstallmentsTotal)
  const [propagationModalOpen, setPropagationModalOpen] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<UpdateTransactionPayload | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync when transaction changes
  React.useEffect(() => {
    if (transaction) {
      setType(transaction.type)
      setDescription(transaction.description)
      setAmountStr(String(transaction.amount))
      setAccountId(transaction.account_id)
      setCategoryId(transaction.category_id)
      setSubcategoryId(transaction.subcategory_id || '')
      setDate(transaction.date)
      setPaymentDate(transaction.payment_date || transaction.date)
      setIsRecurring(isRecurringTransaction(transaction))
      setRecurrenceType(transaction.recurrence_type || 'mensal')
      setNotes(transaction.notes || '')
      setInstallmentsTotal(resolvedInstallmentsTotal)
    } else {
      const today = new Date().toISOString().split('T')[0]
      const acc = primaryAccount
      setType(defaultType)
      setDescription('')
      setAmountStr('')
      setAccountId(acc?.id || '')
      setSubcategoryId('')
      setDate(today)
      setPaymentDate(calculatePaymentDate(today, acc))
      setIsRecurring(false)
      setNotes('')
      setInstallmentsTotal(1)
    }
  }, [transaction, defaultType, accounts, primaryAccount, resolvedInstallmentsTotal])

  // Filter categories by selected type (categories with type === type OR dual-flow categories: Fabrício, Raffaela, Investimento) sorted A-Z
  const filteredCategories = useMemo(() => {
    return categories
      .filter((c) => isCategoryAllowedForType(c, type))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
  }, [categories, type])

  // Filter subcategories by selected category sorted A-Z
  const filteredSubcategories = useMemo(
    () =>
      subcategories
        .filter((s) => s.category_id === categoryId)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [subcategories, categoryId],
  )

  // Handlers for switching type
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType)
    if (categoryId) {
      const currentCat = categories.find((c) => c.id === categoryId)
      if (!currentCat || !isCategoryAllowedForType(currentCat, newType)) {
        setCategoryId('')
        setSubcategoryId('')
      }
    }
  }

  // Validate category selection against current type
  React.useEffect(() => {
    if (categoryId) {
      const currentCat = categories.find((c) => c.id === categoryId)
      if (!currentCat || !isCategoryAllowedForType(currentCat, type)) {
        setCategoryId('')
        setSubcategoryId('')
      }
    }
  }, [type, categories, categoryId])

  const executeUpdate = async (formData: UpdateTransactionPayload, choice?: PropagationChoice) => {
    if (!transaction) return
    setIsSubmitting(true)
    try {
      const result = await updateTransactionWithPropagation({
        transaction,
        allTransactions: transactions,
        formData,
        choice,
      })

      // Immediately apply batch changes to context state (no blocking reload)
      applyTransactionsBatchUpdate(result)

      toast.success('Lançamento atualizado com sucesso!')
      setPropagationModalOpen(false)
      setPendingFormData(null)
      onOpenChange(false)

      // Construir lista atualizada com as transações em memória para manter idempotência estrita
      const updatedTxMap = new Map<string, Transaction>()
      transactions.forEach((t) => updatedTxMap.set(t.id, t))
      result.deletedIds.forEach((id) => updatedTxMap.delete(id))
      result.updated.forEach((t) => updatedTxMap.set(t.id, t))
      result.created.forEach((t) => updatedTxMap.set(t.id, t))
      const combinedTransactions = Array.from(updatedTxMap.values())

      // Notificação das criações realizadas pela propagação (Regras 1 e 3)
      if (result.created.length > 0) {
        const isInst = Boolean(formData.installments_total && formData.installments_total > 1)
        if (isInst) {
          toast.success(
            `Foram criadas ${result.created.length} parcela(s) extra(s) para "${formData.description}".`,
          )
        } else {
          toast.success(
            `Foram geradas automaticamente ${result.created.length} ocorrência(s) futura(s) faltante(s) para "${formData.description}".`,
          )
        }
      }

      // Background sync to keep balances fresh
      reloadCompanyData().catch((e) =>
        console.warn('[TransactionModal] Background reloadCompanyData error:', e),
      )
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar lançamento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePropagationConfirm = async (choice: PropagationChoice) => {
    if (!pendingFormData) return
    await executeUpdate(pendingFormData, choice)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      toast.error('Informe a descrição do lançamento.')
      return
    }
    const parsedAmount = parseFloat(amountStr.replace(',', '.'))
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Informe um valor válido maior que zero.')
      return
    }
    if (!accountId) {
      toast.error('Selecione uma conta.')
      return
    }
    if (!categoryId) {
      toast.error('Selecione uma categoria.')
      return
    }

    const payload: UpdateTransactionPayload = {
      description: description.trim(),
      amount: parsedAmount,
      type,
      account_id: accountId,
      category_id: categoryId,
      subcategory_id: subcategoryId || undefined,
      date,
      payment_date: paymentDate || date,
      is_recurring: isRecurring,
      recurrence_type: isRecurring ? recurrenceType || 'mensal' : undefined,
      notes: notes.trim(),
      installments_total: isRecurring ? 0 : installmentsTotal,
    }

    if (isEditing && transaction) {
      const isTxRecurring = Boolean(
        isRecurringTransaction(transaction) ||
        isRecurring ||
        transaction.is_recurring ||
        transaction.recurring ||
        (transaction.recurrence_type && transaction.recurrence_type.trim() !== '') ||
        Boolean(
          (transaction as any).recurrence_period &&
          (transaction as any).recurrence_period.trim() !== '',
        ),
      )
      const effectiveParentId =
        transaction.parent_transaction_id && transaction.parent_transaction_id !== transaction.id
          ? transaction.parent_transaction_id
          : ''
      const isTxInstallment =
        Boolean(
          effectiveParentId ||
          (resolvedInstallmentsTotal > 1 &&
            transaction.installment_number &&
            transaction.installment_number > 0) ||
          resolvedInstallmentsTotal > 1,
        ) && !isTxRecurring

      // Se for recorrente ou parcelado, perguntar ao usuário como propagar antes de aplicar!
      if (isTxRecurring || isTxInstallment) {
        setPendingFormData(payload)
        setPropagationModalOpen(true)
        return
      }

      // Se for uma transação simples única
      await executeUpdate(payload, 'single')
      return
    }

    // Criar nova transação
    setIsSubmitting(true)
    try {
      const createdTx = await createTransaction({
        description,
        amount: parsedAmount,
        type,
        account_id: accountId,
        category_id: categoryId,
        subcategory_id: subcategoryId || undefined,
        date,
        payment_date: paymentDate || date,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType || 'mensal' : undefined,
        notes,
        installments_total: isRecurring ? 0 : installmentsTotal,
      })
      toast.success(
        installmentsTotal > 1
          ? `Lançamento parcelado em ${installmentsTotal}x criado com sucesso!`
          : isRecurring
            ? 'Lançamento recorrente criado com sucesso!'
            : 'Lançamento criado com sucesso!',
      )
      onOpenChange(false)

      // Geração automática de ocorrências futuras se for recorrente
      if (isRecurring && createdTx && currentCompany) {
        import('@/lib/recurring-generation').then(async ({ triggerAutoRecurringGeneration }) => {
          const pb = (await import('@/lib/pocketbase/client')).default
          const currentUserId =
            (createdTx as any).user_id || pb.authStore.model?.id || currentCompany.owner_id || ''
          triggerAutoRecurringGeneration({
            sourceTransaction: createdTx,
            existingTransactions: transactions,
            currentCompanyId: currentCompany.id,
            currentUserId,
            onSuccessCreated: (createdList) => {
              applyTransactionsBatchUpdate({ created: createdList })
              toast.success(
                `Foram geradas automaticamente 12 ocorrências futuras para "${createdTx.description}".`,
              )
            },
          }).catch((err) => {
            console.warn('[TransactionModal] Erro na geração automática:', err)
          })
        })
      }

      // Geração automática de parcelas seguintes se for parcelado (installment_total > 1)
      if (installmentsTotal > 1 && createdTx && currentCompany) {
        import('@/lib/recurring-generation').then(async ({ triggerAutoInstallmentGeneration }) => {
          const pb = (await import('@/lib/pocketbase/client')).default
          const currentUserId =
            (createdTx as any).user_id || pb.authStore.model?.id || currentCompany.owner_id || ''
          triggerAutoInstallmentGeneration({
            sourceTransaction: createdTx,
            existingTransactions: transactions,
            accounts,
            currentCompanyId: currentCompany.id,
            currentUserId,
            onSuccessCreated: (createdList) => {
              applyTransactionsBatchUpdate({ created: createdList })
              toast.success(
                `Foram geradas automaticamente ${createdList.length} parcela(s) seguintes para "${createdTx.description}".`,
              )
            },
          }).catch((err) => {
            console.warn('[TransactionModal] Erro na geração automática de parcelas:', err)
          })
        })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar lançamento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Editar Lançamento' : 'Novo Lançamento'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Preencha os dados do registro financeiro do seu controle.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Informative banner for installment transactions */}
          {isEditing && isInstallment && (
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-xs space-y-1.5 animate-fade-in">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <Package className="w-4 h-4 text-amber-600" />
                <span>
                  Esta transação é uma parcela ({resolvedInstallmentNumber}/
                  {resolvedInstallmentsTotal})
                </span>
              </div>
              <p className="text-amber-700 leading-relaxed">
                {parentTransaction ? (
                  <>
                    Vinculada à compra principal:{' '}
                    <strong className="font-semibold text-amber-900">
                      {parentTransaction.description}
                    </strong>{' '}
                    (Total da compra:{' '}
                    <strong className="font-semibold text-amber-900">
                      {formatCurrency(parentTransaction.amount)}
                    </strong>
                    ).
                  </>
                ) : (
                  <>
                    Esta transação faz parte de um plano de parcelamento em{' '}
                    {resolvedInstallmentsTotal}x.
                  </>
                )}
              </p>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('despesa')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === 'despesa'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              Despesa
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('receita')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === 'receita'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Receita
            </button>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc" className="text-sm font-medium text-slate-700">
              Descrição *
            </Label>
            <Input
              id="tx-desc"
              placeholder="Ex: Fornecedor de Matéria-prima"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl h-11"
              required
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-amount" className="text-sm font-medium text-slate-700">
              Valor (R$) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                R$
              </span>
              <Input
                id="tx-amount"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="rounded-xl h-11 pl-10 font-bold tabular-nums"
                required
              />
            </div>
          </div>

          {/* Two Dates: Data da Compra & Data de Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-date" className="text-sm font-medium text-slate-700">
                Data da Compra *
              </Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => {
                  const newDate = e.target.value
                  setDate(newDate)
                  const acc = accounts.find((a) => a.id === accountId) || null
                  if (acc && acc.type === 'credito') {
                    setPaymentDate(calculatePaymentDate(newDate, acc))
                  } else {
                    setPaymentDate(newDate)
                  }
                }}
                className="rounded-xl h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-payment-date" className="text-sm font-medium text-slate-700">
                Data de Pagamento *
              </Label>
              <Input
                id="tx-payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="rounded-xl h-11"
                required
              />
            </div>
          </div>

          {/* Account and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="tx-account"
                className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-slate-500" />
                Conta de Destino/Origem *
              </Label>
              <Select
                value={accountId}
                onValueChange={(val) => {
                  setAccountId(val)
                  const acc = accounts.find((a) => a.id === val) || null
                  // Recalcular data de pagamento automaticamente
                  setPaymentDate(calculatePaymentDate(date, acc))
                }}
              >
                <SelectTrigger id="tx-account" className="rounded-xl h-11">
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: acc.color }}
                        />
                        {acc.name}
                        {acc.is_primary && (
                          <span className="text-[10px] font-semibold text-amber-600">
                            (principal)
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="tx-category"
                className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                Categoria *
              </Label>
              <Select
                value={categoryId}
                onValueChange={(val) => {
                  setCategoryId(val)
                  const valid = subcategories.filter((s) => s.category_id === val)
                  if (!valid.some((s) => s.id === subcategoryId)) {
                    setSubcategoryId('')
                  }
                }}
              >
                <SelectTrigger id="tx-category" className="rounded-xl h-11">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {filteredCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subcategory */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="tx-subcategory"
                className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Subcategoria (opcional)
              </Label>
              {subcategoryId && (
                <button
                  type="button"
                  onClick={() => setSubcategoryId('')}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <Select
              value={subcategoryId || '__none__'}
              onValueChange={(v) => setSubcategoryId(v === '__none__' ? '' : v)}
              disabled={!categoryId || filteredSubcategories.length === 0}
            >
              <SelectTrigger id="tx-subcategory" className="rounded-xl h-11">
                <SelectValue
                  placeholder={
                    !categoryId
                      ? 'Selecione uma categoria primeiro'
                      : filteredSubcategories.length === 0
                        ? 'Nenhuma subcategoria para esta categoria'
                        : 'Selecione uma subcategoria...'
                  }
                />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="__none__">
                  <span className="text-slate-400">Nenhuma subcategoria</span>
                </SelectItem>
                {filteredSubcategories.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            sub.color ||
                            categories.find((c) => c.id === sub.category_id)?.color ||
                            '#6366F1',
                        }}
                      />
                      <span>{sub.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recurring switch */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
            <div className="space-y-0.5">
              <Label htmlFor="recurring-toggle" className="text-sm font-medium text-slate-800">
                Lançamento Recorrente
              </Label>
              <p className="text-xs text-slate-500">
                Marque se este valor se repete periodicamente
              </p>
            </div>
            <Switch id="recurring-toggle" checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {isRecurring && (
            <div className="space-y-1.5 animate-fade-in">
              <Label htmlFor="recurrence-type" className="text-sm font-medium text-slate-700">
                Periodicidade
              </Label>
              <Select
                value={recurrenceType}
                onValueChange={(v: RecurrenceType) => setRecurrenceType(v)}
              >
                <SelectTrigger id="recurrence-type" className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Installments */}
          {(!isEditing || isInstallment) && (
            <div className="space-y-1.5">
              <Label
                htmlFor="tx-installments"
                className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                {isEditing ? 'Total de Parcelas da Compra' : 'Parcelado em X vezes'}
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="tx-installments"
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={installmentsTotal}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    setInstallmentsTotal(isNaN(v) || v < 1 ? 1 : Math.min(v, 60))
                  }}
                  className="rounded-xl h-11 w-28 font-semibold tabular-nums"
                />
                <span className="text-sm text-slate-500">
                  {isEditing
                    ? `parcelas no total (parcela atual: ${resolvedInstallmentNumber})`
                    : 'x (à vista = 1)'}
                </span>
              </div>
              {!isEditing && installmentsTotal > 1 && (
                <p className="text-xs text-indigo-600 font-medium animate-fade-in">
                  Serão criadas {installmentsTotal} transações de{' '}
                  {formatCurrency(parseFloat(amountStr.replace(',', '.')) || 0)} →{' '}
                  {formatCurrency(
                    (parseFloat(amountStr.replace(',', '.')) || 0) / installmentsTotal,
                  )}{' '}
                  cada, com datas mensais a partir de {date}.
                </p>
              )}
              {isEditing && installmentsTotal !== resolvedInstallmentsTotal && (
                <p className="text-xs text-amber-700 font-medium animate-fade-in">
                  {installmentsTotal > resolvedInstallmentsTotal
                    ? `Serão criadas ${
                        installmentsTotal - resolvedInstallmentsTotal
                      } novas parcelas futuras.`
                    : installmentsTotal < resolvedInstallmentNumber
                      ? `Aviso: o novo total (${installmentsTotal}) é menor que a parcela atual (${resolvedInstallmentNumber}). As parcelas posteriores serão ajustadas.`
                      : `Serão excluídas ${
                          resolvedInstallmentsTotal - installmentsTotal
                        } parcelas excedentes.`}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="tx-notes" className="text-sm font-medium text-slate-700">
              Observações (opcional)
            </Label>
            <Textarea
              id="tx-notes"
              placeholder="Número de nota fiscal, detalhes do fornecedor, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl min-h-[70px] resize-none"
            />
          </div>

          <DialogFooter className="pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-xl h-11 text-white font-medium ${
                type === 'despesa'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Atualizar Lançamento'
              ) : (
                'Salvar Lançamento'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Recurrence & Installment Propagation Dialog */}
      <RecurrencePropagationModal
        open={propagationModalOpen}
        onOpenChange={setPropagationModalOpen}
        isInstallment={
          Boolean(
            (transaction?.parent_transaction_id &&
              transaction.parent_transaction_id !== transaction.id) ||
            (transaction?.installment_number &&
              transaction?.installment_number > 0 &&
              resolvedInstallmentsTotal > 1) ||
            resolvedInstallmentsTotal > 1,
          ) &&
          !(
            transaction?.is_recurring ||
            transaction?.recurring ||
            transaction?.recurrence_type ||
            (transaction as any)?.recurrence_period
          )
        }
        isRecurring={Boolean(
          transaction?.is_recurring ||
          transaction?.recurring ||
          transaction?.recurrence_type ||
          (transaction as any)?.recurrence_period,
        )}
        currentInstallment={resolvedInstallmentNumber}
        totalInstallments={resolvedInstallmentsTotal}
        onConfirm={handlePropagationConfirm}
        isSubmitting={isSubmitting}
      />
    </Dialog>
  )
}
