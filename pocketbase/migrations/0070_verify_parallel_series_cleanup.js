/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0070: VERIFICAÇÃO OBRIGATÓRIA pós-limpeza (somente leitura).
 *
 * Não altera nenhum dado: apenas confere, no banco vivo, que
 *  (a) NÃO existe mais nenhuma ocorrência das séries paralelas apagadas
 *      (Copel; Apple 19,90 subcat 9yzonz6s451tv8p; Clube Ifood exato; Gympass exato)
 *      com payment_date >= 2026-11-01;
 *  (b) cada série canônica tem EXATAMENTE 1 ocorrência por mês de nov/2026 a out/2027:
 *      Conta de Luz, Apple Raffaela, Gympass Raffaela, Clube Ifood Fabricio,
 *      Salario, Agua, Spotify, Pensão Manu e Pensão Lele;
 *  (c) as sementes desarmadas (se ainda existirem) estão com is_recurring=false.
 *
 * Qualquer desvio LANÇA ERRO com o detalhe (ids, datas), o que faz o apply falhar
 * e surfaced o problema — em vez de relatar sucesso falso.
 */

migrate(
  (app) => {
    const CUTOFF = '2026-11-01'
    const APPLE_SUBCAT = '9yzonz6s451tv8p'

    function norm(t) {
      return String(t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }
    function dayOnly(d) {
      const s = String(d || '').trim()
      return s.length >= 10 ? s.substring(0, 10) : s
    }
    function ymOf(d) {
      const s = String(d || '').trim()
      return s.length >= 7 ? s.substring(0, 7) : ''
    }

    const all = app.findRecordsByFilter('transactions', '1 = 1', '+payment_date', 0, 0)

    // ---------- (a) alvos apagados não podem existir a partir do corte ----------
    const problems = []
    const isTarget = (r) => {
      const nd = norm(r.getString('description'))
      if (nd === 'copel') return 'Copel'
      if (nd === 'clube ifood') return 'Clube Ifood'
      if (nd === 'gympass') return 'Gympass'
      if (
        nd === 'apple' &&
        r.getString('subcategory_id') === APPLE_SUBCAT &&
        Math.abs((r.getFloat('amount') || 0) - 19.9) < 0.005
      ) {
        return 'Apple 19,90'
      }
      return null
    }
    const targetHits = {}
    for (const r of all) {
      const pd = dayOnly(r.getString('payment_date') || r.getString('date'))
      if (!pd || pd < CUTOFF) continue
      const target = isTarget(r)
      if (!target) continue
      const k = target + (r.getBool('paid') ? ' [PAGA]' : ' [pendente]')
      if (!targetHits[k]) targetHits[k] = []
      targetHits[k].push(r.id + '@' + pd)
    }
    for (const k of Object.keys(targetHits)) {
      problems.push(
        '(a) REGRESSAO: ' +
          targetHits[k].length +
          'x "' +
          k +
          '" >= 2026-11-01: ' +
          targetHits[k].join(', '),
      )
    }

    // ---------- (b) séries canônicas: exatamente 1 ocorrência por mês ----------
    const CANONICAL = [
      'conta de luz',
      'apple raffaela',
      'gympass raffaela',
      'clube ifood fabricio',
      'salario',
      'agua',
      'spotify',
      'pensao manu',
      'pensao lele',
    ]
    const months = []
    let my = 2026
    let mm = 11
    for (let i = 0; i < 12; i++) {
      months.push(my + '-' + String(mm).padStart(2, '0'))
      mm++
      if (mm > 12) {
        mm = 1
        my++
      }
    }
    const perSeries = {}
    for (const r of all) {
      const nd = norm(r.getString('description'))
      if (CANONICAL.indexOf(nd) === -1) continue
      const pd = r.getString('payment_date') || r.getString('date')
      const ym = ymOf(pd)
      if (!ym || ym < '2026-11' || ym > '2027-10') continue
      if (!perSeries[nd]) perSeries[nd] = {}
      if (!perSeries[nd][ym]) perSeries[nd][ym] = []
      perSeries[nd][ym].push(r.id + '@' + dayOnly(pd) + (r.getBool('paid') ? '(paga)' : '(pend)'))
    }
    for (const c of CANONICAL) {
      const byMonth = perSeries[c] || {}
      for (const ym of months) {
        const list = byMonth[ym] || []
        if (list.length === 0) {
          problems.push('(b) FALTA: "' + c + '" sem ocorrência em ' + ym)
        } else if (list.length > 1) {
          problems.push(
            '(b) DUPLICADA: "' +
              c +
              '" tem ' +
              list.length +
              ' ocorrências em ' +
              ym +
              ': ' +
              list.join(', '),
          )
        }
      }
    }

    // ---------- (c) sementes desarmadas ----------
    const SEEDS = [
      'eqnqbv70umtrolx',
      'pbfre3blsngkjlj',
      '40s3q7wsfujbnpe',
      'ng8gjskzlmlnjz5',
      'wibvfueoue4xf2u',
    ]
    for (const sid of SEEDS) {
      try {
        const rec = app.findRecordById('transactions', sid)
        if (rec.getBool('is_recurring') || rec.getBool('recurring')) {
          problems.push(
            '(c) SEMENTE ARMADA: ' +
              sid +
              ' (' +
              rec.getString('description') +
              ') ainda is_recurring/recurring = true',
          )
        }
      } catch (_) {
        // semente não existe (foi apagada) — ok
      }
    }

    // ---------- resumo ----------
    const summary = []
    for (const c of CANONICAL) {
      const byMonth = perSeries[c] || {}
      const counts = months.map((ym) => (byMonth[ym] || []).length)
      summary.push(c + '=' + counts.join(','))
    }
    console.log('[0070] VERIFICACAO ocorrencias/mes (nov26..out27): ' + summary.join(' | '))
    console.log('[0070] VERIFICACAO alvos restantes >= corte: ' + JSON.stringify(targetHits))
    console.log('[0070] VERIFICACAO problemas: ' + problems.length)

    if (problems.length > 0) {
      throw new Error(
        '[0070] VERIFICACAO FALHOU (' + problems.length + '): ' + problems.join(' || '),
      )
    }
    console.log('[0070] VERIFICACAO OK: limpeza confirmada no banco vivo.')
  },
  (app) => {
    console.log('[0070] Down: no-op (verificação somente leitura).')
  },
)
