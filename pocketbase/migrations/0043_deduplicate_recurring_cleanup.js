migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Limpeza de lançamentos recorrentes duplicados no mesmo mês
    // Coleção transactions, controle y9ewjfbhzoihnq0
    const recurringTxs = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && (is_recurring = true || recurring = true || recurrence_type != '')`,
      'date',
      10000,
      0,
    )

    console.log(`[0043] Total de lançamentos recorrentes encontrados: ${recurringTxs.length}`)

    // Função auxiliar para limpar descrição
    const cleanDesc = (desc) => {
      if (!desc) return 'Sem descrição'
      let res = desc.replace(/\s*\(Total:\s*R\$[^)]+\)\s*$/i, '').trim()
      res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
      return res || 'Sem descrição'
    }

    // Normalizar data YYYY-MM
    const normalizeYM = (dateStr) => {
      if (!dateStr) return ''
      const clean = dateStr.split(/[T\s]/)[0]
      return clean.substring(0, 7)
    }

    // Agrupar por: type + account_id + cleanDesc(lowercase) + YYYY-MM
    const groups = {}

    for (let i = 0; i < recurringTxs.length; i++) {
      const tx = recurringTxs[i]
      const instTotal = tx.getInt('installment_total') || tx.getInt('installments_total') || 0
      const instNum = tx.getInt('installment_number') || 0

      // Pular compras parceladas reais (> 1 parcela)
      if (instTotal > 1) continue
      if (instNum > 1) continue

      const ym = normalizeYM(tx.getString('date'))
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
          `[0043] Grupo com duplicatas encontrado (${list.length} itens) para a chave: ${key}`,
        )

        // Critério de desempate para manter uma ocorrência:
        // 1. Manter a com paid=true (se houver)
        // 2. Se empate, manter a de created mais antigo (created ASC)
        // DELETAR as excedentes.
        list.sort((a, b) => {
          const paidA = a.getBool('paid') ? 1 : 0
          const paidB = b.getBool('paid') ? 1 : 0
          if (paidA !== paidB) return paidB - paidA // true (1) vem antes de false (0)

          const createdA = new Date(a.getString('created')).getTime()
          const createdB = new Date(b.getString('created')).getTime()
          return createdA - createdB // mais antigo primeiro
        })

        const kept = list[0]
        console.log(
          `[0043] Mantendo registro ${kept.id} (${kept.getString('description')}, data: ${kept.getString('date')}, valor: ${kept.getFloat('amount')}, paid: ${kept.getBool('paid')})`,
        )

        for (let j = 1; j < list.length; j++) {
          const dup = list[j]
          console.log(
            `[0043] Excluindo excedente ${dup.id} (${dup.getString('description')}, data: ${dup.getString('date')}, valor: ${dup.getFloat('amount')}, paid: ${dup.getBool('paid')})`,
          )
          const accId = dup.getString('account_id')
          if (accId) affectedAccountIds.add(accId)
          app.delete(dup)
          deletedCount++
        }
      }
    }

    console.log(`[0043] Total de duplicatas excedentes removidas: ${deletedCount}`)

    // Caso conhecido: dois registros "Sem descrição", despesa, conta 4xftudvb9g7gnfy, R$ 840,00, data 2026-09-07
    // (ids ls3q4e578i05466 e 896v75g32p5g6p9) — se existirem pontualmente no banco, garantir que apenas um fique
    try {
      const tx1 = app.findFirstRecordByData('transactions', 'id', 'ls3q4e578i05466')
      const tx2 = app.findFirstRecordByData('transactions', 'id', '896v75g32p5g6p9')
      // Se ambos existirem, manter um e excluir o outro
      if (tx1 && tx2) {
        console.log(
          '[0043] Caso específico ls3q4e578i05466 e 896v75g32p5g6p9 encontrado. Removendo 896v75g32p5g6p9.',
        )
        const accId = tx2.getString('account_id')
        if (accId) affectedAccountIds.add(accId)
        app.delete(tx2)
      }
    } catch (_) {
      // Já não existem ou um deles já foi excluído
    }

    // 2. Recalcular saldos (balance) de todas as contas afetadas ao final (ou de todas as contas do controle)
    const accounts = app.findRecordsByFilter(
      'accounts',
      `control_id = '${CONTROL_ID}'`,
      'created',
      100,
      0,
    )

    console.log(`[0043] Recalculando saldo de ${accounts.length} contas do controle...`)

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
        `[0043] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
      )
    }
  },
  (app) => {
    // Reversão no-op
  },
)
