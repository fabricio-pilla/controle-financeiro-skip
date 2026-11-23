/**
 * Helpers de agregação para a página de Relatórios.
 * Matriz anual de despesas: categoria → subcategoria × meses do ano,
 * com total, média mensal e tendência (comparação de médias móveis de 3 meses).
 */
import { getTxEffectiveDate } from '@/lib/formatters'
import { isParentTransaction } from '@/lib/transaction-propagation'
import type { Transaction } from '@/types/database'

export interface TrendInfo {
  status: 'alta' | 'queda' | 'estavel' | 'sem-dados'
  changePct: number | null
}

export interface MatrixRow {
  key: string
  id: string | null
  name: string
  color: string
  level: 'category' | 'subcategory'
  months: number[] // 12 posições (Jan..Dez)
  total: number
  average: number
  sharePct: number // % sobre o total de despesas do ano
  trend: TrendInfo
  children?: MatrixRow[]
  txCount: number
}

export const MONTH_LABELS = [
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

const NO_SUBCATEGORY = 'Sem subcategoria'

/**
 * Tendência: média dos 3 últimos meses COM dados do ano vs média dos 3 meses
 * anteriores COM dados. Aumento > 10% = alta; queda > 10% = queda; senão estável.
 */
export function computeTrend(months: number[]): TrendInfo {
  const idxWith: number[] = []
  for (let i = 0; i < 12; i++) {
    if (months[i] > 0.001) idxWith.push(i)
  }
  if (idxWith.length === 0) return { status: 'sem-dados', changePct: null }

  const last3 = idxWith.slice(-3)
  const prev3 = idxWith.length > 3 ? idxWith.slice(-6, -3) : []

  const avg = (arr: number[]) => arr.reduce((acc, i) => acc + months[i], 0) / arr.length
  const avgLast = avg(last3)
  if (prev3.length === 0) return { status: 'estavel', changePct: null }

  const avgPrev = avg(prev3)
  if (avgPrev <= 0.001) {
    // Nada no período anterior: todo o gasto surgiu recentemente → alta
    return { status: 'alta', changePct: 100 }
  }
  const changePct = ((avgLast - avgPrev) / avgPrev) * 100
  if (changePct > 10) return { status: 'alta', changePct }
  if (changePct < -10) return { status: 'queda', changePct }
  return { status: 'estavel', changePct }
}

/**
 * Constrói a matriz anual de despesas a partir dos lançamentos.
 * - Exclui transações-pai (isParentTransaction)
 * - Agrupa pela data efetiva (payment_date com fallback para date)
 * - Linhas = categorias de despesa; filhos = subcategorias agrupadas por nome
 */
export function buildExpenseMatrix(
  transactions: Transaction[],
  year: number,
): { rows: MatrixRow[]; yearTotal: number } {
  const yearPrefix = `${year}-`
  const expenseTxs = transactions.filter((t) => {
    if (t.type !== 'despesa') return false
    if (isParentTransaction(t)) return false
    const eff = getTxEffectiveDate(t)
    return Boolean(eff && eff.startsWith(yearPrefix))
  })

  // Mapa categoriaId → { meta, meses, subs: Map nome → meses }
  const catAgg = new Map<
    string,
    {
      name: string
      color: string
      months: number[]
      txCount: number
      subs: Map<string, { name: string; months: number[]; txCount: number }>
    }
  >()

  for (const t of expenseTxs) {
    const eff = getTxEffectiveDate(t)
    const monthIdx = Number(eff.substring(5, 7)) - 1
    if (monthIdx < 0 || monthIdx > 11) continue

    const catId = t.category_id || 'sem-categoria'
    let cat = catAgg.get(catId)
    if (!cat) {
      cat = {
        name: t.category?.name || 'Sem categoria',
        color: t.category?.color || '#94A3B8',
        months: new Array(12).fill(0),
        txCount: 0,
        subs: new Map(),
      }
      catAgg.set(catId, cat)
    }
    cat.months[monthIdx] += t.amount
    cat.txCount += 1

    const subName = t.subcategory?.name || NO_SUBCATEGORY
    let sub = cat.subs.get(subName)
    if (!sub) {
      sub = { name: subName, months: new Array(12).fill(0), txCount: 0 }
      cat.subs.set(subName, sub)
    }
    sub.months[monthIdx] += t.amount
    sub.txCount += 1
  }

  const yearTotal = expenseTxs.reduce((acc, t) => acc + t.amount, 0)

  const rows: MatrixRow[] = Array.from(catAgg.entries()).map(([catId, cat]) => {
    const total = cat.months.reduce((a, b) => a + b, 0)
    const activeMonths = cat.months.filter((v) => v > 0.001).length
    const children: MatrixRow[] = Array.from(cat.subs.values())
      .map((sub) => {
        const subTotal = sub.months.reduce((a, b) => a + b, 0)
        const subActive = sub.months.filter((v) => v > 0.001).length
        return {
          key: `${catId}:${sub.name}`,
          id: null,
          name: sub.name,
          color: cat.color,
          level: 'subcategory' as const,
          months: sub.months,
          total: subTotal,
          average: subActive > 0 ? subTotal / 12 : 0,
          sharePct: yearTotal > 0 ? (subTotal / yearTotal) * 100 : 0,
          trend: computeTrend(sub.months),
          txCount: sub.txCount,
        } satisfies MatrixRow
      })
      .sort((a, b) => b.total - a.total)

    return {
      key: catId,
      id: catId === 'sem-categoria' ? null : catId,
      name: cat.name,
      color: cat.color,
      level: 'category' as const,
      months: cat.months,
      total,
      average: activeMonths > 0 ? total / 12 : 0,
      sharePct: yearTotal > 0 ? (total / yearTotal) * 100 : 0,
      trend: computeTrend(cat.months),
      children,
      txCount: cat.txCount,
    } satisfies MatrixRow
  })

  rows.sort((a, b) => b.total - a.total)

  return { rows, yearTotal }
}
