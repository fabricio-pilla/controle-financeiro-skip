import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { Transaction } from '@/types/database'
import { formatCurrency, formatDateBR, getTxEffectiveDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface DueAlertsBannerProps {
  transactions: Transaction[]
  canManageTransactions: boolean
  onMarkPaid: (txId: string) => Promise<void>
}

export function DueAlertsBanner({
  transactions,
  canManageTransactions,
  onMarkPaid,
}: DueAlertsBannerProps) {
  const { toast } = useToast()
  const [payingId, setPayingId] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Calcular alertas para hoje
  const now = new Date()
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // Filtra despesas pendentes com vencimento vencido ou nos próximos 7 dias
  const urgentItems = React.useMemo(() => {
    const pendings = transactions.filter((t) => {
      if (t.type !== 'despesa') return false
      if (t.paid !== false) return false
      const effDate = getTxEffectiveDate(t)
      return Boolean(effDate)
    })

    const withDiff = pendings.map((t) => {
      const effDate = getTxEffectiveDate(t)
      const [y, m, d] = effDate.split('-').map(Number)
      const targetTime = new Date(y, m - 1, d).getTime()
      const diffDays = Math.round((targetTime - todayDate) / (1000 * 60 * 60 * 24))

      let badgeText = ''
      let severity: 'overdue' | 'today' | 'near' = 'near'

      if (diffDays < 0) {
        badgeText = `Atrasado há ${Math.abs(diffDays)}d`
        severity = 'overdue'
      } else if (diffDays === 0) {
        badgeText = 'Vence hoje'
        severity = 'today'
      } else if (diffDays === 1) {
        badgeText = 'Vence amanhã'
        severity = 'near'
      } else {
        badgeText = `Vence em ${diffDays} dias`
        severity = 'near'
      }

      return {
        tx: t,
        diffDays,
        effDate,
        badgeText,
        severity,
      }
    })

    // Vencidos (diffDays < 0) e vencendo nos próximos 7 dias (0 <= diffDays <= 7)
    const filtered = withDiff.filter((item) => item.diffDays <= 7)
    // Mais urgentes primeiro (mais atrasados, depois os de hoje, etc.)
    filtered.sort((a, b) => a.diffDays - b.diffDays)
    return filtered
  }, [transactions, todayDate])

  if (urgentItems.length === 0) {
    return null
  }

  const overdueCount = urgentItems.filter((i) => i.diffDays < 0).length
  const todayCount = urgentItems.filter((i) => i.diffDays === 0).length
  const totalAmount = urgentItems.reduce((acc, i) => acc + i.tx.amount, 0)

  const handleQuickPay = async (txId: string, desc: string) => {
    if (!canManageTransactions || payingId) return
    try {
      setPayingId(txId)
      await onMarkPaid(txId)
      toast({
        title: 'Lançamento marcado como pago',
        description: `"${desc}" foi baixado com sucesso.`,
      })
    } catch {
      toast({
        title: 'Erro ao marcar lançamento',
        description: 'Não foi possível atualizar o lançamento. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setPayingId(null)
    }
  }

  const displayedItems = isExpanded ? urgentItems : urgentItems.slice(0, 3)

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
        overdueCount > 0
          ? 'bg-gradient-to-r from-rose-50 via-amber-50/50 to-rose-50/30 border-rose-200'
          : 'bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50/20 border-amber-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-200/60">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              overdueCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {overdueCount > 0 ? (
              <AlertCircle className="w-5 h-5 animate-pulse" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {overdueCount > 0
                  ? `Atenção: ${urgentItems.length} ${urgentItems.length === 1 ? 'conta requer sua atenção' : 'contas requerem sua atenção'}`
                  : `${urgentItems.length} ${urgentItems.length === 1 ? 'conta vence nos próximos 7 dias' : 'contas vencem nos próximos 7 dias'}`}
              </h3>
              {overdueCount > 0 && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-xs">
                  {overdueCount} {overdueCount === 1 ? 'vencida' : 'vencidas'}
                </span>
              )}
              {todayCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  {todayCount} vence hoje
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Total pendente no período:{' '}
              <strong className="text-slate-900 font-bold">{formatCurrency(totalAmount)}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Link
            to="/lancamentos?status=pending"
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white/60 transition-colors"
          >
            <span>Ver no Extrato</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          {urgentItems.length > 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 text-xs bg-white/80 hover:bg-white border-slate-200"
            >
              {isExpanded ? (
                <>
                  <span>Mostrar menos</span>
                  <ChevronUp className="w-3.5 h-3.5 ml-1" />
                </>
              ) : (
                <>
                  <span>Ver todas ({urgentItems.length})</span>
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Lista de contas */}
      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {displayedItems.map(({ tx, badgeText, severity, effDate }) => (
          <div
            key={tx.id}
            className={`p-3 rounded-xl border bg-white/90 shadow-2xs flex flex-col justify-between transition-all ${
              severity === 'overdue'
                ? 'border-rose-200 hover:border-rose-300'
                : severity === 'today'
                  ? 'border-amber-300 hover:border-amber-400'
                  : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                    severity === 'overdue'
                      ? 'bg-rose-100 text-rose-800 font-extrabold'
                      : severity === 'today'
                        ? 'bg-amber-100 text-amber-900 font-extrabold'
                        : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {severity === 'overdue' && (
                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                  )}
                  {badgeText}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {formatDateBR(effDate)}
                </span>
              </div>

              <p className="text-xs font-bold text-slate-900 line-clamp-1" title={tx.description}>
                {tx.description}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                {tx.category?.name || 'Geral'} • {tx.account?.name || 'Conta'}
              </p>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-rose-600 tabular-nums">
                {formatCurrency(tx.amount)}
              </span>

              {canManageTransactions && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={payingId === tx.id}
                  onClick={() => handleQuickPay(tx.id, tx.description)}
                  className="h-7 px-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg flex items-center gap-1 transition-colors"
                  title="Marcar como pago imediatamente"
                >
                  {payingId === tx.id ? (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                  ) : (
                    <Check className="w-3 h-3 text-emerald-600" />
                  )}
                  <span>Marcar pago</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
