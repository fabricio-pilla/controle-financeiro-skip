// Hook de manutenção: deduplicação idempotente de parcelas e correção de installment_total.
// Resolve o caso "Havan (2/2) duplicado": parcelas criadas com installment_total=0 e depois
// recriadas pelo gerador automático. A deduplicação NUNCA depende de installment_total nem de notes:
// a chave é parent_transaction_id + installment_number (ou, sem pai, descrição base + conta + número).
// Registros de importação de planilha (notes "Importado de planilha: ...") nunca são excluídos.
//
// POST /backend/v1/custom/maintenance-installments  { controlId: string, dryRun?: boolean }
// Requer sessão autenticada de owner/admin do controle.

routerAdd(
  'POST',
  '/backend/v1/custom/maintenance-installments',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { message: 'Não autenticado.' })
    }

    const body = e.requestInfo().body || {}
    const controlId = body.controlId
    const dryRun = Boolean(body.dryRun)
    if (!controlId) {
      return e.json(400, { message: 'Parâmetro obrigatório ausente (controlId).' })
    }

    // 1. Somente owner/admin do controle pode executar a manutenção
    let isCallerAdmin = false
    try {
      const callerMember = $app.findFirstRecordByFilter(
        'control_members',
        'control_id = {:cid} && user_id = {:uid} && status = "active"',
        { cid: controlId, uid: authRecord.id },
      )
      if (callerMember) {
        const role = callerMember.getString('role')
        if (role === 'owner' || role === 'admin') isCallerAdmin = true
      }
    } catch (_) {
      isCallerAdmin = false
    }
    if (!isCallerAdmin) {
      try {
        const ctrl = $app.findRecordById('financial_controls', controlId)
        if (ctrl && ctrl.getString('owner_id') === authRecord.id) isCallerAdmin = true
      } catch (_) {}
    }
    if (!isCallerAdmin) {
      return e.json(403, {
        message: 'Apenas administradores do controle podem executar a manutenção de parcelas.',
      })
    }

    // 2. Carrega todas as transações do controle
    const all = $app.findRecordsByFilter(
      'transactions',
      'control_id = {:cid}',
      'created',
      20000,
      0,
      { cid: controlId },
    )

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
    const createdOf = (r) => {
      const raw = r.getString('created')
      const t = new Date(String(raw).replace(' ', 'T'))
      return isNaN(t.getTime()) ? 0 : t.getTime()
    }
    const isImported = (r) =>
      String(r.getString('notes') || '')
        .toLowerCase()
        .indexOf('importado de planilha') !== -1

    const byId = {}
    for (let i = 0; i < all.length; i++) byId[all[i].id] = all[i]

    // 3. Índice de "pais": registros consolidados (num = 0) OU qualquer registro referenciado como pai
    const parentIds = {}
    for (let i = 0; i < all.length; i++) {
      const r = all[i]
      const isRec =
        r.getBool('is_recurring') ||
        r.getBool('recurring') ||
        r.getString('recurrence_type') !== '' ||
        r.getString('recurrence_period') !== '' ||
        String(r.getString('notes') || '').indexOf('recorrência mensal') !== -1
      if (isRec) continue

      if (numOf(r) === 0 && totalOf(r) > 0) parentIds[r.id] = true
    }
    for (let i = 0; i < all.length; i++) {
      const p = all[i].getString('parent_transaction_id')
      if (p && byId[p]) parentIds[p] = true
    }

    // 4. Agrupa cada parcela (num > 0) na sua série:
    //    a) pelo parent_transaction_id explícito; b) por descrição base + conta (sem pai).
    const groups = {} // key -> { seriesKey, members: [] }
    const groupKeyOf = (r, parentId) =>
      parentId
        ? 'p:' + parentId
        : 'd:' +
          cleanBaseDesc(r.getString('description')) +
          '|' +
          r.getString('account_id') +
          '|' +
          r.getString('type')

    for (let i = 0; i < all.length; i++) {
      const r = all[i]
      // Blindagem estrita: lançamentos recorrentes NUNCA são parcelas!
      const isRec =
        r.getBool('is_recurring') ||
        r.getBool('recurring') ||
        r.getString('recurrence_type') !== '' ||
        r.getString('recurrence_period') !== '' ||
        String(r.getString('notes') || '').indexOf('recorrência mensal') !== -1
      if (isRec) continue

      const num = numOf(r)
      if (num === 0) continue
      let parentId = r.getString('parent_transaction_id')
      if (parentId === r.id) {
        // self-parenting: limpa
        if (!dryRun) {
          r.set('parent_transaction_id', '')
          $app.save(r)
        }
        parentId = ''
      }
      if (parentId && !byId[parentId] && !parentIds[parentId]) {
        // pai não existe mais no controle: tenta localizar pai consolidado equivalente
        let matched = null
        const base = cleanBaseDesc(r.getString('description'))
        const acc = r.getString('account_id')
        for (let j = 0; j < all.length; j++) {
          const cand = all[j]
          if (numOf(cand) !== 0 || totalOf(cand) <= 0) continue
          if (cand.getString('account_id') !== acc) continue
          if (cand.getString('type') !== r.getString('type')) continue
          if (cleanBaseDesc(cand.getString('description')) !== base) continue
          matched = cand
          break
        }
        if (matched && !dryRun) {
          r.set('parent_transaction_id', matched.id)
          $app.save(r)
          parentId = matched.id
        } else if (matched) {
          parentId = matched.id
        } else {
          parentId = ''
        }
      }
      const key = groupKeyOf(r, parentId)
      if (!groups[key]) groups[key] = { key, members: [] }
      groups[key].members.push(r)
    }

    const deleted = []
    const fixedTotals = []
    const linked = []

    for (const key in groups) {
      const members = groups[key].members

      // 5. Deduplicação por número de parcela — independe de installment_total e de notes
      const byNumber = {}
      for (let i = 0; i < members.length; i++) {
        const r = members[i]
        const num = numOf(r)
        if (num <= 0) continue
        if (!byNumber[num]) byNumber[num] = []
        byNumber[num].push(r)
      }

      for (const numStr in byNumber) {
        const list = byNumber[numStr]
        if (list.length <= 1) continue
        // Preferência: registro com installment_total preenchido e não importado; senão o mais antigo
        list.sort((a, b) => {
          const scoreA = (totalOf(a) > 0 ? 2 : 0) + (isImported(a) ? 0 : 1)
          const scoreB = (totalOf(b) > 0 ? 2 : 0) + (isImported(b) ? 0 : 1)
          if (scoreA !== scoreB) return scoreB - scoreA
          return createdOf(a) - createdOf(b)
        })
        for (let i = 1; i < list.length; i++) {
          const dup = list[i]
          if (isImported(dup)) continue // nunca tocar registros de importação
          if (!dryRun) $app.delete(dup)
          deleted.push({
            id: dup.id,
            description: dup.getString('description'),
            installment_number: numStr,
          })
        }
      }

      // 6. Corrige installment_total dos sobreviventes (total = 0)
      let seriesTotal = 0
      for (let i = 0; i < members.length; i++) {
        const t = totalOf(members[i])
        if (t > seriesTotal) seriesTotal = t
      }
      for (let i = 0; i < members.length; i++) {
        const r = members[i]
        if (totalOf(r) > 0 || isImported(r)) continue
        // tenta pelo pai consolidado
        let newTotal = 0
        const pid = r.getString('parent_transaction_id')
        if (pid && byId[pid] && totalOf(byId[pid]) > 0) {
          newTotal = totalOf(byId[pid])
        }
        if (!newTotal) {
          const m = String(r.getString('description') || '').match(/\(\s*\d+\s*\/\s*(\d+)\s*\)/)
          if (m) newTotal = parseInt(m[1], 10)
        }
        if (!newTotal) newTotal = seriesTotal
        if (newTotal > 1) {
          if (!dryRun) {
            r.set('installment_total', newTotal)
            $app.save(r)
          }
          fixedTotals.push({
            id: r.id,
            description: r.getString('description'),
            from: 0,
            to: newTotal,
          })
        }
      }

      // 7. Pai consolidado da série com total = 0 (ex.: "Havan (1/2)" com total 0)
      const first = members[0]
      const pid = first.getString('parent_transaction_id')
      const parentRec = pid && byId[pid] ? byId[pid] : null
      if (
        parentRec &&
        numOf(parentRec) === 0 &&
        totalOf(parentRec) <= 0 &&
        !isImported(parentRec)
      ) {
        let newTotal = 0
        for (let i = 0; i < members.length; i++) {
          const t = totalOf(members[i])
          if (t > newTotal) newTotal = t
        }
        if (!newTotal) {
          const m = String(parentRec.getString('description') || '').match(
            /\(\s*(\d+)\s*\/\s*(\d+)\s*\)/,
          )
          if (m) newTotal = parseInt(m[2], 10)
        }
        if (newTotal > 1 && !dryRun) {
          parentRec.set('installment_total', newTotal)
          $app.save(parentRec)
          fixedTotals.push({
            id: parentRec.id,
            description: parentRec.getString('description'),
            from: 0,
            to: newTotal,
          })
        } else if (newTotal > 1) {
          fixedTotals.push({
            id: parentRec.id,
            description: parentRec.getString('description'),
            from: 0,
            to: newTotal,
          })
        }
      }
    }

    // 8. Recalcula saldo das contas afetadas (exclusões reduzem despesa pendente duplicada)
    const affectedAccounts = {}
    for (let i = 0; i < deleted.length; i++) {
      const r = byId[deleted[i].id]
      if (r) affectedAccounts[r.getString('account_id')] = true
    }
    let recomputedAccounts = 0
    if (!dryRun) {
      for (const accId in affectedAccounts) {
        if (!accId) continue
        try {
          const acc = $app.findRecordById('accounts', accId)
          const accType = acc.getString('type')
          let calc = 0
          for (let i = 0; i < all.length; i++) {
            const t = all[i]
            if (t.getString('account_id') !== accId) continue
            if (deleted.some((d) => d.id === t.id)) continue
            const num = numOf(t)
            const tot = totalOf(t)
            if (num === 0 && tot > 0) continue // pai consolidado não entra no saldo
            const amt = t.getFloat('amount') || 0
            const isDespesa = t.getString('type') === 'despesa'
            if (accType === 'credito') calc += isDespesa ? amt : -amt
            else calc += isDespesa ? -amt : amt
          }
          calc = Math.round(calc * 100) / 100
          acc.set('balance', calc)
          $app.save(acc)
          recomputedAccounts++
        } catch (_) {}
      }
    }

    return e.json(200, {
      success: true,
      dryRun,
      scanned: all.length,
      deleted,
      fixedTotals,
      linked,
      recomputedAccounts,
    })
  },
  $apis.requireAuth(),
)
