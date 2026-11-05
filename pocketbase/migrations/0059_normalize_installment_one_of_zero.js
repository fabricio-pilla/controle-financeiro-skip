// pocketbase/migrations/0059_normalize_installment_one_of_zero.js
// Normaliza parcelas importadas da planilha com formato "1 de 0"
// (installment_number > 0 e installment_total vazio/zerado).
//
// Regras:
// - Recorrentes (is_recurring/recurring/recurrence_*): INTOCADOS — nascem com parcela 0 por design.
// - Se o registro tem indício de série (mesma descrição normalizada + conta + tipo
//   aparecendo em meses consecutivos), preenche installment_total com o tamanho da série.
// - Caso contrário, zera installment_number para deixar de "parecer parcela".
// - NUNCA apaga lançamentos (pagos ou históricos) — apenas ajusta os dois campos de parcela.
// - Recalcula o saldo das contas afetadas ao final (cuidado crítico do projeto).
// Idempotente: em rodadas repetidas a varredura não encontra casos e não faz nada.

migrate((app) => {
  const nowIso = new Date().toISOString()
  console.log('[0059] Iniciando normalização de parcelas "1 de 0"...')

  const all = app.findRecordsByFilter('transactions', 'installment_number > 0', 'date', 25000, 0)
  const suspects = []
  for (let i = 0; i < all.length; i++) {
    const t = all[i]
    if (t.getInt('installment_total') > 0) continue
    const isRec =
      t.getBool('is_recurring') ||
      t.getBool('recurring') ||
      t.getString('recurrence_type') !== '' ||
      t.getString('recurrence_period') !== ''
    if (isRec) continue
    suspects.push(t)
  }
  console.log('[0059] Registros "1 de 0" (não recorrentes): ' + suspects.length)

  if (suspects.length === 0) {
    console.log('[0059] Nada a normalizar — no-op.')
    return
  }

  const cleanDesc = (d) =>
    String(d || '')
      .trim()
      .replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '')
      .replace(/\s*\(Total:.*$/i, '')
      .toLowerCase()
  const ymOf = (s) => String(s || '').split(/[T\s]/)[0].substring(0, 7)
  const nextYm = (ym) => {
    const y = parseInt(ym.substring(0, 4), 10)
    const m = parseInt(ym.substring(5, 7), 10)
    return m === 12 ? y + 1 + '-01' : y + '-' + String(m + 1).padStart(2, '0')
  }

  // Agrupa por tipo + conta + descrição normalizada
  const groups = {}
  for (let i = 0; i < suspects.length; i++) {
    const t = suspects[i]
    const key =
      t.getString('type') + '|' + t.getString('account_id') + '|' + cleanDesc(t.getString('description'))
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }

  const touchedAccounts = new Set()
  let filled = 0
  let zeroed = 0

  for (const key in groups) {
    const arr = groups[key].slice().sort((a, b) => {
      const ya = ymOf(a.getString('date'))
      const yb = ymOf(b.getString('date'))
      return ya < yb ? -1 : ya > yb ? 1 : 0
    })

    const months = []
    for (let i = 0; i < arr.length; i++) {
      const ym = ymOf(arr[i].getString('date'))
      if (ym && months.indexOf(ym) === -1) months.push(ym)
    }
    months.sort()

    let consecutive = false
    for (let i = 0; i < months.length - 1; i++) {
      if (nextYm(months[i]) === months[i + 1]) {
        consecutive = true
        break
      }
    }

    if (consecutive && months.length >= 2) {
      // Série real: total de parcelas = quantidade de ocorrências da série
      const total = arr.length
      for (let i = 0; i < arr.length; i++) {
        arr[i].set('installment_total', total)
        app.save(arr[i])
        filled++
      }
      console.log(
        '[0059] Série detectada ("' +
          cleanDesc(arr[0].getString('description')) +
          '"): installment_total preenchido com ' +
          total,
      )
    } else {
      // Sem indício de série: deixa de parecer parcela
      for (let i = 0; i < arr.length; i++) {
        arr[i].set('installment_number', 0)
        app.save(arr[i])
        zeroed++
      }
    }

    for (let i = 0; i < arr.length; i++) {
      const accId = arr[i].getString('account_id')
      if (accId) touchedAccounts.add(accId)
    }
  }

  console.log('[0059] Totais preenchidos: ' + filled + ' | parcelas zeradas: ' + zeroed)

  // Recalcula saldos das contas afetadas (os valores de parcela não alteram o cálculo,
  // mas o recalculo garante consistência após qualquer alteração em lançamentos)
  const affectedList = Array.from(touchedAccounts)
  for (let a = 0; a < affectedList.length; a++) {
    const accId = affectedList[a]
    if (!accId) continue
    try {
      const acc = app.findRecordById('accounts', accId)
      const accType = acc.getString('type')
      const accTxs = app.findRecordsByFilter(
        'transactions',
        'account_id = {:aid}',
        'date',
        25000,
        0,
        { aid: accId },
      )
      let calcBalance = 0
      for (let r = 0; r < accTxs.length; r++) {
        const tx = accTxs[r]
        // Ignora pai consolidado de parcelamento (num=0 && total>0)
        if (tx.getInt('installment_number') === 0 && tx.getInt('installment_total') > 0) continue
        const amt = tx.getFloat('amount') || 0
        const tType = tx.getString('type')
        calcBalance +=
          accType === 'credito'
            ? tType === 'despesa'
              ? amt
              : -amt
            : tType === 'receita'
              ? amt
              : -amt
      }
      calcBalance = Math.round(calcBalance * 100) / 100
      app
        .db()
        .newQuery('UPDATE accounts SET balance = {:b}, updated = {:u} WHERE id = {:id}')
        .bind({ b: calcBalance, u: nowIso, id: accId })
        .execute()
      console.log('[0059] Saldo recalculado da conta ' + accId + ': ' + calcBalance)
    } catch (err) {
      console.log('[0059] Aviso ao recalcular saldo da conta ' + accId + ': ' + err)
    }
  }

  console.log('[0059] Normalização concluída.')
}, (app) => {
  // Reversão no-op
})
