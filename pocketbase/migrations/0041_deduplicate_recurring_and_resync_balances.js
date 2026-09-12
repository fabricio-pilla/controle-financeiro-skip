migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Limpeza de lançamentos recorrentes duplicados no mesmo mês
    // Para transações recorrentes (is_recurring=true || recurring=true || recurrence_type != ''),
    // e que não sejam parceladas filhas (installment_total <= 1 || (installment_number <= 0 && installment_total <= 1)).
    const recurringTxs = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && (is_recurring = true || recurring = true || recurrence_type != '')`,
      'date',
      10000,
      0,
    )

    console.log(`[0041] Total de lançamentos recorrentes encontrados: ${recurringTxs.length}`)

    // Função auxiliar para limpar descrição
    const cleanDesc = (desc) => {
      if (!desc) return 'Sem descrição'
      let res = desc.replace(/\s*\(Total:\s*R\$[^)]+\)\s*$/i, '').trim()
      res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
      return res.toLowerCase()
    }

    // Agrupar por: control_id + tipo + conta + cleanDesc + YYYY-MM
    const groups = {}

    for (let i = 0; i < recurringTxs.length; i++) {
      const tx = recurringTxs[i]
      const instTotal = tx.getInt('installment_total') || tx.getInt('installments_total') || 0
      const instNum = tx.getInt('installment_number') || 0

      // Pular compras parceladas reais (> 1 parcela)
      if (instTotal > 1) {
        continue
      }
      if (instNum > 1) {
        continue
      }

      const dateStr = tx.getString('date') || ''
      if (!dateStr) continue
      const ym = dateStr.substring(0, 7)
      const type = tx.getString('type') || ''
      const accountId = tx.getString('account_id') || ''
      const desc = cleanDesc(tx.getString('description') || '')

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
          `[0041] Encontradas ${list.length} ocorrências recorrentes duplicadas para a chave: ${key}`,
        )

        // Critério de desempate para manter a ocorrência "certa":
        // 1. Preferir ocorrências que já foram marcadas como pagas (paid = true)
        // 2. Se empate, preferir a mais antiga (created ASC)
        list.sort((a, b) => {
          const paidA = a.getBool('paid') ? 1 : 0
          const paidB = b.getBool('paid') ? 1 : 0
          if (paidA !== paidB) return paidB - paidA

          const createdA = new Date(a.getString('created')).getTime()
          const createdB = new Date(b.getString('created')).getTime()
          return createdA - createdB
        })

        // O primeiro registro da lista ordenada é mantido. Os demais são excluídos.
        const kept = list[0]
        console.log(
          `[0041] Mantendo registro ${kept.id} (${kept.getString('description')}, data: ${kept.getString('date')}, valor: ${kept.getFloat('amount')})`,
        )

        for (let j = 1; j < list.length; j++) {
          const dup = list[j]
          console.log(
            `[0041] Removendo duplicata ${dup.id} (${dup.getString('description')}, data: ${dup.getString('date')}, valor: ${dup.getFloat('amount')})`,
          )
          const accId = dup.getString('account_id')
          if (accId) affectedAccountIds.add(accId)
          app.delete(dup)
          deletedCount++
        }
      }
    }

    console.log(`[0041] Total de duplicatas recorrentes removidas: ${deletedCount}`)

    // 2. Recalcular saldo de todas as contas do controle
    const accounts = app.findRecordsByFilter(
      'accounts',
      `control_id = '${CONTROL_ID}'`,
      'created',
      100,
      0,
    )

    console.log(`[0041] Recalculando saldo de ${accounts.length} contas do controle...`)

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
        .newQuery(`UPDATE accounts SET balance = {:balance}, updated = {:updated} WHERE id = {:id}`)
        .bind({
          id: accId,
          balance: calcBalance,
          updated: nowIso,
        })
        .execute()

      console.log(
        `[0041] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
      )
    }
  },
  (app) => {
    // Reversão no-op
  },
)
