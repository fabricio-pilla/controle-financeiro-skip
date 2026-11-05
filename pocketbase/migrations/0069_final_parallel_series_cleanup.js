/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0069: Remoção cirúrgica FINAL das séries recorrentes paralelas.
 *
 * Por que a 0068 não alcançou tudo: ela agrupava por MÊS (ym|conta|subcat|tipo|dia).
 * Séries paralelas com horizontes diferentes (ex.: "Copel" gerada até out/2028 enquanto
 * "Conta de Luz" termina em set/2027) só colidem nos meses em que ambas existem —
 * os meses além do horizonte da série canônica nunca entraram em grupo algum e sobreviveram.
 *
 * PASSO 1 — Apagar (paid=false && payment_date >= 2026-11-01):
 *   a) description = 'Copel' (exata) — paralela a "Conta de Luz" (seed xf0o6rxany58q4v, mantida)
 *   b) description = 'Apple' exata + amount 19.9 + subcat 9yzonz6s451tv8p — paralela a
 *      "Apple Raffaela" (seed 1muvu24wvuqjn5m, mantida). NÃO apaga "Apple Fabricio",
 *      "Apple Matheus", nem o histórico pago "Apple" 5,90 de jan-out/2026.
 *   c) description = 'Clube Ifood' exata — paralela a "Clube Ifood Fabricio" (jy98fhc0w3qt4o3, mantida)
 *   d) description = 'Gympass' exata — paralela a Gympass Raffaela/Matheus/Fabricio (mantidas)
 *   Nada com data < 2026-11-01 e nenhum lançamento pago é tocado.
 *
 * PASSO 2 — Desarmar as sementes (is_recurring=false, recurring=false, recurrence_type='',
 *   recurrence_period='') para que o gerador (que considera recurrence_type preenchido como
 *   recorrente) nunca mais as aceite: eqnqbv70umtrolx, pbfre3blsngkjlj, 40s3q7wsfujbnpe,
 *   ng8gjskzlmlnjz5, wibvfueoue4xf2u.
 *
 * PASSO 3 — Repetir a varredura de pares da 0068, agora AGREGADA por conta+subcat+tipo+dia
 *   (sem cortar por mês), para eliminar qualquer par paralelo remanescente de nov/2026 em diante.
 *   Regra: mantém a série com histórico pago/importado (score); só apaga a perdedora quando
 *   ela NÃO tem histórico, NÃO tem nome de membro da família e NÃO é uma das séries canônicas.
 *
 * PASSO 4 — Repor (top-up) os meses de nov/2026 a out/2027 em que as séries canônicas
 *   (Conta de Luz, Apple Raffaela, Gympass Raffaela, Clube Ifood Fabricio, Salario, Agua,
 *   Spotify, Pensão Manu, Pensão Lele) estejam sem ocorrência, com as mesmas chaves de
 *   deduplicação do gerador (nominal, estrutural e slot).
 *
 * PASSO 5 — Recalcular o saldo de todas as contas.
 */

migrate(
  (app) => {
    console.log('[0069] Iniciando remocao cirurgica final de series paralelas...')

    const CUTOFF = '2026-11-01'
    const WINDOW_START = '2026-11'
    const WINDOW_END = '2027-10'
    const APPLE_SUBCAT = '9yzonz6s451tv8p'
    const SEEDS_TO_DISARM = [
      'eqnqbv70umtrolx', // Copel
      'pbfre3blsngkjlj', // Apple (19,90)
      '40s3q7wsfujbnpe', // Clube Ifood
      'ng8gjskzlmlnjz5', // Clube Ifood (semente alternativa)
      'wibvfueoue4xf2u', // Gympass (genérico)
    ]
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
    const PERSON_TOKENS = ['fabricio', 'raffaela', 'matheus', 'lele', 'manu']

    function getYM(d) {
      const s = String(d || '').trim()
      return s.length >= 7 ? s.substring(0, 7) : ''
    }
    function getDay(d) {
      const s = String(d || '').trim()
      return s.length >= 10 ? s.substring(8, 10) : ''
    }
    function dayOnly(d) {
      const s = String(d || '').trim()
      return s.length >= 10 ? s.substring(0, 10) : s
    }
    function norm(t) {
      return String(t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }
    function isCanonicalDesc(nd) {
      for (let i = 0; i < CANONICAL.length; i++) {
        const c = CANONICAL[i]
        if (nd === c || nd.indexOf(c + ' ') === 0) return true
      }
      return false
    }
    function hasPersonToken(nd) {
      for (let i = 0; i < PERSON_TOKENS.length; i++) {
        if (nd.indexOf(PERSON_TOKENS[i]) !== -1) return true
      }
      return false
    }
    function payDate(r) {
      return String(r.getString('payment_date') || r.getString('date') || '')
    }
    function isTargetDeletion(r) {
      const nd = norm(r.getString('description'))
      if (nd === 'copel') return true
      if (nd === 'clube ifood') return true
      if (nd === 'gympass') return true
      if (nd === 'apple' && r.getString('subcategory_id') === APPLE_SUBCAT) {
        const amt = Math.round((r.getFloat('amount') || 0) * 100) / 100
        if (Math.abs(amt - 19.9) < 0.005) return true
      }
      return false
    }
    function resolveSeed(rec, byId) {
      let curr = rec
      const visited = new Set()
      while (curr) {
        visited.add(curr.id)
        const parentId = curr.getString('parent_transaction_id')
        if (!parentId || visited.has(parentId)) return curr
        const parent = byId.get(parentId)
        if (!parent) return curr
        curr = parent
      }
      return curr
    }
    function getLastDay(year, month) {
      return new Date(year, month, 0).getDate()
    }
    function buildDate(ym, day) {
      const parts = ym.split('-')
      const maxDay = getLastDay(parseInt(parts[0], 10), parseInt(parts[1], 10))
      const d = Math.min(parseInt(day, 10) || 1, maxDay)
      return ym + '-' + String(d).padStart(2, '0')
    }

    // ============ PASSO 1: exclusão explícita dos 4 alvos ============
    let all = app.findRecordsByFilter('transactions', '1 = 1', '+payment_date', 0, 0)
    console.log('[0069] Total de transações carregadas (passo 1): ' + all.length)

    const removed = new Set()
    const accountsTouched = new Set()
    const targetCounts = {}
    for (const r of all) {
      const pd = payDate(r)
      if (!pd || dayOnly(pd) < CUTOFF) continue
      if (r.getBool('paid')) continue
      if (!isTargetDeletion(r)) continue
      const nd = norm(r.getString('description'))
      app.delete(r)
      removed.add(r.id)
      accountsTouched.add(r.getString('account_id'))
      targetCounts[nd] = (targetCounts[nd] || 0) + 1
      console.log(
        '[0069] APAGADO (alvo): ' + r.id + ' | ' + r.getString('description') + ' | ' + dayOnly(pd),
      )
    }
    console.log('[0069] PASSO 1 concluido. Apagados por descricao: ' + JSON.stringify(targetCounts))

    // ============ PASSO 2: desarmar as sementes listadas ============
    for (const sid of SEEDS_TO_DISARM) {
      if (removed.has(sid)) {
        console.log('[0069] Semente ' + sid + ' ja apagada no passo 1.')
        continue
      }
      try {
        const rec = app.findRecordById('transactions', sid)
        rec.set('is_recurring', false)
        rec.set('recurring', false)
        rec.set('recurrence_type', '')
        rec.set('recurrence_period', '')
        app.save(rec)
        console.log('[0069] Semente ' + sid + ' (' + rec.getString('description') + ') desarmada.')
      } catch (_) {
        console.log('[0069] Semente ' + sid + ' nao existe (ok).')
      }
    }

    // ============ PASSO 3: varredura agregada de pares paralelos ============
    all = app.findRecordsByFilter('transactions', '1 = 1', '+payment_date', 0, 0)
    const byId = new Map()
    for (const r of all) byId.set(r.id, r)

    const seedStats = new Map()
    for (const r of all) {
      const seed = resolveSeed(r, byId)
      if (!seed) continue
      if (!seedStats.has(seed.id)) {
        seedStats.set(seed.id, {
          seedRecord: seed,
          paidBeforeNov: 0,
          importedNotes: 0,
          total: 0,
        })
      }
      const st = seedStats.get(seed.id)
      st.total++
      if (dayOnly(payDate(r)) < CUTOFF && r.getBool('paid')) st.paidBeforeNov++
      if (
        String(r.getString('notes') || '')
          .toLowerCase()
          .indexOf('importado') !== -1
      )
        st.importedNotes++
    }
    function getSeedScore(sid) {
      const st = seedStats.get(sid)
      if (!st) return 0
      return st.paidBeforeNov * 1000 + st.importedNotes * 100 + st.total
    }

    const groups = new Map()
    for (const r of all) {
      if (removed.has(r.id)) continue
      const pd = payDate(r)
      if (!pd || dayOnly(pd) < CUTOFF) continue
      if (!(r.getBool('is_recurring') || r.getBool('recurring'))) continue
      if ((r.getInt('installment_total') || 0) > 0) continue
      const acc = r.getString('account_id')
      const sub = r.getString('subcategory_id')
      const day = getDay(pd)
      if (!acc || !sub || !day) continue
      const key = acc + '|' + sub + '|' + r.getString('type') + '|' + day
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(r)
    }

    const extraRemoved = new Set()
    const seedsToDisarm2 = new Set()
    const decisions = []
    for (const [key, recs] of groups.entries()) {
      const bySeed = new Map()
      for (const r of recs) {
        const seed = resolveSeed(r, byId)
        const sid = seed ? seed.id : r.id
        if (!bySeed.has(sid)) bySeed.set(sid, [])
        bySeed.get(sid).push(r)
      }
      const seedIds = Array.from(bySeed.keys())

      if (seedIds.length === 1) {
        // Duplicata intra-série no mesmo mês: manter 1 (pago primeiro, depois mais antigo)
        const perMonth = new Map()
        for (const r of recs) {
          const ym = getYM(payDate(r))
          if (!perMonth.has(ym)) perMonth.set(ym, [])
          perMonth.get(ym).push(r)
        }
        for (const [ym, list] of perMonth.entries()) {
          if (list.length <= 1) continue
          list.sort((a, b) => {
            const ap = a.getBool('paid') ? 1 : 0
            const bp = b.getBool('paid') ? 1 : 0
            if (ap !== bp) return bp - ap
            return String(a.getString('created')).localeCompare(String(b.getString('created')))
          })
          for (let i = 1; i < list.length; i++) {
            const dup = list[i]
            if (removed.has(dup.id) || extraRemoved.has(dup.id)) continue
            extraRemoved.add(dup.id)
            decisions.push(
              '[mes ' + ym + '] intra-serie: MANTIDO ' + list[0].id + ' | APAGADO ' + dup.id,
            )
          }
        }
        continue
      }

      // Sementes diferentes disputando o mesmo slot (conta+subcat+tipo+dia)
      seedIds.sort((a, b) => {
        const sa = getSeedScore(a)
        const sb = getSeedScore(b)
        if (sa !== sb) return sb - sa
        const da = norm((byId.get(a) || { getString: () => '' }).getString('description'))
        const db = norm((byId.get(b) || { getString: () => '' }).getString('description'))
        const wa = da.split(/\s+/).length
        const wb = db.split(/\s+/).length
        if (wa !== wb) return wb - wa
        const ca = String((byId.get(a) || {}).getString ? byId.get(a).getString('created') : '')
        const cb = String((byId.get(b) || {}).getString ? byId.get(b).getString('created') : '')
        return ca.localeCompare(cb)
      })
      const winner = seedIds[0]
      const wScore = getSeedScore(winner)
      const wRec = byId.get(winner)
      for (let i = 1; i < seedIds.length; i++) {
        const loser = seedIds[i]
        const lScore = getSeedScore(loser)
        const lRec = byId.get(loser)
        const lDesc = lRec ? norm(lRec.getString('description')) : ''
        let reason = ''
        if (wScore === 0) reason = 'ambiguo: nenhuma serie com historico pago/importado'
        else if (lScore > 0) reason = 'perdedora tambem tem historico - ambiguo'
        else if (isCanonicalDesc(lDesc)) reason = 'perdedora e serie canonica protegida'
        else if (hasPersonToken(lDesc)) reason = 'perdedora tem nome de membro da familia'
        if (reason) {
          decisions.push(
            '[slot ' +
              key +
              '] CONFLITO nao resolvido: mantido ' +
              winner +
              ' / ' +
              (wRec ? wRec.getString('description') : '?') +
              ' vs ' +
              loser +
              ' (' +
              lDesc +
              ') -> ' +
              reason,
          )
          continue
        }
        seedsToDisarm2.add(loser)
        // Apagar TODAS as ocorrências não pagas >= corte dessa semente perdedora
        for (const r of all) {
          if (removed.has(r.id) || extraRemoved.has(r.id)) continue
          const sd = resolveSeed(r, byId)
          if (!sd || sd.id !== loser) continue
          const pd = payDate(r)
          if (!pd || dayOnly(pd) < CUTOFF) continue
          if (r.getBool('paid')) continue
          extraRemoved.add(r.id)
          accountsTouched.add(r.getString('account_id'))
          decisions.push(
            '[slot ' +
              key +
              '] MANTIDO: ' +
              (wRec ? wRec.getString('description') : '?') +
              ' (' +
              winner +
              ') | APAGADO: ' +
              r.getString('description') +
              ' (' +
              r.id +
              ', ' +
              dayOnly(pd) +
              ')',
          )
        }
      }
    }

    for (const id of extraRemoved) {
      try {
        app.delete(app.findRecordById('transactions', id))
        removed.add(id)
        accountsTouched.add(byId.get(id).getString('account_id'))
      } catch (e) {
        console.log('[0069] Falha ao apagar ' + id + ': ' + e)
      }
    }
    for (const sid of seedsToDisarm2) {
      if (removed.has(sid)) continue
      try {
        const rec = app.findRecordById('transactions', sid)
        rec.set('is_recurring', false)
        rec.set('recurring', false)
        rec.set('recurrence_type', '')
        rec.set('recurrence_period', '')
        app.save(rec)
        console.log('[0069] Semente extra ' + sid + ' desarmada.')
      } catch (_) {}
    }
    console.log('[0069] PASSO 3 concluido. Apagados na varredura: ' + extraRemoved.size)
    for (const d of decisions) console.log('[0069] DECISAO ' + d)

    // ============ PASSO 4: repor meses canônicos nov/2026 a out/2027 ============
    const alive = []
    for (const r of all) if (!removed.has(r.id)) alive.push(r)

    const nominalSet = new Set()
    const structSet = new Set()
    const slotSet = new Set()
    for (const r of alive) {
      const nd = norm(r.getString('description'))
      const acc = r.getString('account_id')
      const type = r.getString('type')
      const amt = Math.round((r.getFloat('amount') || 0) * 100) / 100
      const sub = r.getString('subcategory_id')
      const ymD = getYM(String(r.getString('date') || ''))
      const ymP = getYM(payDate(r))
      if (ymD) {
        nominalSet.add(type + '|' + acc + '|' + nd + '|' + ymD)
        structSet.add(type + '|' + acc + '|' + amt + '|' + ymD)
        if (sub)
          slotSet.add(
            type +
              '|' +
              acc +
              '|' +
              sub +
              '|' +
              getDay(String(r.getString('date') || '')) +
              '|' +
              ymD,
          )
      }
      if (ymP) {
        nominalSet.add(type + '|' + acc + '|' + nd + '|' + ymP)
        structSet.add(type + '|' + acc + '|' + amt + '|' + ymP)
        if (sub) slotSet.add(type + '|' + acc + '|' + sub + '|' + getDay(payDate(r)) + '|' + ymP)
      }
    }

    const now = new Date()
    const currentYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
    const txCol = app.findCollectionByNameOrId('transactions')
    const windowMonths = []
    let wy = parseInt(WINDOW_START.split('-')[0], 10)
    let wm = parseInt(WINDOW_START.split('-')[1], 10)
    for (let i = 0; i < 12; i++) {
      windowMonths.push(wy + '-' + String(wm).padStart(2, '0'))
      wm++
      if (wm > 12) {
        wm = 1
        wy++
      }
    }

    let toppedUp = 0
    for (const c of CANONICAL) {
      const recs = alive.filter((r) => {
        const nd = norm(r.getString('description'))
        return nd === c || nd.indexOf(c + ' ') === 0
      })
      if (recs.length === 0) {
        console.log('[0069] TOPUP: nenhuma ocorrencia encontrada para "' + c + '" (nada a repor).')
        continue
      }
      const monthsPresent = new Set()
      for (const r of recs) {
        const ym = getYM(payDate(r))
        if (ym >= WINDOW_START && ym <= WINDOW_END) monthsPresent.add(ym)
      }
      let template = null
      for (const r of recs) {
        if (dayOnly(payDate(r)) >= CUTOFF) {
          template = r
          break
        }
      }
      if (!template) template = recs[recs.length - 1]
      const seed = resolveSeed(template, byId) || template
      const type = template.getString('type')
      const acc = template.getString('account_id')
      const sub = template.getString('subcategory_id')
      const amt = Math.round((template.getFloat('amount') || 0) * 100) / 100
      const dateDay =
        getDay(String(template.getString('date') || '')) || getDay(payDate(template)) || '01'
      const payDay = getDay(payDate(template)) || dateDay

      for (const ym of windowMonths) {
        if (monthsPresent.has(ym)) continue
        const targetDate = buildDate(ym, dateDay)
        const targetPay = buildDate(ym, payDay)
        if (
          nominalSet.has(type + '|' + acc + '|' + c + '|' + ym) ||
          structSet.has(type + '|' + acc + '|' + amt + '|' + ym) ||
          structSet.has(type + '|' + acc + '|' + amt + '|' + getYM(targetPay)) ||
          (sub &&
            (slotSet.has(type + '|' + acc + '|' + sub + '|' + dateDay + '|' + ym) ||
              slotSet.has(type + '|' + acc + '|' + sub + '|' + payDay + '|' + getYM(targetPay))))
        ) {
          console.log('[0069] TOPUP "' + c + '" ' + ym + ': slot ocupado por outra serie, pulado.')
          continue
        }
        const isRetro = ym < currentYM
        const newRec = new Record(txCol)
        newRec.set('control_id', template.getString('control_id'))
        newRec.set('user_id', template.getString('user_id'))
        newRec.set('type', type)
        newRec.set('amount', template.getFloat('amount'))
        newRec.set('description', template.getString('description'))
        newRec.set('category_id', template.getString('category_id') || '')
        newRec.set('subcategory_id', sub || '')
        newRec.set('account_id', acc || '')
        newRec.set('date', targetDate)
        newRec.set('payment_date', targetPay)
        newRec.set('paid', isRetro)
        newRec.set('is_recurring', true)
        newRec.set('recurring', true)
        newRec.set('recurrence_type', template.getString('recurrence_type') || 'mensal')
        newRec.set('recurrence_period', template.getString('recurrence_period') || 'mensal')
        newRec.set('installment_number', 0)
        newRec.set('installment_total', 0)
        newRec.set('parent_transaction_id', seed ? seed.id : '')
        newRec.set('notes', 'Gerado automaticamente: recorrência mensal')
        app.save(newRec)
        toppedUp++
        monthsPresent.add(ym)
        nominalSet.add(type + '|' + acc + '|' + c + '|' + ym)
        structSet.add(type + '|' + acc + '|' + amt + '|' + ym)
        structSet.add(type + '|' + acc + '|' + amt + '|' + getYM(targetPay))
        console.log('[0069] TOPUP criado: "' + template.getString('description') + '" ' + targetPay)
      }
    }
    console.log('[0069] PASSO 4 concluido. Ocorrencias repostas: ' + toppedUp)

    // ============ PASSO 5: recalcular saldos ============
    const allAccounts = app.findRecordsByFilter('accounts', '1 = 1', '+name', 0, 0)
    for (const acc of allAccounts) {
      const paidTxs = app.findRecordsByFilter(
        'transactions',
        'account_id = "' + acc.id + '" && paid = true',
        '+payment_date',
        0,
        0,
      )
      let balance = acc.getFloat('initial_balance') || 0
      for (const tx of paidTxs) {
        const amount = tx.getFloat('amount') || 0
        if (tx.getString('type') === 'receita') balance += amount
        else if (tx.getString('type') === 'despesa') balance -= amount
      }
      balance = Math.round(balance * 100) / 100
      acc.set('current_balance', balance)
      app.save(acc)
    }
    console.log(
      '[0069] PASSO 5 concluido. Saldos recalculados para ' + allAccounts.length + ' contas.',
    )
    console.log('[0069] Migração 0069 concluída.')
  },
  (app) => {
    console.log('[0069] Down: no-op (limpeza definitiva).')
  },
)
