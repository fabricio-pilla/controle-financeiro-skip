import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import { formatCurrency, getTxEffectiveDate } from '@/lib/formatters'
import { isParentTransaction } from '@/lib/transaction-propagation'
import { buildExpenseMatrix, MONTH_LABELS, type MatrixRow, type TrendInfo } from './reports-helpers'
import {
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

export default function ReportsPage() {
  const { transactions, loadTransactionsForMonths, isTransactionsLoading } = useCompany()
  const navigate = useNavigate()

  const currentYear = new Date().getFullYear()

  // Anos disponíveis: derivados dos dados + ano corrente
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear])
    for (const t of transactions) {
      const d = t.payment_date || t.date
      if (d && d.length >= 4) {
        const y = Number(d.substring(0, 4))
        if (!Number.isNaN(y) && y >= 2000 && y <= currentYear + 10) years.add(y)
      }
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [transactions, currentYear])

  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [isLoadingYear, setIsLoadingYear] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  // Carrega os 12 meses do ano selecionado
  useEffect(() => {
    let cancelled = false
    const loadYear = async () => {
      setIsLoadingYear(true)
      try {
        const months: string[] = []
        for (let m = 1; m <= 12; m++) {
          months.push(`${selectedYear}-${String(m).padStart(2, '0')}`)
        }
        await loadTransactionsForMonths(months)
      } catch (err) {
        console.warn('[ReportsPage] Erro ao carregar ano:', err)
      } finally {
        if (!cancelled) setIsLoadingYear(false)
      }
    }
    loadYear()
    return () => {
      cancelled = true
    }
  }, [selectedYear, loadTransactionsForMonths])

  // Lançamentos de despesa do ano selecionado (exclui transações-pai)
  const yearTxs = useMemo(() => {
    const prefix = `${selectedYear}-`
    return transactions.filter((t) => {
      if (t.type !== 'despesa') return false
      if (isParentTransaction(t)) return false
      const eff = getTxEffectiveDate(t)
      return Boolean(eff && eff.startsWith(prefix))
    })
  }, [transactions, selectedYear])

  const matrix = useMemo(
    () => buildExpenseMatrix(transactions, selectedYear),
    [transactions, selectedYear],
  )
  const hasData = matrix.rows.length > 0

  // Dados do gráfico: top 6 categorias por total do ano, mês a mês
  const chartData = useMemo(() => {
    const top = matrix.rows.slice(0, 6)
    return MONTH_LABELS.map((label, monthIdx) => {
      const row: Record<string, string | number> = { month: label }
      top.forEach((cat) => {
        row[cat.name] = Number(cat.months[monthIdx].toFixed(2))
      })
      return row
    })
  }, [matrix.rows])

  const chartColors = useMemo(() => {
    const map: Record<string, string> = {}
    matrix.rows.slice(0, 6).forEach((cat) => {
      map[cat.name] = cat.color
    })
    return map
  }, [matrix.rows])

  const toggleExpand = (key: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const goToExtract = (categoryId: string | null, monthIdx: number) => {
    const params = new URLSearchParams()
    params.set('month', `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`)
    if (categoryId) params.set('category', categoryId)
    navigate(`/lancamentos?${params.toString()}`)
  }

  const renderTrendCell = (trend: TrendInfo) => {
    if (trend.status === 'sem-dados' || trend.changePct === null) {
      return <span className="text-slate-300 font-medium">–</span>
    }
    const sign = trend.changePct > 0 ? '+' : ''
    const pct = `${sign}${Math.abs(trend.changePct) >= 100 ? Math.round(trend.changePct) : trend.changePct.toFixed(1)}%`
    if (trend.status === 'alta') {
      return (
        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-xs">
          <TrendingUp className="w-3.5 h-3.5" />
          {pct}
        </span>
      )
    }
    if (trend.status === 'queda') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
          <TrendingDown className="w-3.5 h-3.5" />
          {pct}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-xs">
        <Minus className="w-3.5 h-3.5" />
        {pct}
      </span>
    )
  }

  const renderRow = (row: MatrixRow, isSub = false) => {
    const isExpanded = expandedCats.has(row.key)
    const isRising = !isSub && row.trend.status === 'alta' && row.total > 0
    return (
      <>
        <tr
          key={row.key}
          className={`border-b border-slate-100 ${isRising ? 'bg-rose-50/60' : ''} ${isSub ? 'bg-slate-50/50' : 'hover:bg-slate-50/80'} transition-colors`}
        >
          <td className={`py-2.5 pl-3 pr-2 ${isSub ? '' : 'font-semibold text-slate-800'}`}>
            <div className="flex items-center gap-1.5 min-w-[140px]">
              {!isSub && row.children && row.children.length > 0 ? (
                <button
                  onClick={() => toggleExpand(row.key)}
                  className="p-0.5 rounded hover:bg-slate-200 text-slate-500 shrink-0"
                  aria-label={isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span
                className={`truncate text-xs ${isSub ? 'text-slate-500 pl-3' : ''}`}
                title={row.name}
              >
                {row.name}
              </span>
            </div>
          </td>
          {row.months.map((value, mi) => (
            <td key={mi} className="py-2.5 px-1.5 text-right">
              {row.id && value > 0.001 ? (
                <button
                  onClick={() => goToExtract(row.id, mi)}
                  className="w-full text-right text-xs tabular-nums text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded px-1 py-0.5 transition-colors"
                  title={`Ver lançamentos de ${MONTH_LABELS[mi]} em ${row.name}`}
                >
                  {formatCurrency(value)}
                </button>
              ) : value > 0.001 ? (
                <span className="text-xs tabular-nums text-slate-600">{formatCurrency(value)}</span>
              ) : (
                <span className="text-xs text-slate-300">–</span>
              )}
            </td>
          ))}
          <td className="py-2.5 px-2 text-right text-xs font-bold tabular-nums text-slate-800">
            {formatCurrency(row.total)}
          </td>
          <td className="py-2.5 px-2 text-right text-xs tabular-nums text-slate-500">
            {row.total > 0.001 ? (
              formatCurrency(row.average)
            ) : (
              <span className="text-slate-300">–</span>
            )}
          </td>
          <td className="py-2.5 px-2 text-right">{!isSub && renderTrendCell(row.trend)}</td>
          <td className="py-2.5 pr-3 pl-1 min-w-[90px]">
            {!isSub && (
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(row.sharePct, 100).toFixed(1)}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums w-9 text-right shrink-0">
                  {row.sharePct.toFixed(1)}%
                </span>
              </div>
            )}
          </td>
        </tr>
        {isSub === false && isExpanded && row.children?.map((c) => renderRow(c, true))}
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Relatórios
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão anual das despesas por categoria e subcategoria — veja facilmente onde os gastos
            estão aumentando.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
          {isLoadingYear || isTransactionsLoading ? (
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
          ) : (
            <BarChart3 className="w-4 h-4 text-slate-400" />
          )}
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="border-none shadow-none text-xs font-semibold h-8 w-[110px] focus:ring-0">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legenda de tendência */}
      {hasData && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-rose-500" /> Em alta (&gt;+10%)
          </span>
          <span className="inline-flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-500" /> Em queda (&gt;−10%)
          </span>
          <span className="inline-flex items-center gap-1">
            <Minus className="w-3.5 h-3.5 text-slate-400" /> Estável
          </span>
          <span className="text-slate-400">
            Compara a média dos 3 últimos meses com dados do ano contra a média dos 3 anteriores.
          </span>
        </div>
      )}

      {/* Matriz anual */}
      {isLoadingYear && !hasData ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mr-2" />
          <span className="text-sm text-slate-500">Carregando dados de {selectedYear}…</span>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 px-6 text-center">
          <Info className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">
            Nenhuma despesa registrada em {selectedYear}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Selecione outro ano no seletor acima ou registre lançamentos para visualizar o
            relatório.
          </p>
        </div>
      ) : (
        <>
          {/* Matriz */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left py-3 pl-3 pr-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide sticky left-0 bg-slate-50/80 min-w-[160px]">
                      Categoria / Subcategoria
                    </th>
                    {MONTH_LABELS.map((m) => (
                      <th
                        key={m}
                        className="py-3 px-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right"
                      >
                        {m}
                      </th>
                    ))}
                    <th className="py-3 px-2 text-[11px] font-semibold text-slate-600 uppercase tracking-wide text-right">
                      Total
                    </th>
                    <th className="py-3 px-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right">
                      Média
                    </th>
                    <th className="py-3 px-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right">
                      Tendência
                    </th>
                    <th className="py-3 pr-3 pl-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-left min-w-[90px]">
                      % do ano
                    </th>
                  </tr>
                </thead>
                <tbody>{matrix.rows.map((row) => renderRow(row))}</tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200">
                    <td className="py-3 pl-3 pr-2 text-xs font-extrabold text-slate-800">
                      TOTAL GERAL
                    </td>
                    {matrix.rows[0].months.map((_, mi) => {
                      const monthTotal = matrix.rows.reduce((acc, r) => acc + r.months[mi], 0)
                      return (
                        <td
                          key={mi}
                          className="py-3 px-1.5 text-right text-xs font-bold tabular-nums text-slate-700"
                        >
                          {monthTotal > 0.001 ? (
                            formatCurrency(monthTotal)
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="py-3 px-2 text-right text-xs font-extrabold tabular-nums text-indigo-700">
                      {formatCurrency(matrix.yearTotal)}
                    </td>
                    <td className="py-3 px-2 text-right text-xs font-bold tabular-nums text-slate-600">
                      {formatCurrency(matrix.yearTotal / 12)}
                    </td>
                    <td colSpan={2} className="py-3 pr-3 px-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Gráfico de evolução: top 6 categorias */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-1">
              Evolução mensal — Top {Math.min(6, matrix.rows.length)} categorias
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Despesas por mês ao longo de {selectedYear}. Passe o mouse para ver os valores.
            </p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v: number) =>
                      `R$ ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`
                    }
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value: number | string, name: string) => [
                      formatCurrency(Number(value)),
                      name,
                    ]}
                    labelFormatter={(label) => `${label} de ${selectedYear}`}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E2E8F0',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  {matrix.rows.slice(0, 6).map((cat) => (
                    <Area
                      key={cat.key}
                      type="monotone"
                      dataKey={cat.name}
                      stackId="1"
                      stroke={chartColors[cat.name]}
                      fill={chartColors[cat.name]}
                      fillOpacity={0.35}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <Info className="w-3 h-3" />
        {matrix.rows.length} categorias ·{' '}
        {matrix.rows.reduce((a, r) => a + (r.children?.length || 0), 0)} subcategorias ·{' '}
        {yearTxs.length} lançamentos de despesa em {selectedYear}. Clique em uma categoria para
        expandir e em um valor para abrir o extrato do mês.
      </p>
    </div>
  )
}
