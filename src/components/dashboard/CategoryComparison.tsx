import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Category, Transaction } from '@/types/database'
import { formatCurrency, getTxEffectiveDate } from '@/lib/formatters'
import { isParentTransaction } from '@/lib/transaction-propagation'

interface CategoryComparisonProps {
  categories: Category[]
  transactions: Transaction[]
  curYm: string
  prevYm: string
  curPeriodLabel?: string
  prevPeriodLabel?: string
}

interface CategoryStat {
  id: string
  name: string
  color?: string
  curAmount: number
  prevAmount: number
  diffAmount: number
  diffPct: number | null
}

export function CategoryComparison({
  categories,
  transactions,
  curYm,
  prevYm,
  curPeriodLabel = 'Este mês',
  prevPeriodLabel = 'Mês anterior',
}: CategoryComparisonProps) {
  const navigate = useNavigate()

  const stats = React.useMemo(() => {
    // Agrupar despesas por categoria no mês atual e mês anterior
    const curMap = new Map<string, number>()
    const prevMap = new Map<string, number>()

    transactions.forEach((tx) => {
      if (isParentTransaction(tx)) return
      if (tx.type !== 'despesa') return
      const effDate = getTxEffectiveDate(tx)
      if (!effDate) return

      const catId = tx.category_id || 'uncategorized'

      if (effDate.startsWith(curYm)) {
        curMap.set(catId, (curMap.get(catId) || 0) + tx.amount)
      } else if (effDate.startsWith(prevYm)) {
        prevMap.set(catId, (prevMap.get(catId) || 0) + tx.amount)
      }
    })

    // Reunir todas as categorias presentes em pelo menos um dos períodos
    const allCatIds = new Set<string>([...curMap.keys(), ...prevMap.keys()])
    const list: CategoryStat[] = []

    allCatIds.forEach((catId) => {
      const cat = categories.find((c) => c.id === catId)
      const name = cat?.name || (catId === 'uncategorized' ? 'Sem categoria' : 'Outros')
      const color = cat?.color || '#94a3b8'

      const curAmount = curMap.get(catId) || 0
      const prevAmount = prevMap.get(catId) || 0
      const diffAmount = curAmount - prevAmount

      let diffPct: number | null = null
      if (prevAmount > 0) {
        diffPct = ((curAmount - prevAmount) / prevAmount) * 100
      } else if (curAmount > 0) {
        diffPct = 100 // Novas despesas em categoria que não tinha gasto no mês anterior
      }

      list.push({
        id: catId,
        name,
        color,
        curAmount,
        prevAmount,
        diffAmount,
        diffPct,
      })
    })

    // Ordenar pelas categorias com maior volume de gastos no mês atual (ou maior variação absoluta se igual)
    list.sort(
      (a, b) => b.curAmount - a.curAmount || Math.abs(b.diffAmount) - Math.abs(a.diffAmount),
    )
    return list
  }, [categories, transactions, curYm, prevYm])

  const handleCategoryClick = (catId: string) => {
    const params = new URLSearchParams()
    if (catId !== 'uncategorized') {
      params.set('category', catId)
    }
    params.set('month', curYm)
    params.set('type', 'despesa')
    navigate(`/lancamentos?${params.toString()}`)
  }

  if (stats.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Comparativo por Categoria vs. Mês Anterior
            </h2>
            <p className="text-xs text-slate-500">
              Variação de despesas entre {prevPeriodLabel} e {curPeriodLabel}
            </p>
          </div>
        </div>
        <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Nenhuma despesa registrada para comparar nos períodos selecionados.
        </div>
      </div>
    )
  }

  // Destaques rápidos: onde mais aumentou e onde mais economizou
  const increasedList = stats.filter((s) => s.diffAmount > 0)
  const decreasedList = stats.filter((s) => s.diffAmount < 0)

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Comparativo por Categoria vs. Mês Anterior
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {curPeriodLabel} vs {prevPeriodLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifique onde os gastos aumentaram (▲ vermelho) ou diminuíram (▼ verde)
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Aumento
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Economia
            </span>
          </div>
        </div>

        {/* Grid de categorias */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stats.slice(0, 9).map((cat) => {
            const hasIncreased = cat.diffAmount > 0
            const hasDecreased = cat.diffAmount < 0
            const isZero = cat.diffAmount === 0

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300 transition-all text-left group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span
                        className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors"
                        title={cat.name}
                      >
                        {cat.name}
                      </span>
                    </div>

                    {/* Badge de variação percentual */}
                    {cat.diffPct !== null && !isZero ? (
                      <span
                        className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          hasIncreased
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                        title={`Variação de ${formatCurrency(Math.abs(cat.diffAmount))}`}
                      >
                        {hasIncreased ? (
                          <ArrowUp className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowDown className="w-3 h-3 mr-0.5" />
                        )}
                        {hasIncreased ? '+' : ''}
                        {cat.diffPct > 999 ? '>999%' : `${cat.diffPct.toFixed(0)}%`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 shrink-0">
                        <Minus className="w-2.5 h-2.5 mr-0.5" /> 0%
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mt-1">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">
                        {curPeriodLabel}
                      </p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatCurrency(cat.curAmount)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">
                        {prevPeriodLabel}
                      </p>
                      <p className="text-xs font-medium text-slate-500 tabular-nums">
                        {formatCurrency(cat.prevAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resumo textual contextual */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  {hasIncreased && (
                    <span className="text-rose-700 font-medium flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-rose-600" />+
                      {formatCurrency(cat.diffAmount)} vs mês passado
                    </span>
                  )}
                  {hasDecreased && (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-emerald-600" />
                      {formatCurrency(cat.diffAmount)} vs mês passado
                    </span>
                  )}
                  {isZero && <span className="text-slate-500 font-medium">Gastos estáveis</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
