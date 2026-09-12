import { Transaction, TransactionType } from '@/types/database'

export interface RecurringGenerationCandidate {
  control_id: string
  user_id: string
  type: TransactionType
  amount: number
  description: string
  category_id: string
  subcategory_id: string
  account_id: string
  credit_card_id?: string
  date: string
  payment_date: string
  paid: boolean
  is_recurring: boolean
  recurring: boolean
  recurrence_type: string
  recurrence_period: string
  installment_number: number
  installment_total: number
  parent_transaction_id: string
  notes: string
}

export interface InstallmentGenerationCandidate {
  control_id: string
  user_id: string
  type: TransactionType
  amount: number
  description: string
  category_id: string
  subcategory_id: string
  account_id: string
  credit_card_id?: string
  date: string
  payment_date: string
  paid: boolean
  recurring: boolean
  is_recurring: boolean
  recurrence_type: string
  recurrence_period: string
  installment_number: number
  installment_total: number
  parent_transaction_id: string
  notes: string
}

/**
 * Remove sufixos comuns de descrição como "(1/10)" ou "(Total: R$ 500,00)"
 */
export function cleanDescription(desc: string): string {
  if (!desc) return 'Sem descrição'
  let res = desc.replace(/\s*\(Total:\s*R\$[^)]+\)\s*$/i, '').trim()
  res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
  return res || 'Sem descrição'
}

/**
 * Normaliza e extrai ano, mês (1-12) e dia de uma string de data (YYYY-MM-DD ou ISO).
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  if (!dateStr) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
  }
  const clean = dateStr.split(/[T\s]/)[0]
  const [y, m, d] = clean.split('-')
  const year = parseInt(y, 10)
  const month = parseInt(m, 10)
  const day = parseInt(d, 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
  }
  return { year, month, day }
}

/**
 * Adiciona N meses a um ano/mês base mantendo o dia original limitado ao último dia do mês alvo.
 * Retorna string "YYYY-MM-DD 00:00:00.000Z".
 */
export function computeTargetDate(
  baseYear: number,
  baseMonth: number,
  origDay: number,
  monthOffset: number,
): string {
  const totalMonths = baseMonth - 1 + monthOffset
  const targetYear = baseYear + Math.floor(totalMonths / 12)
  const targetMonth = ((totalMonths % 12) + 12) % 12 // 0-11

  // Último dia do mês alvo em UTC
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const targetDay = Math.min(Math.max(1, origDay), lastDay)

  const yyyy = String(targetYear).padStart(4, '0')
  const mm = String(targetMonth + 1).padStart(2, '0')
  const dd = String(targetDay).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} 00:00:00.000Z`
}

/**
 * Retorna a chave canônica "YYYY-MM" para o mês e ano dados
 */
export function getYearMonth(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

/**
 * Checa se uma transação pertence ao mês atual (base)
 */
export function isTransactionInCurrentMonth(
  txDate: string,
  currentYear: number,
  currentMonth: number,
): boolean {
  if (!txDate) return false
  const currentYM = getYearMonth(currentYear, currentMonth)
  return txDate.startsWith(currentYM)
}

/**
 * Identifica ocorrências futuras de recorrências a partir dos lançamentos do mês atual.
 * - Base = lançamentos de recorrência do mês atual
 * - Início da geração = mês seguinte ao atual (offset 1..12)
 * - Exatamente 12 meses futuros
 * - Idempotente: se já existir ocorrência naquele YYYY-MM para a série, não gera de novo.
 */
export function planNextRecurringTransactions({
  currentMonthTransactions,
  existingTransactions,
  currentCompanyId,
  currentUserId,
  currentYear,
  currentMonth,
}: {
  currentMonthTransactions: Transaction[]
  existingTransactions: Transaction[]
  currentCompanyId: string
  currentUserId: string
  currentYear: number
  currentMonth: number
}): RecurringGenerationCandidate[] {
  // 1. Filtrar seeds do mês atual
  const recurringSeeds = currentMonthTransactions.filter(
    (t) =>
      t.control_id === currentCompanyId &&
      Boolean(
        t.is_recurring || t.recurring || (t.recurrence_type && t.recurrence_type.trim() !== ''),
      ) &&
      // Não é pai consolidado de parcelamento
      !(
        (Number(t.installment_number) === 0 || t.installment_number === undefined) &&
        Number(t.installments_total || (t as any).installment_total || 0) > 1
      ),
  )

  // 2. Desduplicar seeds do mês atual por chave canônica
  // Chave: type_account_amount_cleanDesc
  const canonicalMap = new Map<string, Transaction>()
  for (const t of recurringSeeds) {
    const cleanD = cleanDescription(t.description).toLowerCase()
    const key = `${t.type}_${t.account_id || ''}_${t.amount}_${cleanD}`
    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, t)
    } else {
      // Se houver mais de um no mês atual, manter o de maior data
      const existing = canonicalMap.get(key)!
      if (t.date > existing.date) {
        canonicalMap.set(key, t)
      }
    }
  }

  // 3. Montar conjunto de checagem rápida de ocorrências existentes
  const existingSet = new Set<string>()
  for (const t of existingTransactions) {
    if (!t.date || t.control_id !== currentCompanyId) continue
    const ym = t.date.substring(0, 7)
    const cleanD = cleanDescription(t.description).toLowerCase()
    const key = `${t.type}_${t.account_id || ''}_${t.amount}_${cleanD}_${ym}`
    existingSet.add(key)
  }

  const planned: RecurringGenerationCandidate[] = []

  // 4. Para cada série única, gerar exatamente 12 meses começando no mês seguinte (m=1..12)
  for (const seed of canonicalMap.values()) {
    const cleanD = cleanDescription(seed.description).toLowerCase()
    const origParts = parseDateParts(seed.date)
    const origDay = origParts.day

    for (let m = 1; m <= 12; m++) {
      const targetDateStr = computeTargetDate(currentYear, currentMonth, origDay, m)
      const targetYM = targetDateStr.substring(0, 7)
      const checkKey = `${seed.type}_${seed.account_id || ''}_${seed.amount}_${cleanD}_${targetYM}`

      if (existingSet.has(checkKey)) {
        continue // Idempotente
      }

      // Marcar no existingSet para não duplicar se houver colisão interna
      existingSet.add(checkKey)

      planned.push({
        control_id: currentCompanyId,
        user_id: currentUserId || seed.user_id || '',
        type: seed.type,
        amount: seed.amount,
        description: cleanDescription(seed.description),
        category_id: seed.category_id || '',
        subcategory_id: seed.subcategory_id || '',
        account_id: seed.account_id || '',
        credit_card_id: (seed as any).credit_card_id || '',
        date: targetDateStr,
        payment_date: '',
        paid: false,
        is_recurring: true,
        recurring: true,
        recurrence_type: seed.recurrence_type || 'mensal',
        recurrence_period: (seed as any).recurrence_period || seed.recurrence_type || 'mensal',
        installment_number: 1,
        installment_total: 0,
        parent_transaction_id: '',
        notes: seed.notes || '',
      })
    }
  }

  return planned
}

export interface InstallmentSeriesFromCurrentMonth {
  parentId: string
  baseDesc: string
  totalInstallments: number
  currentMonthParcelNumber: number
  currentMonthParcelDate: string
  currentMonthTx: Transaction
  allDaughters: Transaction[]
  existingNumbers: Set<number>
  maxExistingNumber: number
}

/**
 * Identifica as séries parceladas presentes no mês atual e planeja as próximas parcelas.
 * - Base = parcelas no mês atual (filha com installment_number >= 1 e total > 1)
 * - Primeiro lançamento futuro = mês seguinte ao atual (não mexe no mês atual)
 * - Continua do max(installment_number existente) + 1 ou currentNum + 1 em diante
 * - Limites: para quando atingir totalInstallments OU no máximo +12 novas parcelas por série
 * - Preserva rateio de centavos (última parcela absorve centavos arredondados)
 * - Idempotente: não gera parcelas cujos números já existam
 */
export function planNextInstallmentTransactions({
  currentMonthTransactions,
  allCompanyTransactions,
  currentCompanyId,
  currentUserId,
  currentYear,
  currentMonth,
}: {
  currentMonthTransactions: Transaction[]
  allCompanyTransactions: Transaction[]
  currentCompanyId: string
  currentUserId: string
  currentYear: number
  currentMonth: number
}): InstallmentGenerationCandidate[] {
  // 1. Filtrar parcelas filhas do mês atual
  // installment_number >= 1 e installment_total > 1
  const currentMonthDaughters = currentMonthTransactions.filter((t) => {
    if (t.control_id !== currentCompanyId) return false
    const num = Number(t.installment_number || 0)
    const total = Number(t.installments_total || (t as any).installment_total || 0)
    return num >= 1 && total > 1
  })

  if (currentMonthDaughters.length === 0) {
    return []
  }

  // 2. Todas as filhas do controle para agrupar e checar números já existentes
  const allDaughters = allCompanyTransactions.filter((t) => {
    if (t.control_id !== currentCompanyId) return false
    const num = Number(t.installment_number || 0)
    const total = Number(t.installments_total || (t as any).installment_total || 0)
    return num >= 1 && total > 1
  })

  // Todos os registros pais consolidados (installment_number=0 e total > 1)
  const allParents = allCompanyTransactions.filter((t) => {
    if (t.control_id !== currentCompanyId) return false
    const num = Number(t.installment_number || 0)
    const total = Number(t.installments_total || (t as any).installment_total || 0)
    return num === 0 && total > 1
  })
  const parentById = new Map<string, Transaction>()
  allParents.forEach((p) => parentById.set(p.id, p))

  // 3. Agrupar filhas do mês atual por série
  // Chave de série: parent_transaction_id (se houver) OU (type_account_cleanDesc_total)
  const seriesMap = new Map<string, InstallmentSeriesFromCurrentMonth>()

  for (const daughter of currentMonthDaughters) {
    const total = Number(daughter.installments_total || (daughter as any).installment_total || 0)
    const num = Number(daughter.installment_number || 1)
    const baseD = cleanDescription(daughter.description)
    const parentId = daughter.parent_transaction_id || ''

    const seriesKey = parentId
      ? `parent_${parentId}`
      : `desc_${daughter.type}_${daughter.account_id || ''}_${baseD.toLowerCase()}_${total}`

    if (!seriesMap.has(seriesKey)) {
      // Encontrar todas as filhas dessa série no controle inteiro
      const daughtersOfSeries = allDaughters.filter((d) => {
        if (parentId && d.parent_transaction_id === parentId) return true
        const dTotal = Number(d.installments_total || (d as any).installment_total || 0)
        return (
          dTotal === total &&
          cleanDescription(d.description).toLowerCase() === baseD.toLowerCase() &&
          d.type === daughter.type
        )
      })

      const existingNumbers = new Set<number>()
      let maxNum = 0
      for (const d of daughtersOfSeries) {
        const dNum = Number(d.installment_number || 0)
        if (dNum > 0) {
          existingNumbers.add(dNum)
          if (dNum > maxNum) maxNum = dNum
        }
      }

      seriesMap.set(seriesKey, {
        parentId,
        baseDesc: baseD,
        totalInstallments: total,
        currentMonthParcelNumber: num,
        currentMonthParcelDate: daughter.date,
        currentMonthTx: daughter,
        allDaughters: daughtersOfSeries,
        existingNumbers,
        maxExistingNumber: maxNum,
      })
    } else {
      // Se houver mais de uma parcela no mês atual da mesma série (incomum), atualiza se num maior
      const cur = seriesMap.get(seriesKey)!
      if (num > cur.currentMonthParcelNumber) {
        cur.currentMonthParcelNumber = num
        cur.currentMonthParcelDate = daughter.date
        cur.currentMonthTx = daughter
      }
    }
  }

  const planned: InstallmentGenerationCandidate[] = []

  // 4. Para cada série identificada no mês atual, gerar parcelas futuras
  for (const series of seriesMap.values()) {
    const curNum = series.currentMonthParcelNumber
    const total = series.totalInstallments

    // Se já estamos na última parcela ou além, não há o que gerar
    if (curNum >= total) {
      continue
    }

    // Ponto de partida para novos números:
    // O usuário especificou: a partir da parcela do mês atual (ex: 7/10), gerar as próximas
    // a partir do mês seguinte ao atual. Se por acaso já existirem números > curNum,
    // garantimos idempotência não duplicando nenhum existente.
    const startNum = Math.max(curNum, series.maxExistingNumber) + 1

    // Limite de parcelas novas a gerar: no máximo 12 ou até atingir total
    // Ex: 7/10 -> gera 8, 9, 10 (3 parcelas)
    // Ex: 3/79 -> gera 4..15 (12 parcelas)
    const maxNumToGenerate = Math.min(total, startNum + 12 - 1)

    // Se startNum > total, já terminou
    if (startNum > total) {
      continue
    }

    // Calcular valores rateados
    const parent = series.parentId ? parentById.get(series.parentId) : undefined
    let baseParcelAmount = series.currentMonthTx.amount
    let lastParcelAmount = series.currentMonthTx.amount

    if (parent && parent.amount > 0) {
      baseParcelAmount = Math.round((parent.amount / total) * 100) / 100
      lastParcelAmount = Math.round((parent.amount - baseParcelAmount * (total - 1)) * 100) / 100
    }

    const curParts = parseDateParts(series.currentMonthParcelDate)
    const origDay = curParts.day

    // Gerar números de startNum até maxNumToGenerate
    for (let n = startNum; n <= maxNumToGenerate; n++) {
      if (series.existingNumbers.has(n)) {
        continue // Idempotência garantida
      }

      // Distância em meses em relação ao mês atual:
      // A primeira futura (curNum + 1) cai exatamente no mês seguinte ao atual (offset = 1)
      const monthOffset = n - curNum
      const targetDateStr = computeTargetDate(currentYear, currentMonth, origDay, monthOffset)

      const parcelAmount = n === total ? lastParcelAmount : baseParcelAmount
      const parcelDesc = `${series.baseDesc} (${n}/${total})`

      series.existingNumbers.add(n)

      planned.push({
        control_id: currentCompanyId,
        user_id: currentUserId || series.currentMonthTx.user_id || '',
        type: series.currentMonthTx.type,
        amount: parcelAmount,
        description: parcelDesc,
        category_id: series.currentMonthTx.category_id || '',
        subcategory_id: series.currentMonthTx.subcategory_id || '',
        account_id: series.currentMonthTx.account_id || '',
        credit_card_id: (series.currentMonthTx as any).credit_card_id || '',
        date: targetDateStr,
        payment_date: targetDateStr,
        paid: false, // Futuras sempre criadas como pendentes
        recurring: false,
        is_recurring: false,
        recurrence_type: '',
        recurrence_period: '',
        installment_number: n,
        installment_total: total,
        parent_transaction_id: series.parentId || series.currentMonthTx.parent_transaction_id || '',
        notes: 'Gerado automaticamente: parcela da série',
      })
    }
  }

  return planned
}
