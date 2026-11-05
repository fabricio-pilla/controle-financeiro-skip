// pocketbase/migrations/0060_seed_emergency_goal.js
// Semeia a meta "Reserva de Emergência" para controles que ainda NÃO possuem metas.
//
// - Alvo = ~6 meses de despesas: média mensal de despesas dos últimos 6 meses completos
//   do banco (data efetiva = payment_date com fallback para date), arredondada para múltiplos de 50.
// - Valor atual = soma dos saldos das contas ativas que não são cartão de crédito.
// - Prazo = ~12 meses à frente (mesmo dia, ajustado ao último dia do mês).
// - Adiciona o campo text "description" à coleção goals (idempotente) para guardar o objetivo.
// Idempotente: no-op em base vazia, em controles que já têm metas e em rodadas repetidas.
// Nunca apaga nem altera lançamentos.

migrate((app) => {
  console.log('[0060] Semeando meta "Reserva de Emergência" (idempotente)...')

  // 1. Garante o campo description em goals
  try {
    const goalsCol = app.findCollectionByNameOrId('goals')
    if (!goalsCol.fields.getByName('description')) {
      goalsCol.fields.add(new Field({ name: 'description', type: 'text' }))
      app.save(goalsCol)
      console.log('[0060] Campo "description" adicionado à coleção goals.')
    }
  } catch (err) {
    console.log('[0060] Aviso ao ajustar coleção goals: ' + err)
  }

  // 2. Per cada controle sem metas, cria a Reserva de Emergência
  const controls = app.findRecordsByFilter('financial_controls', '', 'created', 500, 0)
  console.log('[0060] Controles encontrados: ' + controls.length)

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
  const lastDayOf = (y, m) => new Date(y, m, 0).getDate()

  for (let i = 0; i < controls.length; i++) {
    const control = controls[i]
    const cid = control.id

    // No-op se o controle já possui qualquer meta
    let existing = []
    try {
      existing = app.findRecordsByFilter('goals', 'control_id = {:cid}', 'created', 1, 0, { cid: cid })
    } catch (err) {
      console.log('[0060] Aviso ao consultar goals do controle ' + cid + ': ' + err)
      continue
    }
    if (existing.length > 0) {
      console.log('[0060] Controle ' + control.getString('name') + ' já possui metas — no-op.')
      continue
    }

    // Média mensal de despesas dos últimos 6 meses completos (exclui o mês corrente, parcial)
    const monthKeys = []
    const currentYm = now.getFullYear() + '-' + pad2(now.getMonth() + 1)
    for (let m = 1; m <= 6; m++) monthKeys.push(ymShift(currentYm, -m))

    const monthSpend = {}
    for (let m = 0; m < monthKeys.length; m++) monthSpend[monthKeys[m]] = 0

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
        const effective = tx.getString('payment_date') || tx.getString('date')
        const ym = ymOf(effective)
        if (monthSpend[ym] === undefined) continue
        monthSpend[ym] += tx.getFloat('amount') || 0
      }
    } catch (err) {
      console.log('[0060] Aviso ao somar despesas do controle ' + cid + ': ' + err)
      continue
    }

    let totalSpend = 0
    let monthsWithData = 0
    for (let m = 0; m < monthKeys.length; m++) {
      totalSpend += monthSpend[monthKeys[m]]
      if (monthSpend[monthKeys[m]] > 0) monthsWithData++
    }
    if (totalSpend <= 0) {
      console.log(
        '[0060] Controle ' + control.getString('name') + ' sem despesas nos últimos 6 meses — no-op.',
      )
      continue
    }
    const avgMonthly = totalSpend / Math.max(1, monthsWithData)
    const target = Math.round((avgMonthly * 6) / 50) * 50

    // Valor atual = saldo das contas ativas que não são cartão de crédito
    let current = 0
    try {
      const accounts = app.findRecordsByFilter('accounts', 'control_id = {:cid}', 'created', 500, 0, {
        cid: cid,
      })
      for (let a = 0; a < accounts.length; a++) {
        const acc = accounts[a]
        if (acc.getBool('active') === false) continue
        if (acc.getString('type') === 'credito') continue
        current += acc.getFloat('balance') || 0
      }
    } catch (err) {
      console.log('[0060] Aviso ao somar saldos do controle ' + cid + ': ' + err)
    }
    current = Math.round(current * 100) / 100

    // Prazo: ~12 meses à frente
    const deadline = new Date(now.getFullYear(), now.getMonth() + 12, 1)
    deadline.setDate(Math.min(now.getDate(), lastDayOf(deadline.getFullYear(), deadline.getMonth())))
    const deadlineStr =
      deadline.getFullYear() +
      '-' +
      pad2(deadline.getMonth() + 1) +
      '-' +
      pad2(deadline.getDate()) +
      ' 00:00:00.000Z'

    const formattedAvg = 'R$ ' + avgMonthly.toFixed(2).replace('.', ',')
    const description =
      'Objetivo: acumular o equivalente a cerca de 6 meses de despesas familiares para imprevistos ' +
      '(saúde, casa, desemprego). Alvo calculado a partir da média mensal de despesas de ' +
      formattedAvg +
      ' nos últimos meses. O valor atual parte do saldo total em contas e pode ser ajustado conforme a reserva cresce.'

    try {
      const goalsCol = app.findCollectionByNameOrId('goals')
      const rec = new Record(goalsCol)
      rec.set('control_id', cid)
      rec.set('name', 'Reserva de Emergência')
      rec.set('target_amount', target)
      rec.set('current_amount', current)
      rec.set('color', '#10B981')
      rec.set('deadline', deadlineStr)
      rec.set('description', description)
      app.save(rec)
      console.log(
        '[0060] Meta criada para ' +
          control.getString('name') +
          ' — alvo: ' +
          target +
          ' | atual: ' +
          current,
      )
    } catch (err) {
      console.log('[0060] Erro ao criar meta do controle ' + cid + ': ' + err)
    }
  }

  console.log('[0060] Seed de meta concluído.')
}, (app) => {
  // Reversão no-op
})
