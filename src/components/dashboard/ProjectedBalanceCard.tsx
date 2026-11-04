import React from 'react'
import {
  CalendarClock,
  CheckCircle,
  HelpCircle,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { formatCurrency, formatDateBR, getTxEffectiveDate } from '@/lib/formatters'
import { isParentTransaction } from '@/lib/transaction-propagation'
import { Transaction } from '@/types/database'
import { AnimatedCounter } from '@/components/common/AnimatedCounter'

interface ProjectedBalanceCardProps {
  currentBalance: number
  transactions: Transaction[]
}

export function ProjectedBalanceCard({ currentBalance, transactions }: ProjectedBalanceCardProps) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-based
  const curYm = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

  // Último dia do mês corrente
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const endOfMonthStr = `${curYm}-${String(lastDayOfMonth).padStart(2, '0')}`

  const projection = React.useMemo(() => {
    // Pegar pendentes do mês corrente
    let curMonthPendingIncome = 0
    let curMonthPendingExpense = 0

    // Pegar pendentes de todos os meses futuros
    let allFuturePendingIncome = 0
    let allFuturePendingExpense = 0

    transactions.forEach((tx) => {
      if (isParentTransaction(tx)) return
      if (tx.paid !== false) return // Apenas pendentes
      const effDate = getTxEffectiveDate(tx)
      if (!effDate) return

      if (effDate.startsWith(curYm)) {
        if (tx.type === 'receita') {
          curMonthPendingIncome += tx.amount
        } else if (tx.type === 'despesa') {
          curMonthPendingExpense += tx.amount
        }
      }

      // Se for posterior ao mês corrente
      if (effDate > endOfMonthStr) {
        if (tx.type === 'receita') {
          allFuturePendingIncome += tx.amount
        } else if (tx.type === 'despesa') {
          allFuturePendingExpense += tx.amount
        }
      }
    })

    // Saldo projetado no fim do mês corrente:
    // Saldo atual em contas + Receitas pendentes deste mês - Despesas pendentes deste mês
    const projectedEndOfMonth = currentBalance + curMonthPendingIncome - curMonthPendingExpense

    // Saldo projetado com todas as séries futuras criadas:
    const projectedOverall = projectedEndOfMonth + allFuturePendingIncome - allFuturePendingExpense

    const diffEndOfMonth = projectedEndOfMonth - currentBalance

    return {
      curMonthPendingIncome,
      curMonthPendingExpense,
      projectedEndOfMonth,
      diffEndOfMonth,
      allFuturePendingIncome,
      allFuturePendingExpense,
      projectedOverall,
    }
  }, [currentBalance, transactions, curYm, endOfMonthStr])

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  const curMonthName = monthNames[currentMonth]

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500">Saldo Projetado</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
              Fim de {curMonthName}
            </span>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              projection.projectedEndOfMonth >= 0
                ? 'bg-indigo-50 text-indigo-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            <CalendarClock className="w-5 h-5" />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <div
              className={`text-2xl font-bold tabular-nums ${
                projection.projectedEndOfMonth >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
            >
              <AnimatedCounter value={projection.projectedEndOfMonth} formatter={formatCurrency} />
            </div>

            {/* Variação vs saldo atual */}
            <span
              className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                projection.diffEndOfMonth >= 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
              title="Impacto dos lançamentos pendentes deste mês"
            >
              {projection.diffEndOfMonth >= 0 ? (
                <TrendingUp className="w-3 h-3 mr-0.5" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-0.5" />
              )}
              {projection.diffEndOfMonth >= 0 ? '+' : ''}
              {formatCurrency(projection.diffEndOfMonth)}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
            <span>
              Saldo atual ({formatCurrency(currentBalance)}) considerando pendências até dia{' '}
              {lastDayOfMonth}
            </span>
          </p>
        </div>
      </div>

      {/* Detalhamento das pendências do mês */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <div className="text-slate-500">
          A receber:{' '}
          <strong className="text-emerald-700 font-semibold">
            +{formatCurrency(projection.curMonthPendingIncome)}
          </strong>
        </div>
        <div className="text-slate-500">
          A pagar:{' '}
          <strong className="text-rose-600 font-semibold">
            -{formatCurrency(projection.curMonthPendingExpense)}
          </strong>
        </div>
      </div>
    </div>
  )
}
