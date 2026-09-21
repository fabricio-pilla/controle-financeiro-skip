import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { AnimatedCounter } from '@/components/common/AnimatedCounter'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { TransactionModal } from '@/components/transactions/TransactionModal'
import { AiTransactionModal } from '@/components/transactions/AiTransactionModal'
import { formatCurrency, formatDateBR, getGreeting } from '@/lib/formatters'
import { isParentTransaction } from '@/lib/transaction-propagation'
import { Transaction } from '@/types/database'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  ArrowRight,
  Building2,
  Calendar,
  Repeat,
  Package,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart as LineChartIcon,
  CreditCard,
  CalendarClock,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const DONUT_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#06B6D4',
  '#F97316',
  '#84CC16',
]

// Helper para obter a data de pagamento efetiva (com fallback para date)
function getTxEffectiveDate(t: Transaction): string {
  return t.payment_date || t.date || ''
}

export default function Dashboard() {
  const { user } = useAuth()
  const { currentCompany, accounts, categories, transactions, canManageTransactions } = useCompany()
  const navigate = useNavigate()

  // Período selecionado
  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'this_year' | 'all'>(
    'this_month',
  )

  // Gráfico: tipo de visualização (area / bar) e toggle de meses (6 / 12)
  const [chartViewType, setChartViewType] = useState<'area' | 'bar'>('area')
  const [chartMonthRange, setChartMonthRange] = useState<'6' | '12'>('12')

  // Modais de criação
  const [newTxOpen, setNewTxOpen] = useState(false)
  const [aiTxOpen, setAiTxOpen] = useState(false)

  // -------------------------------------------------------------
  // Cálculos de datas e limites
  // -------------------------------------------------------------
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed
  const curYm = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`

  // Mês anterior
  const prevMonthNum = currentMonth === 0 ? 12 : currentMonth
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
  const prevYm = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}`

  // Ano anterior
  const prevYearPrefix = `${currentYear - 1}-`
  const curYearPrefix = `${currentYear}-`

  // -------------------------------------------------------------
  // Filtro de transações do período selecionado
  // O filtro de período comanda tudo (cards, donut, gráfico, tabela)
  // Usa getTxEffectiveDate (payment_date com fallback para date)
  // -------------------------------------------------------------
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (isParentTransaction(t)) return false
      const effDate = getTxEffectiveDate(t)
      if (!effDate) return false

      if (period === 'this_month') {
        return effDate.startsWith(curYm)
      } else if (period === 'last_month') {
        return effDate.startsWith(prevYm)
      } else if (period === 'this_year') {
        return effDate.startsWith(curYearPrefix)
      }
      return true
    })
  }, [transactions, period, curYm, prevYm, curYearPrefix])

  // -------------------------------------------------------------
  // Transações do período anterior correspondente (para variação ▲/▼)
  // -------------------------------------------------------------
  const previousPeriodTransactions = useMemo(() => {
    if (period === 'all') return []

    return transactions.filter((t) => {
      if (isParentTransaction(t)) return false
      const effDate = getTxEffectiveDate(t)
      if (!effDate) return false

      if (period === 'this_month') {
        // Anterior = mês anterior
        return effDate.startsWith(prevYm)
      } else if (period === 'last_month') {
        // Anterior ao mês passado = 2 meses atrás
        const d = new Date(prevMonthYear, prevMonthNum - 1 - 1, 1)
        const ym2 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return effDate.startsWith(ym2)
      } else if (period === 'this_year') {
        // Anterior = ano anterior
        return effDate.startsWith(prevYearPrefix)
      }
      return false
    })
  }, [transactions, period, prevYm, prevMonthYear, prevMonthNum, prevYearPrefix])

  // -------------------------------------------------------------
  // Card 1: Saldo Total em Contas
  // -------------------------------------------------------------
  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, a) => {
      if (a.type === 'credito') return acc // Cartão não entra como saldo positivo
      return acc + (a.balance || 0)
    }, 0)
  }, [accounts])

  // -------------------------------------------------------------
  // Item 3: Realizado vs Previsto no período filtrado
  // Receitas e Despesas divididas por status `paid`
  // -------------------------------------------------------------
  const { totalIncome, incomePaid, incomePending, totalExpense, expensePaid, expensePending } =
    useMemo(() => {
      let tInc = 0
      let incPaid = 0
      let incPend = 0
      let tExp = 0
      let expPaid = 0
      let expPend = 0

      filteredTransactions.forEach((t) => {
        const isPaid = t.paid !== false
        if (t.type === 'receita') {
          tInc += t.amount
          if (isPaid) incPaid += t.amount
          else incPend += t.amount
        } else {
          tExp += t.amount
          if (isPaid) expPaid += t.amount
          else expPend += t.amount
        }
      })

      return {
        totalIncome: tInc,
        incomePaid: incPaid,
        incomePending: incPend,
        totalExpense: tExp,
        expensePaid: expPaid,
        expensePending: expPend,
      }
    }, [filteredTransactions])

  // Item 3: Destaque de despesas futuras (próximos 12 meses)
  // Lançamentos não pagos (paid === false) com data de pagamento > hoje até 12 meses
  const future12MonthsExpenses = useMemo(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`
    const futureLimit = new Date(now)
    futureLimit.setFullYear(futureLimit.getFullYear() + 1)
    const futureLimitStr = `${futureLimit.getFullYear()}-${String(
      futureLimit.getMonth() + 1,
    ).padStart(2, '0')}-${String(futureLimit.getDate()).padStart(2, '0')}`

    return transactions
      .filter((t) => {
        if (isParentTransaction(t)) return false
        if (t.type !== 'despesa') return false
        if (t.paid !== false) return false // Somente pendentes
        const effDate = getTxEffectiveDate(t)
        return effDate > todayStr && effDate <= futureLimitStr
      })
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions, now])

  // -------------------------------------------------------------
  // Item 5: Comparação com o período anterior (Receitas e Despesas)
  // -------------------------------------------------------------
  const { prevIncome, prevExpense } = useMemo(() => {
    let pInc = 0
    let pExp = 0
    previousPeriodTransactions.forEach((t) => {
      if (t.type === 'receita') pInc += t.amount
      else pExp += t.amount
    })
    return { prevIncome: pInc, prevExpense: pExp }
  }, [previousPeriodTransactions])

  const incomeGrowthPct = useMemo(() => {
    if (period === 'all' || prevIncome === 0) return null
    return ((totalIncome - prevIncome) / prevIncome) * 100
  }, [period, totalIncome, prevIncome])

  const expenseGrowthPct = useMemo(() => {
    if (period === 'all' || prevExpense === 0) return null
    return ((totalExpense - prevExpense) / prevExpense) * 100
  }, [period, totalExpense, prevExpense])

  // -------------------------------------------------------------
  // Item 6: Taxa de Economia do Período (substitui o 4º card)
  // Economia = Receitas − Despesas; % da renda
  // -------------------------------------------------------------
  const netSavings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0
  const savingsProgress = Math.max(0, Math.min(100, savingsRate))

  // -------------------------------------------------------------
  // Item 2 & 7: Gráfico de Evolução adaptável ao filtro de período
  // - "this_month": dias do mês (1 até último dia do mês)
  // - "last_month": dias do mês anterior
  // - "this_year": 12 meses do ano (com toggle 6 / 12 meses)
  // - "all": todos os meses com dados registrados
  // Alternância de Área e Barras
  // -------------------------------------------------------------
  const chartData = useMemo(() => {
    const monthsNames = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ]

    if (period === 'this_month' || period === 'last_month') {
      const targetYear = period === 'this_month' ? currentYear : prevMonthYear
      const targetMonthIndex = period === 'this_month' ? currentMonth : prevMonthNum - 1
      const targetYm = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}`

      // Último dia do mês alvo
      const daysInMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate()
      const daysMap: Record<number, { label: string; receitas: number; despesas: number }> = {}
      for (let d = 1; d <= daysInMonth; d++) {
        daysMap[d] = {
          label: `${String(d).padStart(2, '0')}`,
          receitas: 0,
          despesas: 0,
        }
      }

      transactions.forEach((tx) => {
        if (isParentTransaction(tx)) return
        const effDate = getTxEffectiveDate(tx)
        if (!effDate || !effDate.startsWith(targetYm)) return

        const day = parseInt(effDate.substring(8, 10), 10)
        if (daysMap[day]) {
          if (tx.type === 'receita') daysMap[day].receitas += tx.amount
          else daysMap[day].despesas += tx.amount
        }
      })

      return Object.keys(daysMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((d) => ({
          name: `Dia ${daysMap[d].label}`,
          receitas: daysMap[d].receitas,
          despesas: daysMap[d].despesas,
        }))
    }

    if (period === 'this_year') {
      // 12 meses do ano atual, ou últimos 6 meses se o toggle estiver em 6
      const baseMonths = monthsNames.map((m, idx) => ({
        name: m,
        monthIdx: idx,
        receitas: 0,
        despesas: 0,
      }))

      transactions.forEach((tx) => {
        if (isParentTransaction(tx)) return
        const effDate = getTxEffectiveDate(tx)
        if (!effDate || !effDate.startsWith(curYearPrefix)) return

        const mIdx = parseInt(effDate.substring(5, 7), 10) - 1
        if (mIdx >= 0 && mIdx < 12) {
          if (tx.type === 'receita') {
            baseMonths[mIdx].receitas += tx.amount
          } else {
            baseMonths[mIdx].despesas += tx.amount
          }
        }
      })

      if (chartMonthRange === '6') {
        // Se estivermos em 6 meses, pega os últimos 6 meses até o mês atual (ou os 6 primeiros se início do ano)
        const endIdx = Math.max(5, currentMonth)
        const startIdx = Math.max(0, endIdx - 5)
        return baseMonths.slice(startIdx, startIdx + 6)
      }

      return baseMonths
    }

    // "all": todos os meses com dados registrados
    const ymMap: Record<string, { receitas: number; despesas: number }> = {}

    transactions.forEach((tx) => {
      if (isParentTransaction(tx)) return
      const effDate = getTxEffectiveDate(tx)
      if (!effDate || effDate.length < 7) return
      const ym = effDate.substring(0, 7)
      if (!/^\d{4}-\d{2}$/.test(ym)) return

      if (!ymMap[ym]) {
        ymMap[ym] = { receitas: 0, despesas: 0 }
      }
      if (tx.type === 'receita') ymMap[ym].receitas += tx.amount
      else ymMap[ym].despesas += tx.amount
    })

    const sortedYm = Object.keys(ymMap).sort()
    if (sortedYm.length === 0) {
      // Fallback para os 12 meses do ano
      return monthsNames.map((m) => ({ name: m, receitas: 0, despesas: 0 }))
    }

    return sortedYm.map((ym) => {
      const [y, m] = ym.split('-')
      const mIdx = parseInt(m, 10) - 1
      const label = `${monthsNames[mIdx]}/${y.slice(2)}`
      return {
        name: label,
        receitas: ymMap[ym].receitas,
        despesas: ymMap[ym].despesas,
      }
    })
  }, [
    period,
    chartMonthRange,
    transactions,
    currentYear,
    currentMonth,
    prevMonthYear,
    prevMonthNum,
    curYearPrefix,
  ])

  // -------------------------------------------------------------
  // Item 8: Donut Clicável por Categoria
  // Clicar numa fatia navega para /lancamentos com categoria e período
  // -------------------------------------------------------------
  const categoryDonutData = useMemo(() => {
    const expenseTx = filteredTransactions.filter((t) => t.type === 'despesa')
    const grouped: Record<string, { id: string; name: string; amount: number; color?: string }> = {}

    expenseTx.forEach((tx) => {
      const cat = categories.find((c) => c.id === tx.category_id)
      const catId = cat ? cat.id : 'unknown'
      const catName = cat ? cat.name : 'Outros'
      const catColor = cat?.color

      if (!grouped[catId]) {
        grouped[catId] = { id: catId, name: catName, amount: 0, color: catColor }
      }
      grouped[catId].amount += tx.amount
    })

    const result = Object.values(grouped).map((item) => ({
      id: item.id,
      name: item.name,
      value: item.amount,
      color: item.color,
    }))

    return result.sort((a, b) => b.value - a.value).slice(0, 6)
  }, [filteredTransactions, categories])

  const handleDonutClick = (entry: any) => {
    if (!entry || !entry.id || entry.id === 'unknown') {
      navigate('/lancamentos')
      return
    }
    const params = new URLSearchParams()
    params.set('category', entry.id)
    if (period === 'this_month') {
      params.set('month', curYm)
    } else if (period === 'last_month') {
      params.set('month', prevYm)
    } else {
      params.set('month', 'all')
    }
    navigate(`/lancamentos?${params.toString()}`)
  }

  // -------------------------------------------------------------
  // Item 1: Últimos Lançamentos
  // Respeita o filtro de período atual e ordena pela data efetiva
  // (payment_date com fallback para date) da mais recente para a mais antiga
  // -------------------------------------------------------------
  const latestTransactions = useMemo(() => {
    const list = [...filteredTransactions]
    list.sort((a, b) => {
      const dateA = getTxEffectiveDate(a)
      const dateB = getTxEffectiveDate(b)
      return dateB.localeCompare(dateA)
    })
    return list.slice(0, 5)
  }, [filteredTransactions])

  // -------------------------------------------------------------
  // Item 4: Próximos Vencimentos
  // Lançamentos pendentes (paid = false) com data de pagamento nos próximos dias
  // Agrupados / com etiquetas: "Vence hoje", "Vence em X dias", "Atrasado"
  // -------------------------------------------------------------
  const upcomingExpenses = useMemo(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}`

    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    // Consideramos pendentes (paid === false) de despesa
    const pendings = transactions.filter((t) => {
      if (isParentTransaction(t)) return false
      if (t.type !== 'despesa') return false
      if (t.paid !== false) return false
      const effDate = getTxEffectiveDate(t)
      return Boolean(effDate)
    })

    // Calcular dias de diferença em relação a hoje
    const withDiff = pendings.map((t) => {
      const effDate = getTxEffectiveDate(t)
      const [y, m, d] = effDate.split('-').map(Number)
      const targetTime = new Date(y, m - 1, d).getTime()
      const diffDays = Math.round((targetTime - todayDate) / (1000 * 60 * 60 * 24))

      let statusBadge: { label: string; variant: 'danger' | 'warning' | 'info' | 'today' } = {
        label: `${diffDays}d`,
        variant: 'info',
      }

      if (diffDays < 0) {
        statusBadge = {
          label: `Atrasado há ${Math.abs(diffDays)}d`,
          variant: 'danger',
        }
      } else if (diffDays === 0) {
        statusBadge = {
          label: 'Vence hoje',
          variant: 'today',
        }
      } else if (diffDays === 1) {
        statusBadge = {
          label: 'Vence amanhã',
          variant: 'warning',
        }
      } else if (diffDays <= 7) {
        statusBadge = {
          label: `Vence em ${diffDays} dias`,
          variant: 'warning',
        }
      } else if (diffDays <= 15) {
        statusBadge = {
          label: `Vence em ${diffDays} dias`,
          variant: 'info',
        }
      } else {
        statusBadge = {
          label: `Em ${diffDays} dias`,
          variant: 'info',
        }
      }

      return {
        tx: t,
        diffDays,
        effDate,
        statusBadge,
      }
    })

    // Filtra apenas os atrasados ou com vencimento em até 15 dias para o painel de atenção rápida
    const relevant = withDiff.filter((item) => item.diffDays <= 15)

    // Ordena do mais urgente (atrasados primeiro, depois mais próximos)
    relevant.sort((a, b) => a.diffDays - b.diffDays)

    return relevant.slice(0, 8)
  }, [transactions, now])

  // -------------------------------------------------------------
  // Item 10: Alerta de Cartão de Crédito
  // Quando despesas do cartão no período > 70% do limite, destacar em vermelho/âmbar
  // -------------------------------------------------------------
  const cardExpensesMap = useMemo(() => {
    const map: Record<string, number> = {}
    filteredTransactions.forEach((t) => {
      if (t.type === 'despesa') {
        map[t.account_id] = (map[t.account_id] || 0) + t.amount
      }
    })
    return map
  }, [filteredTransactions])

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {getGreeting(user?.name)}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-400" />
            Visão consolidada do controle{' '}
            <strong className="text-slate-700">{currentCompany?.name}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Period filter dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="border-none shadow-none text-xs font-semibold h-8 w-[140px] focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="this_year">Este ano</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canManageTransactions && (
            <Button
              onClick={() => setAiTxOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-4 text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Lançamento</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          )}
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Saldo Total em Contas</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              <AnimatedCounter value={totalBalance} formatter={formatCurrency} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Soma de contas correntes e investimentos
            </p>
          </div>
        </div>

        {/* Card 2: Receitas do Período (com realizado vs previsto e variação) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Receitas do Período</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold text-emerald-600 tabular-nums">
                <AnimatedCounter value={totalIncome} formatter={formatCurrency} />
              </div>
              {/* Comparação período anterior */}
              {incomeGrowthPct !== null && (
                <span
                  className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                    incomeGrowthPct >= 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                  title={`Período anterior: ${formatCurrency(prevIncome)}`}
                >
                  {incomeGrowthPct >= 0 ? (
                    <ArrowUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDown className="w-3 h-3 mr-0.5" />
                  )}
                  {incomeGrowthPct >= 0 ? '+' : ''}
                  {incomeGrowthPct.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Divisão Realizado vs Previsto */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                Recebido:{' '}
                <strong className="text-emerald-700 font-semibold">
                  {formatCurrency(incomePaid)}
                </strong>
              </span>
              {incomePending > 0 ? (
                <span className="text-slate-500">
                  Previsto:{' '}
                  <strong className="text-amber-600 font-semibold">
                    {formatCurrency(incomePending)}
                  </strong>
                </span>
              ) : (
                <span className="text-emerald-600 font-medium">100% recebido</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Despesas do Período (com realizado vs previsto e variação) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Despesas do Período</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl font-bold text-rose-600 tabular-nums">
                <AnimatedCounter value={totalExpense} formatter={formatCurrency} />
              </div>
              {/* Comparação período anterior (despesa subir é ruim => vermelho) */}
              {expenseGrowthPct !== null && (
                <span
                  className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                    expenseGrowthPct <= 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                  title={`Período anterior: ${formatCurrency(prevExpense)}`}
                >
                  {expenseGrowthPct > 0 ? (
                    <ArrowUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDown className="w-3 h-3 mr-0.5" />
                  )}
                  {expenseGrowthPct > 0 ? '+' : ''}
                  {expenseGrowthPct.toFixed(1)}%
                </span>
              )}
            </div>

            {/* Divisão Realizado vs Previsto */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                Pago:{' '}
                <strong className="text-rose-700 font-semibold">
                  {formatCurrency(expensePaid)}
                </strong>
              </span>
              <span className="text-slate-500">
                Pendente:{' '}
                <strong className="text-amber-600 font-semibold">
                  {formatCurrency(expensePending)}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Economia do Período (Substitui qtde de lançamentos - Item 6) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Economia do Período</span>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                netSavings >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <div
                className={`text-2xl font-bold tabular-nums ${
                  netSavings >= 0 ? 'text-indigo-600' : 'text-amber-600'
                }`}
              >
                <AnimatedCounter value={netSavings} formatter={formatCurrency} />
              </div>
              <span
                className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                  savingsRate >= 20
                    ? 'bg-emerald-100 text-emerald-800'
                    : savingsRate > 0
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-rose-100 text-rose-800'
                }`}
              >
                {savingsRate.toFixed(0)}% da renda
              </span>
            </div>

            {/* Barra de Progresso da Taxa de Economia */}
            <div className="mt-2.5">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    savingsRate >= 20
                      ? 'bg-emerald-500'
                      : savingsRate > 0
                        ? 'bg-indigo-600'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${savingsProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 flex justify-between">
                <span>Receitas − Despesas</span>
                <span>Meta ideal: 20%+</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Destaque Claro: Realizado vs Previsto + Despesas Futuras (12 meses) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">Previsibilidade Financeira</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                Próximos 12 meses
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Total de despesas programadas e parcelas a vencer:
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 sm:gap-8 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 border-indigo-800/60 pt-3 md:pt-0">
          <div>
            <p className="text-[10px] text-indigo-300 uppercase font-semibold">
              Compromissos Futuros
            </p>
            <p className="text-lg sm:text-xl font-bold text-white tabular-nums">
              {formatCurrency(future12MonthsExpenses)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-indigo-300 uppercase font-semibold">
              Despesas Pendentes (Filtro)
            </p>
            <p className="text-lg sm:text-xl font-bold text-amber-300 tabular-nums">
              {formatCurrency(expensePending)}
            </p>
          </div>
          <Link
            to="/lancamentos?status=pending"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/40 text-xs font-semibold text-indigo-100 transition-colors border border-indigo-400/30 shrink-0"
          >
            <span>Ver pendentes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Charts Section: 2/3 Evolution Chart + 1/3 Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart (Item 2 & 7) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {period === 'this_month'
                  ? 'Evolução Diária (Este Mês)'
                  : period === 'last_month'
                    ? 'Evolução Diária (Mês Passado)'
                    : period === 'this_year'
                      ? 'Evolução Mensal (Este Ano)'
                      : 'Evolução Histórica (Todo o Período)'}
              </h2>
              <p className="text-xs text-slate-500">
                {period === 'this_month' || period === 'last_month'
                  ? 'Movimentações diárias no mês filtrado'
                  : 'Comparativo de receitas e despesas'}
              </p>
            </div>

            {/* Controles do Gráfico: Alternância Linhas/Barras e Toggle 6/12 Meses */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle 6 / 12 meses (apenas quando período é este ano) */}
              {period === 'this_year' && (
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setChartMonthRange('6')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      chartMonthRange === '6'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    6 meses
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMonthRange('12')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      chartMonthRange === '12'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    12 meses
                  </button>
                </div>
              )}

              {/* Alternância Barras / Área */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setChartViewType('area')}
                  title="Gráfico em Linhas / Área"
                  className={`p-1.5 rounded-md font-semibold transition-all flex items-center gap-1 ${
                    chartViewType === 'area'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Linhas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewType('bar')}
                  title="Gráfico em Barras"
                  className={`p-1.5 rounded-md font-semibold transition-all flex items-center gap-1 ${
                    chartViewType === 'bar'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Barras</span>
                </button>
              </div>

              {/* Legenda de cores */}
              <div className="hidden sm:flex items-center gap-3 text-xs font-medium pl-1">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">Receitas</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-600">Despesas</span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartViewType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    interval={chartData.length > 20 ? 2 : 0}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      color: '#FFF',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    name="Receitas"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRec)"
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    name="Despesas"
                    stroke="#EF4444"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorDesp)"
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    interval={chartData.length > 20 ? 2 : 0}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      color: '#FFF',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Gastos por Categoria (Item 8: Fatias Clicáveis) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-base font-bold text-slate-900">Gastos por Categoria</h2>
            <p className="text-xs text-slate-500">
              Clique em uma fatia para filtrar em Lançamentos
            </p>
          </div>

          <div className="h-[250px] w-full flex items-center justify-center">
            {categoryDonutData.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma despesa no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDonutData}
                    cx="50%"
                    cy="45%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                    onClick={(entry) => handleDonutClick(entry)}
                    className="cursor-pointer"
                  >
                    {categoryDonutData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || DONUT_COLORS[index % DONUT_COLORS.length]}
                        stroke="#FFF"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      color: '#FFF',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    onClick={(entry: any) => {
                      const found = categoryDonutData.find((d) => d.name === entry.value)
                      if (found) handleDonutClick(found)
                    }}
                    className="cursor-pointer"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Middle Section: Próximos Vencimentos (Item 4) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Próximos Vencimentos</h2>
              <p className="text-xs text-slate-500">
                Contas pendentes para os próximos 15 dias e eventuais atrasos
              </p>
            </div>
          </div>
          <Link
            to="/lancamentos?status=pending"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <span>Ver todos pendentes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {upcomingExpenses.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            Nenhuma despesa pendente com vencimento para os próximos 15 dias. Tudo em dia!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {upcomingExpenses.map(({ tx, statusBadge, effDate }) => (
              <div
                key={tx.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  statusBadge.variant === 'danger'
                    ? 'bg-rose-50/60 border-rose-200 hover:bg-rose-50'
                    : statusBadge.variant === 'today'
                      ? 'bg-amber-50/80 border-amber-300 hover:bg-amber-50'
                      : statusBadge.variant === 'warning'
                        ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50/70'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        statusBadge.variant === 'danger'
                          ? 'bg-rose-100 text-rose-800'
                          : statusBadge.variant === 'today'
                            ? 'bg-amber-200 text-amber-950 font-extrabold'
                            : statusBadge.variant === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {statusBadge.variant === 'danger' && (
                        <AlertTriangle className="w-2.5 h-2.5" />
                      )}
                      {statusBadge.label}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {formatDateBR(effDate)}
                    </span>
                  </div>

                  <p
                    className="text-xs font-semibold text-slate-900 line-clamp-1"
                    title={tx.description}
                  >
                    {tx.description}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {tx.category?.name || 'Geral'} • {tx.account?.name || 'Conta'}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Valor</span>
                  <span className="text-sm font-bold text-rose-600 tabular-nums">
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Section: Últimos Lançamentos (2/3) + Contas com Alerta de Cartão (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimos Lançamentos (Item 1 & Item 9) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Últimos Lançamentos</h2>
              <p className="text-xs text-slate-500">
                Ordenados pela data de pagamento mais recente (
                {period === 'this_month'
                  ? 'este mês'
                  : period === 'last_month'
                    ? 'mês passado'
                    : period === 'this_year'
                      ? 'este ano'
                      : 'todo o período'}
                )
              </p>
            </div>
            <Link
              to="/lancamentos"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Conta</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {latestTransactions.map((tx) => {
                  const isExpense = tx.type === 'despesa'
                  const isPaid = tx.paid !== false
                  const effDate = getTxEffectiveDate(tx)

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Item 9: Status de pagamento Pago / Pendente */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100/80 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{isExpense ? 'Pago' : 'Recebido'}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pendente</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Item 1: Data de pagamento efetiva */}
                      <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{formatDateBR(effDate)}</div>
                        {tx.payment_date && tx.payment_date !== tx.date && (
                          <div className="text-[10px] text-slate-400">
                            compra: {formatDateBR(tx.date)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{tx.description}</span>
                          {tx.is_recurring && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200"
                              title={`Recorrente (${tx.recurrence_type || 'mensal'})`}
                            >
                              <Repeat className="w-2.5 h-2.5 text-sky-600" />
                              <span>
                                {tx.recurrence_type
                                  ? tx.recurrence_type.charAt(0).toUpperCase() +
                                    tx.recurrence_type.slice(1)
                                  : 'Recorrente'}
                              </span>
                            </span>
                          )}
                          {Boolean(tx.installments_total && tx.installments_total > 1) && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                              title={`Parcela ${tx.installment_number || 1} de ${tx.installments_total}`}
                            >
                              <Package className="w-2.5 h-2.5 text-amber-600" />
                              <span>
                                {tx.installment_number || 1}/{tx.installments_total}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${tx.category?.color || '#6366F1'}15`,
                              color: tx.category?.color || '#6366F1',
                            }}
                          >
                            <DynamicIcon name={tx.category?.icon || 'Tag'} className="w-3 h-3" />
                            {tx.category?.name || 'Geral'}
                          </span>
                          {tx.subcategory && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <span className="text-slate-400">↳</span>
                              <span>{tx.subcategory.name}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {tx.account?.name || 'Conta'}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-bold tabular-nums ${
                          isExpense ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {isExpense ? '- ' : '+ '}
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  )
                })}
                {latestTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                      Nenhum lançamento registrado no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contas e Cartões com Alerta de Cartão > 70% (Item 10) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Contas & Cartões</h2>
                <p className="text-xs text-slate-500">Distribuição e monitoramento de limite</p>
              </div>
              <Link
                to="/contas"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <span>Gerenciar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3.5">
              {accounts.map((acc) => {
                const isCredit = acc.type === 'credito'
                const limit = acc.limit || 0
                const periodExpenses = cardExpensesMap[acc.id] || 0
                // Uso do cartão: saldo atual ou total de despesas no período vs limite
                const cardUsage = Math.max(acc.balance || 0, periodExpenses)
                const usedPct = isCredit && limit > 0 ? (cardUsage / limit) * 100 : 0
                const isOver70 = isCredit && usedPct >= 70
                const isOver90 = isCredit && usedPct >= 90

                return (
                  <div
                    key={acc.id}
                    className={`p-3 rounded-xl border transition-colors ${
                      isOver90
                        ? 'bg-rose-50/70 border-rose-300'
                        : isOver70
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: acc.color }}
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800">{acc.name}</span>
                          {/* Item 10: Alerta de cartão > 70% */}
                          {isOver90 ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Limite Crítico
                            </span>
                          ) : isOver70 ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Atenção 70%+
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          isOver90
                            ? 'text-rose-700'
                            : isOver70
                              ? 'text-amber-700'
                              : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(acc.balance)}
                      </span>
                    </div>

                    {isCredit && limit > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isOver90 ? 'bg-rose-600' : isOver70 ? 'bg-amber-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(usedPct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] mt-1">
                          <span
                            className={`font-semibold ${
                              isOver90
                                ? 'text-rose-700'
                                : isOver70
                                  ? 'text-amber-800'
                                  : 'text-slate-500'
                            }`}
                          >
                            {usedPct.toFixed(0)}% do limite
                          </span>
                          <span className="text-slate-400">Limite: {formatCurrency(limit)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Modals */}
      <TransactionModal open={newTxOpen} onOpenChange={setNewTxOpen} />
      <AiTransactionModal open={aiTxOpen} onOpenChange={setAiTxOpen} />
    </div>
  )
}
