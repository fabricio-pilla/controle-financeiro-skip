migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Buscar todos os recorrentes do controle y9ewjfbhzoihnq0
    const recurringTxs = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && (is_recurring = true || recurring = true || recurrence_type != '')`,
      'date',
      10000,
      0,
    )

    console.log(`[0051] Total de lançamentos recorrentes encontrados: ${recurringTxs.length}`)

    // Função de limpeza de descrição compatível com cleanDescription
    const cleanDesc = (desc) => {
      if (!desc) return 'Sem descrição'
      let res = desc.replace(/\s*\(Total:\s*R\$[^)]+\)\s*$/i, '').trim()
      res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
      return res || 'Sem descrição'
    }

    // Extração insensível a formato ("2026-10-05 00:00:00.000Z" ou "2026-10-05")
    const extractYM = (dateStr) => {
      if (!dateStr) return ''
      const clean = String(dateStr).substring(0, 10).split(/[T\s]/)[0]
      return clean.length >= 7 ? clean.substring(0, 7) : ''
    }

    // Filtrar apenas recorrentes reais (não parcelamentos)
    const validRecs = []
    for (let i = 0; i < recurringTxs.length; i++) {
      const tx = recurringTxs[i]
      const instTotal = tx.getInt('installment_total') || tx.getInt('installments_total') || 0
      if (instTotal > 1) continue
      validRecs.push(tx)
    }

    // Agrupar registros que colidam por date OU payment_date
    // Chave de série: type_accountId_cleanDesc
    const seriesMap = {}
    for (let i = 0; i < validRecs.length; i++) {
      const tx = validRecs[i]
      const type = tx.getString('type') || ''
      const accountId = tx.getString('account_id') || ''
      const desc = cleanDesc(tx.getString('description')).toLowerCase()
      const seriesKey = `${type}_${accountId}_${desc}`
      if (!seriesMap[seriesKey]) {
        seriesMap[seriesKey] = []
      }
      seriesMap[seriesKey].push(tx)
    }

    let deletedCount = 0
    const deletedIds = new Set()

    for (const sKey of Object.keys(seriesMap)) {
      const list = seriesMap[sKey]

      // Ordenar por preferência:
      // 1. Manter pago (paid = true)
      // 2. Mais antigo (created ASC)
      list.sort((a, b) => {
        const paidA = a.getBool('paid') ? 1 : 0
        const paidB = b.getBool('paid') ? 1 : 0
        if (paidA !== paidB) return paidB - paidA

        const createdA = new Date(a.getString('created')).getTime()
        const createdB = new Date(b.getString('created')).getTime()
        return createdA - createdB
      })

      // Rastrear meses ocupados nesta série (tanto por date quanto por payment_date)
      const occupiedYMs = new Set()

      for (let j = 0; j < list.length; j++) {
        const tx = list[j]
        const dYM = extractYM(tx.getString('date'))
        const pYM = extractYM(tx.getString('payment_date'))

        // Se o mês de date OU payment_date já foi reivindicado por um registro preferido desta série
        const collision = (dYM && occupiedYMs.has(dYM)) || (pYM && occupiedYMs.has(pYM))

        if (collision) {
          console.log(
            `[0051] Excluindo duplicata de série ${tx.id} (${tx.getString('description')}, date: ${tx.getString('date')}, payDate: ${tx.getString('payment_date')}, paid: ${tx.getBool('paid')})`,
          )
          app.delete(tx)
          deletedIds.add(tx.id)
          deletedCount++
        } else {
          // Reivindicar os meses
          if (dYM) occupiedYMs.add(dYM)
          if (pYM) occupiedYMs.add(pYM)
        }
      }
    }

    console.log(`[0051] Total de registros duplicados removidos: ${deletedCount}`)

    // 2. Recalcular saldo de todas as contas do controle para consistência
    const accounts = app.findRecordsByFilter(
      'accounts',
      `control_id = '${CONTROL_ID}'`,
      'created',
      100,
      0,
    )

    for (let a = 0; a < accounts.length; a++) {
      const acc = accounts[a]
      const accId = acc.id
      const accType = acc.getString('type')

      const accTxs = app.findRecordsByFilter(
        'transactions',
        `account_id = '${accId}'`,
        'date',
        10000,
        0,
      )

      let calcBalance = 0
      for (let r = 0; r < accTxs.length; r++) {
        const tx = accTxs[r]
        if (deletedIds.has(tx.id)) continue
        const instNum = tx.getInt('installment_number')
        const instTot = tx.getInt('installment_total')

        if (instNum === 0 && instTot > 0) continue

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
        .newQuery('UPDATE accounts SET balance = {:balance}, updated = {:updated} WHERE id = {:id}')
        .bind({
          id: accId,
          balance: calcBalance,
          updated: nowIso,
        })
        .execute()
    }
  },
  (app) => {
    // Reversão no-op
  },
)
