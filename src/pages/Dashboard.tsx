import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { AnimatedCounter } from '@/components/common/AnimatedCounter'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { TransactionModal } from '@/components/transactions/TransactionModal'
import { AiTransactionModal } from '@/components/transactions/AiTransactionModal'
import { formatCurrency, formatDateBR, getGreeting } from '@/lib/formatters'
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ReceiptText,
  Plus,
  ArrowRight,
  Building2,
  Calendar,
  Repeat,
  Package,
  Sparkles,
  User,
} from 'lucide-react'
import {
  AreaChart,
  Area,
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

export default function Dashboard() {
  const { user } = useAuth()
  const { currentCompany, accounts, categories, transactions, canManageTransactions } = useCompany()

  const [period, setPeriod] = useState<'this_month' | 'last_month' | 'this_year' | 'all'>('all')
  const [newTxOpen, setNewTxOpen] = useState(false)
  const [aiTxOpen, setAiTxOpen] = useState(false)

  // Filter transactions based on period and ignore parent installment records (installment_number=0 && installment_total>0)
  const filteredTransactions = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    return transactions.filter((t) => {
      // Ignore parent installment records
      const isParent =
        (t.installment_number === 0 || t.installment_number === undefined) &&
        (t.installments_total || 0) > 0
      if (isParent) return false

      const txDate = new Date(t.date)
      if (period === 'this_month') {
        return txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth
      } else if (period === 'last_month') {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const yearOfLastMonth = currentMonth === 0 ? currentYear - 1 : currentYear
        return txDate.getFullYear() === yearOfLastMonth && txDate.getMonth() === lastMonth
      } else if (period === 'this_year') {
        return txDate.getFullYear() === currentYear
      }
      return true
    })
  }, [transactions, period])

  // Calculate totals
  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, a) => {
      if (a.type === 'credito') return acc // Credit cards don't count as positive cash balance
      return acc + (a.balance || 0)
    }, 0)
  }, [accounts])

  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'receita')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [filteredTransactions])

  const totalExpense = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'despesa')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [filteredTransactions])

  const totalTxCount = filteredTransactions.length

  // Build 12-month area chart data
  const monthlyChartData = useMemo(() => {
    const months = [
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
    const now = new Date()
    const curYear = now.getFullYear()

    // Initialize 12 months array
    const data = months.map((m, idx) => ({
      month: m,
      monthIdx: idx,
      receitas: 0,
      despesas: 0,
    }))

    transactions.forEach((tx) => {
      // Ignore parent installment records
      const isParent =
        (tx.installment_number === 0 || tx.installment_number === undefined) &&
        (tx.installments_total || 0) > 0
      if (isParent) return

      const d = new Date(tx.date)
      if (d.getFullYear() === curYear) {
        const mIdx = d.getMonth()
        if (tx.type === 'receita') {
          data[mIdx].receitas += tx.amount
        } else {
          data[mIdx].despesas += tx.amount
        }
      }
    })

    return data
  }, [transactions])

  // Build Donut category distribution
  const categoryDonutData = useMemo(() => {
    const expenseTx = filteredTransactions.filter((t) => t.type === 'despesa')
    const grouped: Record<string, number> = {}

    expenseTx.forEach((tx) => {
      const cat = categories.find((c) => c.id === tx.category_id)
      const name = cat ? cat.name : 'Outros'
      grouped[name] = (grouped[name] || 0) + tx.amount
    })

    const result = Object.keys(grouped).map((name) => ({
      name,
      value: grouped[name],
    }))

    // Sort by value descending
    return result.sort((a, b) => b.value - a.value).slice(0, 6)
  }, [filteredTransactions, categories])

  // Last 5 transactions (ignoring parent installment records)
  const latestTransactions = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          !(
            (t.installment_number === 0 || t.installment_number === undefined) &&
            (t.installments_total || 0) > 0
          ),
      )
      .slice(0, 5)
  }, [transactions])

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
              <SelectTrigger className="border-none shadow-none text-xs font-semibold h-8 w-[130px] focus:ring-0">
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
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

        {/* Card 2: Receitas do Período */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Receitas do Período</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 tabular-nums">
              <AnimatedCounter value={totalIncome} formatter={formatCurrency} />
            </div>
            <p className="text-[11px] text-emerald-600/80 font-medium mt-1">
              Entradas registradas no filtro
            </p>
          </div>
        </div>

        {/* Card 3: Despesas do Período */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Despesas do Período</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-600 tabular-nums">
              <AnimatedCounter value={totalExpense} formatter={formatCurrency} />
            </div>
            <p className="text-[11px] text-rose-600/80 font-medium mt-1">Saídas totais no filtro</p>
          </div>
        </div>

        {/* Card 4: Qtde Lançamentos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">Lançamentos no Período</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ReceiptText className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600 tabular-nums">
              <AnimatedCounter
                value={totalTxCount}
                formatter={(v) => `${Math.round(v)} registros`}
              />
            </div>
            <p className="text-[11px] text-purple-600/80 font-medium mt-1">
              Movimentações computadas
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section: 2/3 Area Chart + 1/3 Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart: Receitas vs Despesas (12 Meses) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Evolução Mensal (Receitas vs Despesas)
              </h2>
              <p className="text-xs text-slate-500">Histórico de movimentações no ano atual</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Receitas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-slate-600">Despesas</span>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthlyChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
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
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
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
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Gastos por Categoria */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Gastos por Categoria</h2>
            <p className="text-xs text-slate-500">Distribuição no período selecionado</p>
          </div>

          <div className="h-[240px] w-full flex items-center justify-center">
            {categoryDonutData.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma despesa no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryDonutData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
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
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Últimos Lançamentos + Contas com Maior Saldo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimos Lançamentos (2/3) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Últimos Lançamentos</h2>
              <p className="text-xs text-slate-500">Atividades financeiras recentes</p>
            </div>
            <Link
              to={`/controle/${currentCompany?.id}/lancamentos`}
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
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateBR(tx.date)}
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
                          {Boolean(
                            tx.parent_transaction_id ||
                            (tx.installment_number && tx.installment_number > 0),
                          ) && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                              title={`Parcela ${tx.installment_number || 1} de ${tx.installments_total || '?'}`}
                            >
                              <Package className="w-2.5 h-2.5 text-amber-600" />
                              <span>
                                {tx.installment_number || 1}/{tx.installments_total || '?'}
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
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                      Nenhum lançamento registrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Contas e Cartões (1/3) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Contas & Cartões</h2>
                <p className="text-xs text-slate-500">Distribuição de liquidez</p>
              </div>
              <Link
                to={`/controle/${currentCompany?.id}/contas`}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <span>Gerenciar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3.5">
              {accounts.map((acc) => {
                const isCredit = acc.type === 'credito'
                const usedPct =
                  isCredit && acc.limit ? Math.min((acc.balance / acc.limit) * 100, 100) : 0

                return (
                  <div
                    key={acc.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: acc.color }}
                        />
                        <span className="text-xs font-semibold text-slate-800">{acc.name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">
                        {formatCurrency(acc.balance)}
                      </span>
                    </div>

                    {isCredit && acc.limit && (
                      <div className="mt-2">
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all"
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>{usedPct.toFixed(0)}% do limite</span>
                          <span>Limite: {formatCurrency(acc.limit)}</span>
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

      {/* Transaction Modal */}
      <TransactionModal open={newTxOpen} onOpenChange={setNewTxOpen} />
      <AiTransactionModal open={aiTxOpen} onOpenChange={setAiTxOpen} />
    </div>
  )
}
