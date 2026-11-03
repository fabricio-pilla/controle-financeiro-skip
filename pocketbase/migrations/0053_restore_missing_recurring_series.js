migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Carregar todas as transações do controle
    const allTxs = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}'`,
      'date',
      15000,
      0,
    )

    console.log(`[0053] Total de transações carregadas: ${allTxs.length}`)

    // Helpers
    const cleanDesc = (desc) => {
      if (!desc) return 'Sem descrição'
      let res = desc.replace(/\s*\(Total:\s*R\$[^)]+\)\s*$/i, '').trim()
      res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
      return res || 'Sem descrição'
    }

    const extractYM = (dateStr) => {
      if (!dateStr) return ''
      const clean = String(dateStr).substring(0, 10).split(/[T\s]/)[0]
      return clean.length >= 7 ? clean.substring(0, 7) : ''
    }

    const parseDay = (dateStr, fallbackDay) => {
      if (!dateStr) return fallbackDay || 1
      const clean = String(dateStr).substring(0, 10).split(/[T\s]/)[0]
      const parts = clean.split('-')
      if (parts.length >= 3) {
        const d = parseInt(parts[2], 10)
        return isNaN(d) || d < 1 ? fallbackDay || 1 : d
      }
      return fallbackDay || 1
    }

    const parseYearMonth = (dateStr) => {
      if (!dateStr) return { year: 2026, month: 1 }
      const clean = String(dateStr).substring(0, 10).split(/[T\s]/)[0]
      const parts = clean.split('-')
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10)
        return {
          year: isNaN(y) ? 2026 : y,
          month: isNaN(m) ? 1 : m,
        }
      }
      return { year: 2026, month: 1 }
    }

    const daysInMonth = (year, month) => {
      return new Date(Date.UTC(year, month, 0)).getUTCDate()
    }

    const formatIsoDate = (year, month, day) => {
      const maxD = daysInMonth(year, month)
      const safeD = Math.min(Math.max(1, day), maxD)
      const mm = month < 10 ? '0' + month : String(month)
      const dd = safeD < 10 ? '0' + safeD : String(safeD)
      return `${year}-${mm}-${dd} 00:00:00.000Z`
    }

    // 2. Rastrear meses já ocupados em TODAS as transações por série (cleanDesc + type + account_id)
    // Isso garante idempotência e impede criar se já existe registro naquele mês/ano por date OU payment_date
    const occupiedBySeries = {}
    for (let i = 0; i < allTxs.length; i++) {
      const tx = allTxs[i]
      const desc = cleanDesc(tx.getString('description')).toLowerCase()
      const type = tx.getString('type') || ''
      const accId = tx.getString('account_id') || ''
      const sKey = `${type}_${accId}_${desc}`

      if (!occupiedBySeries[sKey]) {
        occupiedBySeries[sKey] = new Set()
      }

      const dYM = extractYM(tx.getString('date'))
      const pYM = extractYM(tx.getString('payment_date'))
      if (dYM) occupiedBySeries[sKey].add(dYM)
      if (pYM) occupiedBySeries[sKey].add(pYM)
    }

    // 3. Identificar transações recorrentes mensais elegíveis (excluindo parcelamentos reais)
    // Critérios: is_recurring=true || recurring=true || recurrence_type='mensal' || recurrence_period='mensal'
    // E installment_total <= 1 (não é parcela de compra parcelada)
    const recurringMembersBySeries = {}

    for (let i = 0; i < allTxs.length; i++) {
      const tx = allTxs[i]
      const isRec = tx.getBool('is_recurring') || tx.getBool('recurring')
      const recType = (tx.getString('recurrence_type') || '').toLowerCase()
      const recPeriod = (tx.getString('recurrence_period') || '').toLowerCase()
      const isMonthly = recType === 'mensal' || recPeriod === 'mensal' || isRec

      if (!isMonthly) continue

      const instTot = tx.getInt('installment_total') || tx.getInt('installments_total') || 0
      const instNum = tx.getInt('installment_number') || 0
      // Ignorar compras parceladas reais
      if (instTot > 1) continue
      // Ignorar se tem padrão explícito de parcela na descrição (ex: "(2/10)")
      const rawDesc = tx.getString('description') || ''
      if (/\(\s*\d+\s*\/\s*\d+\s*\)/.test(rawDesc) && instTot > 1) continue

      const desc = cleanDesc(rawDesc).toLowerCase()
      const type = tx.getString('type') || ''
      const accId = tx.getString('account_id') || ''
      const sKey = `${type}_${accId}_${desc}`

      if (!recurringMembersBySeries[sKey]) {
        recurringMembersBySeries[sKey] = []
      }
      recurringMembersBySeries[sKey].push(tx)
    }

    const affectedAccounts = new Set()
    let createdCount = 0

    const txCollection = app.findCollectionByNameOrId('transactions')

    // 4. Para cada série de recorrência mensal, identificar âncora e gerar os próximos 12 meses
    for (const sKey of Object.keys(recurringMembersBySeries)) {
      const list = recurringMembersBySeries[sKey]
      if (list.length === 0) continue

      // Ordenar por data efetiva crescente (ou date)
      list.sort((a, b) => {
        const dateA = a.getString('payment_date') || a.getString('date') || ''
        const dateB = b.getString('payment_date') || b.getString('date') || ''
        return dateA.localeCompare(dateB)
      })

      // Encontrar a semente original (parent_transaction_id mais antigo ou primeira ocorrência da série)
      let seedId = ''
      for (let j = 0; j < list.length; j++) {
        const pId = list[j].getString('parent_transaction_id')
        if (pId && pId !== list[j].id) {
          seedId = pId
          break
        }
      }
      if (!seedId) {
        seedId = list[0].id
      }

      // Identificar a âncora: a ocorrência mais recente existente daquela série
      const anchor = list[list.length - 1]

      // Determinar a data base da âncora
      const anchorDateStr = anchor.getString('date') || anchor.getString('payment_date')
      const anchorPayDateStr = anchor.getString('payment_date') || anchor.getString('date')

      const dateParsed = parseYearMonth(anchorDateStr)
      const payDateParsed = parseYearMonth(anchorPayDateStr)

      // Usar a maior data (mês/ano) como início do avanço
      let anchorYear = dateParsed.year
      let anchorMonth = dateParsed.month
      if (
        payDateParsed.year > anchorYear ||
        (payDateParsed.year === anchorYear && payDateParsed.month > anchorMonth)
      ) {
        anchorYear = payDateParsed.year
        anchorMonth = payDateParsed.month
      }

      const anchorDateDay = parseDay(anchorDateStr, 5)
      const anchorPayDay = parseDay(anchorPayDateStr, anchorDateDay)

      // Gerar os 12 meses seguintes a partir do mês seguinte ao da âncora
      let curYear = anchorYear
      let curMonth = anchorMonth

      for (let step = 1; step <= 12; step++) {
        curMonth++
        if (curMonth > 12) {
          curMonth = 1
          curYear++
        }

        const targetYM = `${curYear}-${curMonth < 10 ? '0' + curMonth : curMonth}`

        // Idempotência: verificar se já existe algum lançamento para este mês nesta série
        if (occupiedBySeries[sKey] && occupiedBySeries[sKey].has(targetYM)) {
          continue
        }

        const newDateIso = formatIsoDate(curYear, curMonth, anchorDateDay)
        const newPayDateIso = formatIsoDate(curYear, curMonth, anchorPayDay)

        const rec = new Record(txCollection)
        rec.set('type', anchor.getString('type'))
        rec.set('amount', anchor.getFloat('amount') || 0)
        rec.set('description', cleanDesc(anchor.getString('description')))
        rec.set('account_id', anchor.getString('account_id'))
        rec.set('category_id', anchor.getString('category_id'))
        rec.set('subcategory_id', anchor.getString('subcategory_id'))
        rec.set('date', newDateIso)
        rec.set('payment_date', newPayDateIso)
        rec.set('paid', false)
        rec.set('is_recurring', true)
        rec.set('recurring', true)
        rec.set('recurrence_type', 'mensal')
        rec.set('recurrence_period', 'mensal')
        rec.set('installment_number', 0)
        rec.set('installment_total', 0)
        rec.set('notes', 'Gerado automaticamente: recorrência mensal')
        rec.set('parent_transaction_id', seedId)
        rec.set('user_id', anchor.getString('user_id') || 'uc5jp6hewxu9yio')
        rec.set('control_id', anchor.getString('control_id') || CONTROL_ID)

        app.save(rec)

        // Marcar mês como ocupado
        occupiedBySeries[sKey].add(targetYM)
        affectedAccounts.add(anchor.getString('account_id'))
        createdCount++
      }
    }

    console.log(`[0053] Total de ocorrências recorrentes geradas: ${createdCount}`)

    // 5. Recalcular saldos de todas as contas do controle afetadas
    for (const accId of affectedAccounts) {
      if (!accId) continue
      try {
        const acc = app.findRecordById('accounts', accId)
        const accType = acc.getString('type')

        const accTxs = app.findRecordsByFilter(
          'transactions',
          `account_id = '${accId}'`,
          'date',
          15000,
          0,
        )

        let calcBalance = 0
        for (let r = 0; r < accTxs.length; r++) {
          const tx = accTxs[r]
          const instNum = tx.getInt('installment_number')
          const instTot = tx.getInt('installment_total')

          // Ignorar registros pai consolidados de parcelamento (instNum=0 && instTot>0)
          if (instNum === 0 && instTot > 0) {
            continue
          }

          const tType = tx.getString('type')
          const amt = tx.getFloat('amount') || 0
          if (accType === 'credito') {
            calcBalance += tType === 'despesa' ? amt : -amt
          } else {
            calcBalance += tType === 'receita' ? amt : -amt
          }
        }

        calcBalance = Math.round(calcBalance * 100) / 100

        app
          .db()
          .newQuery(
            'UPDATE accounts SET balance = {:balance}, updated = {:updated} WHERE id = {:id}',
          )
          .bind({
            id: accId,
            balance: calcBalance,
            updated: nowIso,
          })
          .execute()

        console.log(
          `[0053] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
        )
      } catch (e) {
        console.log(`[0053] Erro ao recalcular saldo da conta ${accId}: ${e}`)
      }
    }
  },
  (app) => {
    // Reversão no-op
  },
)
