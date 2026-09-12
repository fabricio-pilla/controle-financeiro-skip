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

/**
 * Cria em lote as ocorrências planejadas com tratamento anti-429 (executeWithRetry + runInPool).
 * Retorna as transações criadas e a quantidade de falhas.
 */
export async function createPlannedTransactionsInPool({
  plannedItems,
  onProgress,
}: {
  plannedItems: RecurringGenerationCandidate[] | InstallmentGenerationCandidate[]
  onProgress?: (done: number, total: number) => void
}): Promise<{
  created: Transaction[]
  failedCount: number
}> {
  if (!plannedItems || plannedItems.length === 0) {
    return { created: [], failedCount: 0 }
  }

  const pb = (await import('@/lib/pocketbase/client')).default
  const { runInPool, executeWithRetry } = await import('@/lib/pocketbase/retry')

  const created: Transaction[] = []
  let failedCount = 0

  await runInPool(
    plannedItems,
    async (item) => {
      try {
        const rec = await executeWithRetry(
          () => pb.collection('transactions').create(item),
          7,
          1000,
          'CREATE_PLANNED_TX',
          30000,
        )

        if (rec) {
          const r = rec as any
          created.push({
            id: r.id,
            control_id: r.control_id || item.control_id,
            user_id: r.user_id || item.user_id,
            type: r.type,
            amount: Number(r.amount),
            description: r.description,
            category_id: r.category_id || '',
            subcategory_id: r.subcategory_id || undefined,
            account_id: r.account_id || '',
            date: r.date ? String(r.date).split(/[T\s]/)[0] : item.date.split(/[T\s]/)[0],
            payment_date: r.payment_date
              ? String(r.payment_date).split(/[T\s]/)[0]
              : r.date
                ? String(r.date).split(/[T\s]/)[0]
                : item.date.split(/[T\s]/)[0],
            paid: Boolean(r.paid),
            is_recurring: Boolean(r.is_recurring),
            recurring: Boolean(r.recurring || r.is_recurring),
            recurrence_type: r.recurrence_type || undefined,
            installment_number: r.installment_number ? Number(r.installment_number) : undefined,
            installments_total: r.installment_total
              ? Number(r.installment_total)
              : r.installments_total
                ? Number(r.installments_total)
                : undefined,
            parent_transaction_id: r.parent_transaction_id || undefined,
            notes: r.notes || undefined,
            created_at: r.created || new Date().toISOString(),
          } as Transaction)
        }
      } catch (err: any) {
        console.warn(
          `[createPlannedTransactionsInPool] Falha ao criar lançamento "${item.description}":`,
          err?.message || err,
        )
        failedCount++
      }
    },
    {
      concurrency: 2,
      delayBetweenBatchesMs: 250,
      maxRetries: 7,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      tag: 'CREATE_PLANNED_POOL',
      onProgress,
    },
  )

  return { created, failedCount }
}

/**
 * Dispara em segundo plano a geração automática de 12 ocorrências futuras para um lançamento recorrente recém criado ou editado.
 * Idempotente e resiliente: se falhar por limite/429 ou erro de rede, notifica via toast sem quebrar a tela.
 */
export async function triggerAutoRecurringGeneration({
  sourceTransaction,
  existingTransactions,
  currentCompanyId,
  currentUserId,
  onSuccessCreated,
}: {
  sourceTransaction: Transaction | RecurringGenerationCandidate | any
  existingTransactions: Transaction[]
  currentCompanyId: string
  currentUserId: string
  onSuccessCreated?: (createdList: Transaction[]) => void
}): Promise<void> {
  const isRec = Boolean(
    sourceTransaction.is_recurring ||
    sourceTransaction.recurring ||
    (sourceTransaction.recurrence_type && sourceTransaction.recurrence_type.trim() !== ''),
  )
  if (!isRec) return

  const planned = planOccurrencesForSingleRecurring({
    sourceTransaction,
    existingTransactions,
    currentCompanyId,
    currentUserId,
  })

  if (planned.length === 0) return

  const { toast } = await import('sonner')

  try {
    const { created, failedCount } = await createPlannedTransactionsInPool({
      plannedItems: planned,
    })

    if (created.length > 0 && onSuccessCreated) {
      onSuccessCreated(created)
    }

    if (failedCount > 0 && created.length === 0) {
      toast.warning(
        'O lançamento principal foi salvo, mas não foi possível gerar todas as 12 ocorrências futuras automáticas devido ao limite do servidor. Use o botão "Gerar recorrentes" para completar.',
        { duration: 8000 },
      )
    } else if (failedCount > 0) {
      toast.warning(
        `Foram geradas automaticamente ${created.length} ocorrência(s) futuras, mas ${failedCount} ficaram pendentes. Use o botão "Gerar recorrentes" para concluir.`,
        { duration: 8000 },
      )
    }
  } catch (err: any) {
    console.warn('[triggerAutoRecurringGeneration] Falha geral na geração automática:', err)
    toast.warning(
      'O lançamento principal foi salvo, mas a geração automática das parcelas futuras falhou. Você pode gerá-las a qualquer momento pelo botão "Gerar recorrentes".',
      { duration: 8000 },
    )
  }
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
 * Planeja as 12 próximas ocorrências mensais de um lançamento recorrente individual.
 * - Início da geração = mês SEGUINTE ao da data do lançamento (offset 1..12)
 * - Preserva o dia original da data do lançamento (com ajuste automático para o último dia do mês alvo)
 * - Idempotente: se já existir ocorrência naquele YYYY-MM para a série no existingTransactions, não gera de novo.
 */
export function planOccurrencesForSingleRecurring({
  sourceTransaction,
  existingTransactions,
  currentCompanyId,
  currentUserId,
}: {
  sourceTransaction: Transaction | RecurringGenerationCandidate | any
  existingTransactions: Transaction[]
  currentCompanyId: string
  currentUserId: string
}): RecurringGenerationCandidate[] {
  const isRec = Boolean(
    sourceTransaction.is_recurring ||
    sourceTransaction.recurring ||
    (sourceTransaction.recurrence_type && sourceTransaction.recurrence_type.trim() !== ''),
  )
  if (!isRec) return []

  // Ignorar pais consolidados de parcelamentos
  const instTotal = Number(
    sourceTransaction.installments_total ||
      sourceTransaction.installment_total ||
      (sourceTransaction as any).installments_total ||
      0,
  )
  const instNum = Number(sourceTransaction.installment_number || 0)
  if (instNum === 0 && instTotal > 1) {
    return []
  }

  const cleanD = cleanDescription(sourceTransaction.description).toLowerCase()
  const origParts = parseDateParts(sourceTransaction.date)
  const baseYear = origParts.year
  const baseMonth = origParts.month
  const origDay = origParts.day

  // Montar conjunto de checagem rápida de ocorrências existentes
  const existingSet = new Set<string>()
  for (const t of existingTransactions) {
    if (!t.date || (t.control_id && t.control_id !== currentCompanyId)) continue
    const ym = t.date.substring(0, 7)
    const d = cleanDescription(t.description).toLowerCase()
    const key = `${t.type}_${t.account_id || ''}_${t.amount}_${d}_${ym}`
    existingSet.add(key)
  }

  // Também não duplicar a própria transação fonte
  const sourceYM = getYearMonth(baseYear, baseMonth)
  existingSet.add(
    `${sourceTransaction.type}_${sourceTransaction.account_id || ''}_${sourceTransaction.amount}_${cleanD}_${sourceYM}`,
  )

  const planned: RecurringGenerationCandidate[] = []

  for (let m = 1; m <= 12; m++) {
    const targetDateStr = computeTargetDate(baseYear, baseMonth, origDay, m)
    const targetYM = targetDateStr.substring(0, 7)
    const checkKey = `${sourceTransaction.type}_${sourceTransaction.account_id || ''}_${sourceTransaction.amount}_${cleanD}_${targetYM}`

    if (existingSet.has(checkKey)) {
      continue // Idempotente
    }

    existingSet.add(checkKey)

    planned.push({
      control_id: currentCompanyId,
      user_id: currentUserId || sourceTransaction.user_id || '',
      type: sourceTransaction.type,
      amount: sourceTransaction.amount,
      description: cleanDescription(sourceTransaction.description),
      category_id: sourceTransaction.category_id || '',
      subcategory_id: sourceTransaction.subcategory_id || '',
      account_id: sourceTransaction.account_id || '',
      credit_card_id: (sourceTransaction as any).credit_card_id || '',
      date: targetDateStr,
      payment_date: '',
      paid: false,
      is_recurring: true,
      recurring: true,
      recurrence_type:
        sourceTransaction.recurrence_type ||
        (sourceTransaction as any).recurrence_period ||
        'mensal',
      recurrence_period:
        (sourceTransaction as any).recurrence_period ||
        sourceTransaction.recurrence_type ||
        'mensal',
      installment_number: 1,
      installment_total: 0,
      parent_transaction_id: '',
      notes: sourceTransaction.notes || 'Gerado automaticamente: recorrência mensal',
    })
  }

  return planned
}

/**
 * Identifica ocorrências futuras de recorrências no controle.
 * - Varre todas as recorrências existentes no controle (passadas, atuais ou futuras)
 * - Desduplica séries por chave canônica (type_account_amount_cleanDesc)
 * - Regra de início:
 *    - Se a data do lançamento base for FUTURA em relação ao mês atual (ex: base em out/2026 e mês atual set/2026):
 *      começa no mês seguinte ao da data dela (nov/2026), gerando 12 meses a partir dali.
 *    - Se for do mês atual ou passada: começa no mês seguinte ao mês atual (m=1..12), preservando o dia da data base.
 * - Idempotente: se já existir ocorrência naquele YYYY-MM para a série, não gera de novo.
 */
export function planNextRecurringTransactions({
  allTransactions,
  currentMonthTransactions,
  existingTransactions,
  currentCompanyId,
  currentUserId,
  currentYear,
  currentMonth,
}: {
  allTransactions?: Transaction[]
  currentMonthTransactions?: Transaction[]
  existingTransactions: Transaction[]
  currentCompanyId: string
  currentUserId: string
  currentYear: number
  currentMonth: number
}): RecurringGenerationCandidate[] {
  // Coletar a base de candidatos: pode vir de allTransactions (preferencial) ou currentMonthTransactions (fallback de compatibilidade)
  const candidatePool =
    allTransactions && allTransactions.length > 0
      ? allTransactions
      : currentMonthTransactions || existingTransactions

  // 1. Filtrar seeds recorrentes
  const recurringSeeds = candidatePool.filter(
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

  // 2. Desduplicar seeds por chave canônica
  // Chave: type_account_amount_cleanDesc
  const canonicalMap = new Map<string, Transaction>()
  for (const t of recurringSeeds) {
    const cleanD = cleanDescription(t.description).toLowerCase()
    const key = `${t.type}_${t.account_id || ''}_${t.amount}_${cleanD}`
    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, t)
    } else {
      // Se houver mais de um, manter o de maior data
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
  const currentYM = getYearMonth(currentYear, currentMonth)

  // 4. Para cada série única, gerar 12 meses futuros
  for (const seed of canonicalMap.values()) {
    const cleanD = cleanDescription(seed.description).toLowerCase()
    const origParts = parseDateParts(seed.date)
    const seedYM = getYearMonth(origParts.year, origParts.month)
    const origDay = origParts.day

    // Determinar ano e mês base para a geração dos 12 meses:
    // Se a data do lançamento estiver no futuro em relação ao mês atual (ex: seedYM > currentYM),
    // a geração começa no mês seguinte ao da data dela (seed.year, seed.month).
    // Se for do mês atual ou passada, começa no mês seguinte ao mês atual (currentYear, currentMonth).
    const isFutureSeed = seedYM > currentYM
    const startBaseYear = isFutureSeed ? origParts.year : currentYear
    const startBaseMonth = isFutureSeed ? origParts.month : currentMonth

    for (let m = 1; m <= 12; m++) {
      const targetDateStr = computeTargetDate(startBaseYear, startBaseMonth, origDay, m)
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
        recurrence_type: seed.recurrence_type || (seed as any).recurrence_period || 'mensal',
        recurrence_period: (seed as any).recurrence_period || seed.recurrence_type || 'mensal',
        installment_number: 1,
        installment_total: 0,
        parent_transaction_id: '',
        notes: seed.notes || 'Gerado automaticamente: recorrência mensal',
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
  // Caso a filha não tenha parent_transaction_id, mas coincida com um registro pai por (type, account, cleanDesc, total),
  // adotamos o parentId do pai correspondente para garantir vínculo e agrupamento exato.
  const seriesMap = new Map<string, InstallmentSeriesFromCurrentMonth>()

  for (const daughter of currentMonthDaughters) {
    const total = Number(daughter.installments_total || (daughter as any).installment_total || 0)
    const num = Number(daughter.installment_number || 1)
    const baseD = cleanDescription(daughter.description)
    let parentId = daughter.parent_transaction_id || ''

    if (!parentId) {
      const matchedParent = allParents.find((p) => {
        const pTotal = Number(p.installments_total || (p as any).installment_total || 0)
        return (
          pTotal === total &&
          p.type === daughter.type &&
          (p.account_id || '') === (daughter.account_id || '') &&
          cleanDescription(p.description).toLowerCase() === baseD.toLowerCase()
        )
      })
      if (matchedParent) {
        parentId = matchedParent.id
      }
    }

    const seriesKey = parentId
      ? `parent_${parentId}`
      : `desc_${daughter.type}_${daughter.account_id || ''}_${baseD.toLowerCase()}_${total}`

    if (!seriesMap.has(seriesKey)) {
      // Encontrar todas as filhas dessa série no controle inteiro
      const daughtersOfSeries = allDaughters.filter((d) => {
        if (parentId) {
          if (d.parent_transaction_id === parentId) return true
        }
        const dTotal = Number(d.installments_total || (d as any).installment_total || 0)
        return (
          dTotal === total &&
          cleanDescription(d.description).toLowerCase() === baseD.toLowerCase() &&
          d.type === daughter.type &&
          (d.account_id || '') === (daughter.account_id || '')
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

    // Regra 4: Continuar a partir da parcela do mês atual (curNum).
    // A primeira parcela futura gerada corresponde ao mês seguinte (offset = 1) e terá número curNum + 1.
    // Gerar até acabar o total de parcelas OU no máximo +12 parcelas futuras.
    // Ex: parcela 7/10 gera 3 parcelas (8/10, 9/10, 10/10);
    // Ex: parcela 3/79 gera 12 parcelas (4/79 a 15/79).
    const startNum = curNum + 1
    const maxNumToGenerate = Math.min(total, curNum + 12)

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

    // Gerar números de startNum até maxNumToGenerate (offset em meses = 1 a 12)
    for (let n = startNum; n <= maxNumToGenerate; n++) {
      // Offset de meses referente ao mês atual:
      // n = curNum + 1 => monthOffset = 1 (mês seguinte ao atual)
      // n = curNum + 2 => monthOffset = 2 ...
      const monthOffset = n - curNum
      const targetDateStr = computeTargetDate(currentYear, currentMonth, origDay, monthOffset)

      // Regra 5 (Idempotência): checar tanto por número da parcela quanto por data no mês alvo
      if (series.existingNumbers.has(n)) {
        continue
      }
      const targetYM = targetDateStr.substring(0, 7)
      const alreadyHasInTargetMonth = series.allDaughters.some(
        (d) => d.date && d.date.startsWith(targetYM),
      )
      if (alreadyHasInTargetMonth) {
        continue
      }

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
