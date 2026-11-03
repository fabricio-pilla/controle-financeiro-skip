migrate(
  (app) => {
    // 1. Remover duplicata específica da Havan informada no bug report:
    // id '0uqe5tcqmq35fyx' (segundo "Havan (2/2)", criado 1s depois do correto, sem notes e com installment_total=0)
    try {
      const havanDup = app.findRecordById('transactions', '0uqe5tcqmq35fyx')
      if (havanDup) {
        app.delete(havanDup)
      }
    } catch (_) {}

    // 2. Corrigir o pai da série Havan 'cutn4d9gy43kuto' ("Havan (1/2)") para installment_total = 2
    try {
      const havanParent = app.findRecordById('transactions', 'cutn4d9gy43kuto')
      if (havanParent) {
        havanParent.set('installment_total', 2)
        app.save(havanParent)
      }
    } catch (_) {}

    // 3. Varredura ampla em TODAS as transações:
    // Busca registros onde installment_total = 0 ou null, ou onde a descrição contém padrão "(X/Y)"
    // Carrega em lotes
    const allTxs = app.findRecordsByFilter('transactions', 'id != ""', 'created', 20000, 0)

    const cleanBaseDesc = (desc) =>
      String(desc || '')
        .trim()
        .replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '')
        .replace(/\s*\(Total:.*$/i, '')
        .trim()
        .toLowerCase()

    const totalOf = (r) => {
      const t = r.getInt('installment_total')
      return t > 0 ? t : 0
    }

    const numOf = (r) => {
      const n = r.getInt('installment_number')
      return n > 0 ? n : 0
    }

    const isImported = (r) =>
      String(r.getString('notes') || '')
        .toLowerCase()
        .indexOf('importado de planilha') !== -1

    const createdOf = (r) => {
      const raw = r.getString('created')
      const t = new Date(String(raw).replace(' ', 'T'))
      return isNaN(t.getTime()) ? 0 : t.getTime()
    }

    const byId = {}
    for (let i = 0; i < allTxs.length; i++) {
      byId[allTxs[i].id] = allTxs[i]
    }

    // A. Normalizar installment_total via regex da descrição "(cur/tot)" quando installment_total <= 0
    for (let i = 0; i < allTxs.length; i++) {
      const r = allTxs[i]
      const desc = r.getString('description') || ''
      const match = desc.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/)
      if (match) {
        const cur = parseInt(match[1], 10)
        const tot = parseInt(match[2], 10)
        let changed = false
        if (tot > 0 && totalOf(r) === 0) {
          r.set('installment_total', tot)
          changed = true
        }
        if (cur > 0 && numOf(r) === 0) {
          r.set('installment_number', cur)
          changed = true
        }
        if (changed) {
          app.save(r)
        }
      }
    }

    // B. Para cada série de parcelamento, deduplicar parcelas repetidas de mesmo número
    // Agrupamento por: parent_transaction_id (se houver), ou por control_id + account_id + type + cleanBaseDesc
    const groups = {}
    for (let i = 0; i < allTxs.length; i++) {
      const r = allTxs[i]
      const num = numOf(r)
      const tot = totalOf(r)
      // Só nos interessam parcelas de parcelamento
      if (num === 0 && tot === 0) continue

      let parentId = r.getString('parent_transaction_id')
      if (parentId === r.id) {
        r.set('parent_transaction_id', '')
        app.save(r)
        parentId = ''
      }

      const ctrl = r.getString('control_id')
      const acc = r.getString('account_id')
      const type = r.getString('type')
      const base = cleanBaseDesc(r.getString('description'))

      const key = parentId
        ? 'p:' + ctrl + '|' + parentId
        : 'd:' + ctrl + '|' + acc + '|' + type + '|' + base

      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    }

    // Deduplicar dentro de cada grupo
    const affectedAccounts = {}
    for (const key in groups) {
      const members = groups[key]
      const byNumber = {}
      for (let i = 0; i < members.length; i++) {
        const r = members[i]
        const n = numOf(r)
        if (n <= 0) continue
        if (!byNumber[n]) byNumber[n] = []
        byNumber[n].push(r)
      }

      for (const nStr in byNumber) {
        const list = byNumber[nStr]
        if (list.length <= 1) continue

        // Ordenar: primeiro registros válidos/com total preenchido e não importados, depois mais antigo
        list.sort((a, b) => {
          const scoreA = (totalOf(a) > 0 ? 2 : 0) + (isImported(a) ? 0 : 1)
          const scoreB = (totalOf(b) > 0 ? 2 : 0) + (isImported(b) ? 0 : 1)
          if (scoreA !== scoreB) return scoreB - scoreA
          return createdOf(a) - createdOf(b)
        })

        // Manter list[0], apagar list[1..]
        for (let i = 1; i < list.length; i++) {
          const dup = list[i]
          if (isImported(dup)) continue
          try {
            affectedAccounts[dup.getString('account_id')] = true
            app.delete(dup)
          } catch (_) {}
        }
      }

      // Propagar total máximo conhecido para todos os membros que ainda tiverem total = 0
      let maxTotal = 0
      for (let i = 0; i < members.length; i++) {
        const t = totalOf(members[i])
        if (t > maxTotal) maxTotal = t
      }
      if (maxTotal > 1) {
        for (let i = 0; i < members.length; i++) {
          const r = members[i]
          if (totalOf(r) === 0 && !isImported(r)) {
            r.set('installment_total', maxTotal)
            try {
              app.save(r)
            } catch (_) {}
          }
        }
      }
    }

    // Recalcular saldo das contas afetadas por exclusões de duplicatas
    for (const accId in affectedAccounts) {
      if (!accId) continue
      try {
        const acc = app.findRecordById('accounts', accId)
        const accType = acc.getString('type')
        const txs = app.findRecordsByFilter('transactions', 'account_id = {:accId}', '', 10000, 0, {
          accId,
        })
        let calc = 0
        for (let i = 0; i < txs.length; i++) {
          const t = txs[i]
          const num = numOf(t)
          const tot = totalOf(t)
          if (num === 0 && tot > 0) continue // pai consolidado
          const amt = t.getFloat('amount') || 0
          const isDespesa = t.getString('type') === 'despesa'
          if (accType === 'credito') calc += isDespesa ? amt : -amt
          else calc += isDespesa ? -amt : amt
        }
        calc = Math.round(calc * 100) / 100
        acc.set('balance', calc)
        app.save(acc)
      } catch (_) {}
    }
  },
  (app) => {},
)
