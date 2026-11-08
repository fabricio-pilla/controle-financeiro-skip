import { Transaction, TransactionType } from '@/types/database'
import { skipCloud } from '@/lib/skip-cloud'

export interface DuplicateCandidate {
  id: string
  description: string
  amount: number
  /** "YYYY-MM-DD" (data de pagamento com fallback para data da compra) */
  effectiveDate: string
  accountName?: string
}

/**
 * Busca no SERVIDOR lançamentos que já existem com valor idêntico (mesmos centavos)
 * na mesma data efetiva (payment_date com fallback para date), do mesmo tipo e da
 * mesma família (control_id). Busca server-side para alcançar meses não carregados
 * no cache local.
 */
export async function findDuplicateTransactions(params: {
  companyId: string
  amount: number
  /** "YYYY-MM-DD" — data efetiva do novo lançamento (payment_date com fallback para date) */
  effectiveDate: string
  type: TransactionType
  accountId?: string
  /** Ignorar o próprio registro em edições */
  excludeTransactionId?: string
}): Promise<DuplicateCandidate[]> {
  const { companyId, amount, effectiveDate, type, accountId, excludeTransactionId } = params

  if (!companyId || !effectiveDate || !Number.isFinite(amount)) return []

  // Valor idêntico em centavos: comparação exata com 2 casas
  const exactAmount = Math.round(Number(amount) * 100) / 100
  if (!Number.isFinite(exactAmount) || exactAmount <= 0) return []

  // Mesma data de pagamento/compra: payment_date quando preenchido, senão date
  const candidates = await skipCloud.getTransactions(companyId, {
    startDate: effectiveDate,
    endDate: effectiveDate,
  })

  return candidates
    .filter((t) => {
      if (excludeTransactionId && t.id === excludeTransactionId) return false
      if (t.type !== type) return false
      // A consulta por startDate/endDate já filtra pela data efetiva; reforçamos aqui
      const eff = t.payment_date || t.date
      if (!eff || eff.substring(0, 10) !== effectiveDate.substring(0, 10)) return false
      const txAmount = Math.round(Number(t.amount) * 100) / 100
      return Math.abs(txAmount - exactAmount) < 0.005
    })
    .map((t) => ({
      id: t.id,
      description: t.description || '',
      amount: Math.round(Number(t.amount) * 100) / 100,
      effectiveDate: (t.payment_date || t.date || effectiveDate).substring(0, 10),
      accountName: t.account?.name,
    }))
}
