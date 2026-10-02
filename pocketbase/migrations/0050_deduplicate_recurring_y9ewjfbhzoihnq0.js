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

    console.log(`[0050] Total de lançamentos recorrentes encontrados: ${recurringTxs.length}`)

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

    // Agrupar por chave canônica: tipo_accountId_descLimpa_anoMês
    // Usar date || payment_date para determinar o ano/mês do grupo
    const groups = {}

    for (let i = 0; i < recurringTxs.length; i++) {
      const tx = recurringTxs[i]
      const instTotal = tx.getInt('installment_total') || tx.getInt('installments_total') || 0

      // Ignorar parcelamentos (installment_total / installments_total > 1)
      if (instTotal > 1) continue

      const dStr = tx.getString('date')
      const pStr = tx.getString('payment_date')
      const ym = extractYM(dStr) || extractYM(pStr)
      if (!ym) continue

      const type = tx.getString('type') || ''
      const accountId = tx.getString('account_id') || ''
      const desc = cleanDesc(tx.getString('description')).toLowerCase()

      const key = `${type}_${accountId}_${desc}_${ym}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(tx)
    }

    let deletedCount = 0
    const affectedAccountIds = new Set()

    for (const key of Object.keys(groups)) {
      const list = groups[key]
      if (list.length > 1) {
        console.log(
          `[0050] Grupo com duplicatas encontrado (${list.length} itens) para a chave: ${key}`,
        )

        // Critério de desempate:
        // 1. Preferir o pago (paid = true)
        // 2. Em empate, o criado mais antigo (created ASC)
        // Deletar os demais
        list.sort((a, b) => {
          const paidA = a.getBool('paid') ? 1 : 0
          const paidB = b.getBool('paid') ? 1 : 0
          if (paidA !== paidB) return paidB - paidA

          const createdA = new Date(a.getString('created')).getTime()
          const createdB = new Date(b.getString('created')).getTime()
          return createdA - createdB
        })

        const kept = list[0]
        console.log(
          `[0050] Mantendo registro ${kept.id} (${kept.getString('description')}, data: ${kept.getString('date')}, valor: ${kept.getFloat('amount')}, paid: ${kept.getBool('paid')})`,
        )

        for (let j = 1; j < list.length; j++) {
          const dup = list[j]
          console.log(
            `[0050] Deletando duplicata ${dup.id} (${dup.getString('description')}, data: ${dup.getString('date')}, valor: ${dup.getFloat('amount')}, paid: ${dup.getBool('paid')})`,
          )
          const accId = dup.getString('account_id')
          if (accId) affectedAccountIds.add(accId)
          app.delete(dup)
          deletedCount++
        }
      }
    }

    console.log(`[0050] Total de registros duplicados removidos: ${deletedCount}`)

    // 2. Recalcular saldo de todas as contas do controle para consistência
    const accounts = app.findRecordsByFilter(
      'accounts',
      `control_id = '${CONTROL_ID}'`,
      'created',
      100,
      0,
    )

    console.log(`[0050] Recalculando saldo de ${accounts.length} contas do controle...`)

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
        const instNum = tx.getInt('installment_number')
        const instTot = tx.getInt('installment_total')

        // Ignorar registros pai consolidados
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
        .newQuery('UPDATE accounts SET balance = {:balance}, updated = {:updated} WHERE id = {:id}')
        .bind({
          id: accId,
          balance: calcBalance,
          updated: nowIso,
        })
        .execute()

      console.log(
        `[0050] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
      )
    }
  },
  (app) => {
    // Reversão no-op
  },
)
