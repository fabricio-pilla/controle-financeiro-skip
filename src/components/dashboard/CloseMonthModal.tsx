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
import { Checkbox } from '@/components/ui/checkbox'
import {
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Check,
  ExternalLink,
} from 'lucide-react'
import { Transaction } from '@/types/database'
import { formatCurrency, formatDateBR, getTxEffectiveDate } from '@/lib/formatters'
import { isParentTransaction } from '@/lib/transaction-propagation'
import { useToast } from '@/hooks/use-toast'

interface CloseMonthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transactions: Transaction[]
  targetMonthYm: string // Mês anterior no formato "YYYY-MM"
  targetMonthLabel: string // ex: "Janeiro de 2026"
  canManageTransactions: boolean
  onBatchMarkPaid: (transactionIds: string[]) => Promise<void>
  onSingleMarkPaid: (transactionId: string) => Promise<void>
}

export function CloseMonthModal({
  open,
  onOpenChange,
  transactions,
  targetMonthYm,
  targetMonthLabel,
  canManageTransactions,
  onBatchMarkPaid,
  onSingleMarkPaid,
}: CloseMonthModalProps) {
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [singleLoadingId, setSingleLoadingId] = useState<string | null>(null)

  // Filtrar lançamentos pendentes pertencentes ao targetMonthYm
  const pendingTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (isParentTransaction(t)) return false
      if (t.paid !== false) return false // Somente pendentes
      const effDate = getTxEffectiveDate(t)
      return effDate && effDate.startsWith(targetMonthYm)
    })
  }, [transactions, targetMonthYm])

  // Inicializa todos selecionados quando a modal abre
  React.useEffect(() => {
    if (open) {
      setSelectedIds(pendingTransactions.map((t) => t.id))
    }
  }, [open, pendingTransactions])

  const totalSelectedAmount = useMemo(() => {
    const selectedSet = new Set(selectedIds)
    return pendingTransactions
      .filter((t) => selectedSet.has(t.id))
      .reduce((sum, t) => sum + (t.type === 'despesa' ? t.amount : -t.amount), 0)
  }, [pendingTransactions, selectedIds])

  const pendingExpenses = pendingTransactions.filter((t) => t.type === 'despesa')
  const pendingIncomes = pendingTransactions.filter((t) => t.type === 'receita')

  const totalExpensesAmount = pendingExpenses.reduce((sum, t) => sum + t.amount, 0)
  const totalIncomesAmount = pendingIncomes.reduce((sum, t) => sum + t.amount, 0)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(pendingTransactions.map((t) => t.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleBatchConfirm = async () => {
    if (!canManageTransactions || selectedIds.length === 0 || isSubmitting) return

    try {
      setIsSubmitting(true)
      await onBatchMarkPaid(selectedIds)
      toast({
        title: 'Mês fechado com sucesso!',
        description: `${selectedIds.length} ${selectedIds.length === 1 ? 'lançamento foi marcado' : 'lançamentos foram marcados'} como pago.`,
      })
      onOpenChange(false)
    } catch {
      toast({
        title: 'Erro ao fechar o mês',
        description: 'Ocorreu uma falha ao atualizar os lançamentos selecionados.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSinglePay = async (id: string, desc: string) => {
    if (!canManageTransactions || singleLoadingId) return
    try {
      setSingleLoadingId(id)
      await onSingleMarkPaid(id)
      setSelectedIds((prev) => prev.filter((item) => item !== id))
      toast({
        title: 'Lançamento marcado como pago',
        description: `"${desc}" foi baixado com sucesso.`,
      })
    } catch {
      toast({
        title: 'Erro ao marcar lançamento',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSingleLoadingId(null)
    }
  }

  const allSelected =
    pendingTransactions.length > 0 && selectedIds.length === pendingTransactions.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Fechar o Mês — {targetMonthLabel}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Revise os lançamentos que ainda constam como pendentes no mês anterior e dê baixa em
                lote ou individualmente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com scroll */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {pendingTransactions.length === 0 ? (
            <div className="py-12 text-center bg-emerald-50/60 rounded-2xl border border-emerald-200 p-6 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-emerald-900">
                Tudo em dia em {targetMonthLabel}!
              </h3>
              <p className="text-xs text-emerald-700 max-w-sm mt-1">
                Não há nenhum lançamento pendente no mês anterior. Todas as receitas e despesas
                foram concluídas.
              </p>
            </div>
          ) : (
            <>
              {/* Resumo superior com valores */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Pendentes</p>
                  <p className="text-base font-bold text-slate-900 mt-0.5">
                    {pendingTransactions.length} item(ns)
                  </p>
                </div>
                {pendingExpenses.length > 0 && (
                  <div className="bg-rose-50/60 border border-rose-200/80 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-rose-500">
                      Despesas pendentes
                    </p>
                    <p className="text-base font-bold text-rose-700 mt-0.5 tabular-nums">
                      {formatCurrency(totalExpensesAmount)}
                    </p>
                  </div>
                )}
                {pendingIncomes.length > 0 && (
                  <div className="bg-emerald-50/60 border border-emerald-200/80 p-3 rounded-xl">
                    <p className="text-[10px] uppercase font-bold text-emerald-600">
                      Receitas pendentes
                    </p>
                    <p className="text-base font-bold text-emerald-700 mt-0.5 tabular-nums">
                      {formatCurrency(totalIncomesAmount)}
                    </p>
                  </div>
                )}
              </div>

              {/* Barra de seleção rápida */}
              <div className="flex items-center justify-between p-2.5 bg-slate-100/70 rounded-xl border border-slate-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  />
                  <span>Selecionar todos ({pendingTransactions.length})</span>
                </label>
                <span className="text-slate-500">{selectedIds.length} selecionado(s)</span>
              </div>

              {/* Lista dos lançamentos pendentes */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {pendingTransactions.map((tx) => {
                  const isChecked = selectedIds.includes(tx.id)
                  const effDate = getTxEffectiveDate(tx)
                  const isExpense = tx.type === 'despesa'

                  return (
                    <div
                      key={tx.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-indigo-50/40 border-indigo-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleItem(tx.id)}
                          aria-label={`Selecionar ${tx.description}`}
                        />
                        <div className="min-w-0">
                          <p
                            className="text-xs font-bold text-slate-900 truncate"
                            title={tx.description}
                          >
                            {tx.description}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {formatDateBR(effDate)} • {tx.category?.name || 'Geral'} •{' '}
                            {tx.account?.name || 'Conta'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            isExpense ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {isExpense ? '-' : '+'}
                          {formatCurrency(tx.amount)}
                        </span>

                        {canManageTransactions && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={singleLoadingId === tx.id || isSubmitting}
                            onClick={() => handleSinglePay(tx.id, tx.description)}
                            className="h-7 px-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg flex items-center gap-1"
                            title="Marcar este item individualmente"
                          >
                            {singleLoadingId === tx.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                            ) : (
                              <Check className="w-3 h-3 text-emerald-600" />
                            )}
                            <span className="hidden sm:inline">Pagar</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Rodapé com ações */}
        <DialogFooter className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl"
          >
            Fechar
          </Button>

          {pendingTransactions.length > 0 && canManageTransactions && (
            <Button
              type="button"
              disabled={selectedIds.length === 0 || isSubmitting}
              onClick={handleBatchConfirm}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Baixando lançamentos...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Marcar {selectedIds.length} como pagos</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
