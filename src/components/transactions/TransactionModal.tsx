import React, { useState } from 'react'
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
import { Transaction, TransactionType, RecurrenceType } from '@/types/database'
import { toast } from 'sonner'
import { Loader2, ArrowUpRight, ArrowDownRight, Tag, Wallet, CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'

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
  const { accounts, categories, createTransaction, updateTransaction } = useCompany()

  const isEditing = Boolean(transaction)
  const [type, setType] = useState<TransactionType>(transaction?.type || defaultType)
  const [description, setDescription] = useState(transaction?.description || '')
  const [amountStr, setAmountStr] = useState(transaction ? String(transaction.amount) : '')
  const [accountId, setAccountId] = useState(transaction?.account_id || accounts[0]?.id || '')
  const [categoryId, setCategoryId] = useState(transaction?.category_id || '')
  const [date, setDate] = useState(transaction?.date || new Date().toISOString().split('T')[0])
  const [isRecurring, setIsRecurring] = useState(transaction?.is_recurring || false)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    transaction?.recurrence_type || 'mensal',
  )
  const [notes, setNotes] = useState(transaction?.notes || '')
  const [installmentsTotal, setInstallmentsTotal] = useState(
    transaction?.installments_total && transaction.installments_total > 1
      ? transaction.installments_total
      : 1,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync when transaction changes
  React.useEffect(() => {
    if (transaction) {
      setType(transaction.type)
      setDescription(transaction.description)
      setAmountStr(String(transaction.amount))
      setAccountId(transaction.account_id)
      setCategoryId(transaction.category_id)
      setDate(transaction.date)
      setIsRecurring(Boolean(transaction.is_recurring))
      setRecurrenceType(transaction.recurrence_type || 'mensal')
      setNotes(transaction.notes || '')
      setInstallmentsTotal(
        transaction.installments_total && transaction.installments_total > 1
          ? transaction.installments_total
          : 1,
      )
    } else {
      setType(defaultType)
      setDescription('')
      setAmountStr('')
      setAccountId(accounts[0]?.id || '')
      setDate(new Date().toISOString().split('T')[0])
      setIsRecurring(false)
      setNotes('')
      setInstallmentsTotal(1)
    }
  }, [transaction, defaultType, accounts])

  // Filter categories by selected type
  const filteredCategories = categories.filter((c) => c.type === type)

  // Set default category if none or not in list
  React.useEffect(() => {
    if (filteredCategories.length > 0) {
      const exists = filteredCategories.some((c) => c.id === categoryId)
      if (!exists) {
        setCategoryId(filteredCategories[0].id)
      }
    }
  }, [type, filteredCategories, categoryId])

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

    setIsSubmitting(true)
    try {
      if (isEditing && transaction) {
        await updateTransaction(transaction.id, {
          description,
          amount: parsedAmount,
          type,
          account_id: accountId,
          category_id: categoryId,
          date,
          is_recurring: isRecurring,
          recurrence_type: isRecurring ? recurrenceType : undefined,
          notes,
        })
        toast.success('Lançamento atualizado com sucesso!')
      } else {
        await createTransaction({
          description,
          amount: parsedAmount,
          type,
          account_id: accountId,
          category_id: categoryId,
          date,
          is_recurring: isRecurring,
          recurrence_type: isRecurring ? recurrenceType : undefined,
          notes,
          installments_total: installmentsTotal,
        })
        toast.success(
          installmentsTotal > 1
            ? `Lançamento parcelado em ${installmentsTotal}x criado com sucesso!`
            : 'Lançamento criado com sucesso!',
        )
      }
      onOpenChange(false)
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
          {/* Type Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setType('despesa')}
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
              onClick={() => setType('receita')}
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

          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="space-y-1.5">
              <Label htmlFor="tx-date" className="text-sm font-medium text-slate-700">
                Data do Lançamento *
              </Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
              <Select value={accountId} onValueChange={setAccountId}>
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
              <Select value={categoryId} onValueChange={setCategoryId}>
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
          {!isEditing && (
            <div className="space-y-1.5">
              <Label
                htmlFor="tx-installments"
                className="text-sm font-medium text-slate-700 flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                Parcelado em X vezes
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
                <span className="text-sm text-slate-500">x (à vista = 1)</span>
              </div>
              {installmentsTotal > 1 && (
                <p className="text-xs text-indigo-600 font-medium animate-fade-in">
                  Serão criadas {installmentsTotal} transações de{' '}
                  {formatCurrency(parseFloat(amountStr.replace(',', '.')) || 0)} →{' '}
                  {formatCurrency(
                    (parseFloat(amountStr.replace(',', '.')) || 0) / installmentsTotal,
                  )}{' '}
                  cada, com datas mensais a partir de {date}.
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
    </Dialog>
  )
}
