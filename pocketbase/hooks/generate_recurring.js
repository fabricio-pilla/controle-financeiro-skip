// pocketbase/hooks/generate_recurring.js
// Rota customizada no backend para geração atômica e idempotente das próximas 12 ocorrências
// de lançamentos recorrentes: POST /backend/v1/custom/generate-recurring
//
// Recebe: { controlId: string, transactionId?: string, currentYear?: number, currentMonth?: number }
// - Se transactionId for informado: gera os 12 meses futuros a partir dessa semente recorrente específica.
// - Se transactionId não for informado: busca as sementes recorrentes do mês atual (ou ativas) no controle e gera.
//
// Blindagem contra duplicatas e séries apagadas:
// 1. NUNCA criar pendência (paid = false) com data anterior ao mês corrente (mês passado nasce obrigatoriamente pago).
// 2. NUNCA criar ocorrência em mês que já tenha ocorrência da mesma série (paga ou não, importada ou gerada).
// 3. Critério de mesma série para deduplicação:
//    tipo + conta + valor aproximado + dia do mês + mês/ano, ignorando se a descrição é vazia ou "Sem descrição"
//    (para typo e vazio não escaparem da deduplicação).
// 4. Bloqueio explícito de séries paralelas apagadas:
//    - "Sem descrição"
//    - "Vale Aliementação" (typo)
//    - "Pensã Manu" (typo)
//    Nunca serão aceitas como sementes recorrentes e nunca renascerão.
// 5. Preservação proposital:
//    - Receita "Vale Alimentação" (R$ 1.444,91) e Despesa "Supermercado" (R$ 1.444,91) são independentes e mantidas.

routerAdd('POST', '/backend/v1/custom/generate-recurring', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Não autenticado.' })
  }

  const body = e.requestInfo().body || {}
  const controlId = body.controlId || body.control_id
  const transactionId = body.transactionId || body.transaction_id || null
  const reqYear = body.currentYear ? Number(body.currentYear) : null
  const reqMonth = body.currentMonth ? Number(body.currentMonth) : null

  if (!controlId) {
    return e.json(400, { message: 'Parâmetro obrigatório ausente (controlId).' })
  }

  // 1. Permissão: deve ser membro ativo do controle (ou dono) e NÃO pode ser viewer
  let canManage = false
  try {
    const callerMember = $app.findFirstRecordByFilter(
      'control_members',
      'control_id = {:cid} && user_id = {:uid} && status = "active"',
      { cid: controlId, uid: authRecord.id },
    )
    if (callerMember) {
      const role = callerMember.getString('role')
      if (role === 'owner' || role === 'admin' || role === 'member') {
        canManage = true
      }
    }
  } catch (_) {
    canManage = false
  }

  if (!canManage) {
    try {
      const ctrl = $app.findRecordById('financial_controls', controlId)
      if (ctrl && ctrl.getString('owner_id') === authRecord.id) {
        canManage = true
      }
    } catch (_) {}
  }

  if (!canManage) {
    return e.json(403, {
      message: 'Você não tem permissão para gerar lançamentos recorrentes neste controle.',
    })
  }

  // 2. Data base atual (ano/mês)
  const now = new Date()
  const currentYear = reqYear && !isNaN(reqYear) ? reqYear : now.getFullYear()
  const currentMonth = reqMonth && !isNaN(reqMonth) ? reqMonth : now.getMonth() + 1
  const currentYM = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

  // 3. Carregar contas do controle para verificar fatura de cartão (closing_day e due_day)
  const accounts = $app.findRecordsByFilter('accounts', 'control_id = {:cid}', 'created', 500, 0, {
    cid: controlId,
  })
  const accountsById = {}
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i]
    accountsById[a.id] = {
      id: a.id,
      type: a.getString('type'),
      due_day: a.getInt('due_day'),
      closing_day: a.getInt('closing_day'),
    }
  }

  // 4. Helpers de data e limpeza de descrição
  const cleanDescription = (desc) => {
    let d = String(desc || '').trim()
    d = d.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '')
    d = d.replace(/\s*\(Total:.*$/i, '')
    return d.trim()
  }

  const normalizeText = (text) => {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }

  // Blacklist de descrições proibidas como sementes recorrentes
  const isForbiddenSeedDescription = (desc) => {
    const norm = normalizeText(desc)
    if (!norm || norm === 'sem descricao') return true
    if (norm === 'vale aliementacao') return true // typo
    if (norm === 'pensa manu') return true // typo
    return false
  }

  const parseDateParts = (dateStr) => {
    if (!dateStr) return { year: currentYear, month: currentMonth, day: 1 }
    const clean = String(dateStr).split(' ')[0].split('T')[0]
    const parts = clean.split('-')
    return {
      year: parseInt(parts[0], 10) || currentYear,
      month: parseInt(parts[1], 10) || currentMonth,
      day: parseInt(parts[2], 10) || 1,
    }
  }

  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month, 0).getDate()
  }

  const computeTargetDate = (baseYear, baseMonth, origDay, addMonthsCount) => {
    let targetMonth = baseMonth + addMonthsCount
    let targetYear = baseYear
    while (targetMonth > 12) {
      targetMonth -= 12
      targetYear += 1
    }
    while (targetMonth < 1) {
      targetMonth += 12
      targetYear -= 1
    }
    const maxDay = getLastDayOfMonth(targetYear, targetMonth)
    const finalDay = Math.min(origDay, maxDay)
    return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`
  }

  const calculateCreditPaymentDate = (purchaseDateStr, account) => {
    if (!purchaseDateStr) return purchaseDateStr
    if (!account || account.type !== 'credito') return purchaseDateStr

    const parts = parseDateParts(purchaseDateStr)
    const purchaseYear = parts.year
    const purchaseMonth = parts.month
    const purchaseDay = parts.day

    const closingDay = account.closing_day > 0 ? account.closing_day : null
    const dueDay = account.due_day > 0 ? account.due_day : null

    if (!dueDay) return purchaseDateStr

    let targetYear = purchaseYear
    let targetMonth = purchaseMonth

    if (closingDay !== null) {
      if (purchaseDay >= closingDay) {
        targetMonth += 1
        if (targetMonth > 12) {
          targetMonth = 1
          targetYear += 1
        }
      }
    } else if (purchaseDay >= dueDay) {
      targetMonth += 1
      if (targetMonth > 12) {
        targetMonth = 1
        targetYear += 1
      }
    }

    const maxDayInTarget = getLastDayOfMonth(targetYear, targetMonth)
    const finalDay = Math.min(dueDay, maxDayInTarget)

    return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`
  }

  // 5. Obter transações sementes
  let rawSeeds = []
  if (transactionId) {
    try {
      const seedTx = $app.findRecordById('transactions', transactionId)
      if (seedTx && seedTx.getString('control_id') === controlId) {
        const isRec =
          seedTx.getBool('is_recurring') ||
          seedTx.getBool('recurring') ||
          seedTx.getString('recurrence_type') !== '' ||
          seedTx.getString('recurrence_period') !== ''
        if (isRec) {
          rawSeeds.push(seedTx)
        } else {
          return e.json(400, { message: 'O lançamento informado não é recorrente.' })
        }
      } else {
        return e.json(404, { message: 'Lançamento semente não encontrado.' })
      }
    } catch (err) {
      return e.json(404, { message: 'Lançamento semente não encontrado: ' + err })
    }
  } else {
    // Busca todas as transações do controle para encontrar as sementes do mês atual
    const controlTxs = $app.findRecordsByFilter(
      'transactions',
      'control_id = {:cid}',
      'date',
      20000,
      0,
      { cid: controlId },
    )

    for (let i = 0; i < controlTxs.length; i++) {
      const t = controlTxs[i]
      const dStr = String(t.getString('date') || '').split(/[T\s]/)[0]
      if (!dStr.startsWith(currentYM)) continue

      const isRec =
        t.getBool('is_recurring') ||
        t.getBool('recurring') ||
        t.getString('recurrence_type') !== '' ||
        t.getString('recurrence_period') !== ''
      if (!isRec) continue

      // Ignora pai consolidado de parcelamento
      const num = t.getInt('installment_number')
      const total = t.getInt('installment_total')
      if (num === 0 && total > 1) continue

      rawSeeds.push(t)
    }
  }

  // Filtrar sementes proibidas (Sem descrição, typos e apagadas)
  const seeds = []
  for (let i = 0; i < rawSeeds.length; i++) {
    const s = rawSeeds[i]
    const rawDesc = s.getString('description')
    if (isForbiddenSeedDescription(rawDesc)) {
      continue
    }
    seeds.push(s)
  }

  if (seeds.length === 0) {
    return e.json(200, {
      success: true,
      createdCount: 0,
      alreadyExistingCount: 0,
      createdIncomeCount: 0,
      createdExpenseCount: 0,
      seriesCount: 0,
      message: 'Nenhum lançamento recorrente válido para gerar.',
    })
  }

  // 6. Desduplicar seeds por chave canônica de série: tipo + conta + cleanDesc
  const canonicalSeeds = {}
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i]
    const cleanD = normalizeText(cleanDescription(s.getString('description')))
    const accId = s.getString('account_id')
    const type = s.getString('type')
    const seriesKey = `${type}_${accId}_${cleanD}`

    if (!canonicalSeeds[seriesKey]) {
      canonicalSeeds[seriesKey] = s
    } else {
      const existing = canonicalSeeds[seriesKey]
      if (s.getString('date') > existing.getString('date')) {
        canonicalSeeds[seriesKey] = s
      }
    }
  }

  // 7. Carregar conjunto de checagem FRESCA de todas as transações do controle
  // para garantir idempotência absoluta contra concorrência e contra duplicatas por valor/dia
  const allTxs = $app.findRecordsByFilter('transactions', 'control_id = {:cid}', 'date', 25000, 0, {
    cid: controlId,
  })

  const existingSet = {}
  const extractYM = (d) => {
    if (!d) return ''
    const clean = String(d).split(/[T\s]/)[0]
    return clean.length >= 7 ? clean.substring(0, 7) : ''
  }

  for (let i = 0; i < allTxs.length; i++) {
    const t = allTxs[i]
    const cleanD = normalizeText(cleanDescription(t.getString('description')))
    const accId = t.getString('account_id')
    const type = t.getString('type')
    const amt = Math.round((t.getFloat('amount') || 0) * 100) / 100

    const partsDate = parseDateParts(t.getString('date'))
    const ymDate = extractYM(t.getString('date'))
    const dayDate = partsDate.day

    const partsPay = parseDateParts(t.getString('payment_date'))
    const ymPay = extractYM(t.getString('payment_date'))
    const dayPay = partsPay.day

    // 1. Chave nominal exata por data e payment_date
    if (ymDate) {
      existingSet[`${type}_${accId}_${cleanD}_${ymDate}`] = true
      // Chave estrutural ignorando descrição quando vazia ou sem descrição
      existingSet[`STRUCT_${type}_${accId}_${amt}_${ymDate}`] = true
      existingSet[`DAY_${type}_${accId}_${amt}_${dayDate}_${ymDate}`] = true
    }
    if (ymPay) {
      existingSet[`${type}_${accId}_${cleanD}_${ymPay}`] = true
      existingSet[`STRUCT_${type}_${accId}_${amt}_${ymPay}`] = true
      existingSet[`DAY_${type}_${accId}_${amt}_${dayPay}_${ymPay}`] = true
    }
  }

  // 8. Gerar ocorrências para os próximos 12 meses
  const transactionsCol = $app.findCollectionByNameOrId('transactions')
  let createdCount = 0
  let createdIncomeCount = 0
  let createdExpenseCount = 0
  let alreadyExistingCount = 0
  const seriesKeys = Object.keys(canonicalSeeds)
  const affectedMonths = {}

  for (let i = 0; i < seriesKeys.length; i++) {
    const seed = canonicalSeeds[seriesKeys[i]]
    const rawSeedDesc = cleanDescription(seed.getString('description'))
    const normDesc = normalizeText(rawSeedDesc)
    const accId = seed.getString('account_id')
    const type = seed.getString('type')
    const amount = Math.round((seed.getFloat('amount') || 0) * 100) / 100

    const origParts = parseDateParts(seed.getString('date'))
    const seedCleanDate = String(seed.getString('date') || '').split(/[T\s]/)[0]
    const seedYM = seedCleanDate
      ? seedCleanDate.substring(0, 7)
      : `${origParts.year}-${String(origParts.month).padStart(2, '0')}`
    const origDay = origParts.day

    const isFutureSeed = seedYM > currentYM
    const startBaseYear = isFutureSeed ? origParts.year : currentYear
    const startBaseMonth = isFutureSeed ? origParts.month : currentMonth
    const minYM = seedYM >= currentYM ? seedYM : currentYM

    let seedPayOrigDay = origDay
    const rawPayDate = seed.getString('payment_date')
    if (rawPayDate) {
      const payParts = parseDateParts(rawPayDate)
      seedPayOrigDay = payParts.day
    }

    const accConfig = accountsById[accId] || null

    for (let m = 1; m <= 12; m++) {
      const targetDateStr = computeTargetDate(startBaseYear, startBaseMonth, origDay, m)
      const targetYM = targetDateStr.substring(0, 7)

      if (targetYM <= minYM || targetYM <= seedYM) {
        continue
      }

      let targetPaymentDateStr = targetDateStr
      if (rawPayDate) {
        targetPaymentDateStr = computeTargetDate(startBaseYear, startBaseMonth, seedPayOrigDay, m)
      } else if (accConfig && accConfig.type === 'credito') {
        targetPaymentDateStr = calculateCreditPaymentDate(targetDateStr, accConfig)
      }
      const targetPaymentYM = targetPaymentDateStr.substring(0, 7)

      // Checagem de deduplicação estrita:
      // A) Chave nominal
      const checkKeyDate = `${type}_${accId}_${normDesc}_${targetYM}`
      const checkKeyPayment = `${type}_${accId}_${normDesc}_${targetPaymentYM}`

      // B) Chave estrutural (tipo + conta + valor + mês/ano)
      const checkStructDate = `STRUCT_${type}_${accId}_${amount}_${targetYM}`
      const checkStructPay = `STRUCT_${type}_${accId}_${amount}_${targetPaymentYM}`

      if (
        existingSet[checkKeyDate] ||
        existingSet[checkKeyPayment] ||
        existingSet[checkStructDate] ||
        existingSet[checkStructPay]
      ) {
        alreadyExistingCount++
        continue
      }

      // Marca no set em memória para não duplicar se rodar múltiplas iterações
      existingSet[checkKeyDate] = true
      existingSet[checkKeyPayment] = true
      existingSet[checkStructDate] = true
      existingSet[checkStructPay] = true

      // Regra de blindagem retroativa:
      // A geração de recorrências NUNCA cria ocorrência pendente em mês anterior ao mês corrente do sistema.
      // Se targetYM for anterior a currentYM, nasce PAGA.
      // Meses a partir do mês corrente (>= currentYM) nascem pendentes (paid = false).
      const isRetroactive = targetYM < currentYM

      // Criar registro da ocorrência no PocketBase
      const newRecord = new Record(transactionsCol)
      newRecord.set('control_id', controlId)
      newRecord.set('user_id', authRecord.id || seed.getString('user_id'))
      newRecord.set('type', type)
      newRecord.set('amount', seed.getFloat('amount'))
      newRecord.set('description', rawSeedDesc)
      newRecord.set('category_id', seed.getString('category_id') || '')
      newRecord.set('subcategory_id', seed.getString('subcategory_id') || '')
      newRecord.set('account_id', accId || '')
      newRecord.set('date', targetDateStr)
      newRecord.set('payment_date', targetPaymentDateStr)
      newRecord.set('paid', isRetroactive)
      newRecord.set('is_recurring', true)
      newRecord.set('recurring', true)
      newRecord.set('recurrence_type', seed.getString('recurrence_type') || 'mensal')
      newRecord.set('recurrence_period', seed.getString('recurrence_period') || 'mensal')
      newRecord.set('installment_number', 0)
      newRecord.set('installment_total', 0)
      newRecord.set('parent_transaction_id', seed.id || '')
      newRecord.set('notes', 'Gerado automaticamente: recorrência mensal')

      $app.save(newRecord)

      createdCount++
      affectedMonths[targetYM] = true
      affectedMonths[targetPaymentYM] = true
      if (type === 'receita') {
        createdIncomeCount++
      } else {
        createdExpenseCount++
      }
    }
  }

  return e.json(200, {
    success: true,
    createdCount,
    alreadyExistingCount,
    createdIncomeCount,
    createdExpenseCount,
    seriesCount: seriesKeys.length,
    affectedMonths: Object.keys(affectedMonths),
  })
})
