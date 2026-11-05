// pocketbase/migrations/0061_seed_budgets_from_history.js
// Semeia orçamentos mensais realistas para controles que ainda NÃO possuem orçamentos.
//
// - Deriva os limites do histórico real: média mensal de gasto por categoria de despesa
//   nos últimos 3 meses completos (data efetiva = payment_date com fallback para date).
// - Limite = média arredondada + ~10% de folga (arredondado para múltiplos de 10).
// - Só categorias que realmente têm gasto histórico (média > 0), até 10 principais.
// - Orçamentos criados para o mês corrente (month/year numéricos da coleção budgets).
// Idempotente: no-op em base vazia, em controles que já têm orçamentos e em rodadas repetidas.
// Nunca apaga nem altera lançamentos.

migrate((app) => {
  console.log('[0061] Semeando orçamentos a partir do histórico (idempotente)...')

  const now = new Date()
  const pad2 = (n) => String(n).padStart(2, '0')
  const ymOf = (s) => String(s || '').split(/[T\s]/)[0].substring(0, 7)
  const ymShift = (ym, delta) => {
    const y = parseInt(ym.substring(0, 4), 10)
    const m = parseInt(ym.substring(5, 7), 10) - 1 + delta
    const ny = y + Math.floor(m / 12)
    const nm = ((m % 12) + 12) % 12
    return ny + '-' + pad2(nm + 1)
  }

  const currentYm = now.getFullYear() + '-' + pad2(now.getMonth() + 1)
  const historyMonths = []
  for (let m = 1; m <= 3; m++) historyMonths.push(ymShift(currentYm, -m))

  const controls = app.findRecordsByFilter('financial_controls', '', 'created', 500, 0)
  console.log('[0061] Controles encontrados: ' + controls.length)

  for (let i = 0; i < controls.length; i++) {
    const control = controls[i]
    const cid = control.id

    // No-op se o controle já possui qualquer orçamento
    let existing = []
    try {
      existing = app.findRecordsByFilter('budgets', 'control_id = {:cid}', 'created', 1, 0, { cid: cid })
    } catch (err) {
      console.log('[0061] Aviso ao consultar budgets do controle ' + cid + ': ' + err)
      continue
    }
    if (existing.length > 0) {
      console.log('[0061] Controle ' + control.getString('name') + ' já possui orçamentos — no-op.')
      continue
    }

    // Categorias de despesa ativas
    let cats = []
    try {
      const allCats = app.findRecordsByFilter(
        'categories',
        'control_id = {:cid} && type = "despesa"',
        'created',
        500,
        0,
        { cid: cid },
      )
      for (let c = 0; c < allCats.length; c++) {
        if (allCats[c].getBool('active') === false) continue
        cats.push(allCats[c])
      }
    } catch (err) {
      console.log('[0061] Aviso ao listar categorias do controle ' + cid + ': ' + err)
      continue
    }
    if (cats.length === 0) {
      console.log('[0061] Controle ' + control.getString('name') + ' sem categorias de despesa — no-op.')
      continue
    }

    // Gasto por categoria nos últimos 3 meses completos
    const spendByCat = {}
    try {
      const txs = app.findRecordsByFilter(
        'transactions',
        'control_id = {:cid} && type = "despesa"',
        'date',
        25000,
        0,
        { cid: cid },
      )
      for (let t = 0; t < txs.length; t++) {
        const tx = txs[t]
        const catId = tx.getString('category_id')
        if (!catId) continue
        const effective = tx.getString('payment_date') || tx.getString('date')
        const ym = ymOf(effective)
        if (historyMonths.indexOf(ym) === -1) continue
        if (!spendByCat[catId]) spendByCat[catId] = 0
        spendByCat[catId] += tx.getFloat('amount') || 0
      }
    } catch (err) {
      console.log('[0061] Aviso ao somar despesas por categoria do controle ' + cid + ': ' + err)
      continue
    }

    // Monta lista de candidatos com média > 0, ordenada por gasto total desc, até 10
    const candidates = []
    for (let c = 0; c < cats.length; c++) {
      const cat = cats[c]
      const total = spendByCat[cat.id] || 0
      if (total <= 0) continue
      candidates.push({ cat: cat, avg: total / historyMonths.length, total: total })
    }
    candidates.sort((a, b) => (a.total > b.total ? -1 : a.total < b.total ? 1 : 0))
    const chosen = candidates.slice(0, 10)

    if (chosen.length === 0) {
      console.log(
        '[0061] Controle ' + control.getString('name') + ' sem gasto histórico nos últimos 3 meses — no-op.',
      )
      continue
    }

    const budgetsCol = app.findCollectionByNameOrId('budgets')
    let created = 0
    for (let k = 0; k < chosen.length; k++) {
      const item = chosen[k]
      // média arredondada + ~10% de folga, arredondada para múltiplos de 10
      const limit = Math.max(10, Math.round((item.avg * 1.1) / 10) * 10)
      try {
        const rec = new Record(budgetsCol)
        rec.set('control_id', cid)
        rec.set('category_id', item.cat.id)
        rec.set('month', now.getMonth() + 1)
        rec.set('year', now.getFullYear())
        rec.set('amount', limit)
        app.save(rec)
        created++
        console.log(
          '[0061] Orçamento criado: "' +
            item.cat.getString('name') +
            '" — média ' +
            item.avg.toFixed(2) +
            ' → limite ' +
            limit,
        )
      } catch (err) {
        console.log(
          '[0061] Erro ao criar orçamento da categoria "' +
            item.cat.getString('name') +
            '" no controle ' +
            cid +
            ': ' +
            err,
        )
      }
    }
    console.log('[0061] Controle ' + control.getString('name') + ': ' + created + ' orçamentos criados.')
  }

  console.log('[0061] Seed de orçamentos concluído.')
}, (app) => {
  // Reversão no-op
})
