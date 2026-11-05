/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0068: Limpeza mês a mês de séries recorrentes paralelas com nomes diferentes.
 *
 * Problema diagnosticado:
 * Mesmo após as limpezas anteriores (migrations 0065-0067), restaram séries paralelas com
 * nomes/descrições diferentes (ex: "Copel" vs "Conta de Luz", "Apple" vs "Apple Raffaela",
 * "Gympass" vs "Gympass Raffaela", "Clube Ifood" vs "Clube Ifood Fabricio").
 * A deduplicação anterior por descrição+conta+mês não casava essas séries porque as descrições
 * diferiam, gerando duplicatas no mesmo mês para a mesma conta, mesma subcategoria e mesmo dia.
 *
 * Critérios conservadores de paralelismo (definidos no prompt):
 * - Ocorrências no mesmo mês (nov/2026 em diante)
 * - Mesmo account_id
 * - Mesmo type (receita ou despesa)
 * - Mesmo dia de payment_date (ex: dia 05 ou dia 18)
 * - Mesma subcategory_id
 * - Séries distintas (parent_transaction_id diferentes ou sementes diferentes)
 *
 * Regras de desempate / seleção da série canônica a manter:
 * 1. Preferir a série cuja semente/histórico possui registros pagos importados no passado
 *    (ex.: notes contendo 'Importado' e/ou ocorrências pagas jan-out/2026).
 * 2. Entre sementes geradas ou equivalentes, manter a que tem nome mais específico/canônico
 *    e data de criação mais antiga.
 * 3. NUNCA apagar:
 *    - Lançamentos pagos de jan-out/2026.
 *    - Parcelamentos (installment_total > 0).
 *    - Séries distintas que representam pessoas diferentes com subcategorias diferentes
 *      (ex: Apple Fabricio em conta ev5wboyw8somrnj subcategoria 16qxubbky7ea17q vs
 *       Apple Raffaela em conta ev5wboyw8somrnj subcategoria 9yzonz6s451tv8p).
 * 4. Ao apagar as ocorrências de nov/2026 em diante da série perdedora, desarmar a semente
 *    (is_recurring=false, recurring=false) para que futuras gerações nunca recriem duplicatas.
 * 5. Recalcular os saldos de todas as contas afetadas.
 */

migrate(
  (app) => {
    console.log('[0068] Iniciando limpeza mes a mes de series recorrentes paralelas...')

    const CUTOFF_START = '2026-11-01 00:00:00.000Z'

    // Helper para extrair YYYY-MM
    function getYearMonth(dateStr) {
      if (!dateStr) return ''
      const s = String(dateStr).trim()
      return s.length >= 7 ? s.substring(0, 7) : ''
    }

    // Helper para extrair o dia do mes (DD)
    function getDayOfMonth(dateStr) {
      if (!dateStr) return ''
      const s = String(dateStr).trim()
      if (s.length >= 10) {
        return s.substring(8, 10)
      }
      return ''
    }

    // 1. Carregar todas as transações para análise em memória
    const allRecords = app.findRecordsByFilter('transactions', '1 = 1', '+payment_date', 0, 0)
    console.log(`[0068] Total de transações carregadas: ${allRecords.length}`)

    // Mapear por ID para acesso rápido
    const recordsById = new Map()
    for (const r of allRecords) {
      recordsById.set(r.id, r)
    }

    // Helper para encontrar a seed (origem) de uma transação recorrente
    function resolveSeed(rec) {
      if (!rec) return null
      let curr = rec
      const visited = new Set()
      while (curr) {
        visited.add(curr.id)
        const parentId = curr.getString('parent_transaction_id')
        if (!parentId) {
          return curr
        }
        if (visited.has(parentId)) {
          return curr
        }
        const parent = recordsById.get(parentId)
        if (!parent) {
          return curr
        }
        curr = parent
      }
      return curr
    }

    // Estatísticas da seed para pontuação de canonicidade
    // Pontua se a seed ou sua linhagem tem histórico pago jan-out/2026, notas de importação, etc.
    const seedStats = new Map()
    for (const r of allRecords) {
      const seed = resolveSeed(r)
      if (!seed) continue
      const seedId = seed.id
      if (!seedStats.has(seedId)) {
        seedStats.set(seedId, {
          seedRecord: seed,
          importedNotesCount: 0,
          paidBeforeNovCount: 0,
          totalOccurrences: 0,
          created: seed.getString('created') || '',
          description: seed.getString('description') || '',
        })
      }
      const st = seedStats.get(seedId)
      st.totalOccurrences++
      const pDate = r.getString('payment_date') || r.getString('date') || ''
      const isPaid = r.getBool('paid')
      const notes = r.getString('notes') || ''
      if (notes.toLowerCase().includes('importado')) {
        st.importedNotesCount++
      }
      if (pDate < CUTOFF_START && isPaid) {
        st.paidBeforeNovCount++
      }
    }

    // Função de score para desempate entre duas sementes da mesma conta/subcat/dia
    function getSeedScore(seedId) {
      const st = seedStats.get(seedId)
      if (!st) return 0
      let score = 0
      // Histórico pago antes de nov/2026 tem peso altíssimo (é a série real histórica)
      score += st.paidBeforeNovCount * 1000
      // Notas de importação da planilha
      score += st.importedNotesCount * 100
      // Quantidade total de ocorrências
      score += st.totalOccurrences * 1
      return score
    }

    // Mapear candidatos no período >= 2026-11-01
    // Agrupar por: Month (YYYY-MM) + AccountId + SubcategoryId + Type + Day (DD)
    // Apenas transações recorrentes e NÃO parceladas
    const groupsByMonthKey = new Map()

    const evaluatedLegitimate = []
    const duplicatesToDelete = []
    const pairsLog = []
    const seedsToDisarm = new Set()
    const monthsBreakdown = new Map() // YYYY-MM -> count

    for (const r of allRecords) {
      const pDate = r.getString('payment_date') || r.getString('date') || ''
      if (pDate < CUTOFF_START) continue

      const isRecurring = r.getBool('is_recurring') || r.getBool('recurring')
      const isInstallment = (r.getInt('installment_total') || 0) > 0
      if (!isRecurring || isInstallment) continue

      const ym = getYearMonth(pDate)
      const day = getDayOfMonth(pDate)
      const accId = r.getString('account_id')
      const subcatId = r.getString('subcategory_id')
      const type = r.getString('type')

      // Sem subcategoria ou conta válida, não agrupa para segurança
      if (!accId || !subcatId || !ym || !day) continue

      const key = `${ym}|${accId}|${subcatId}|${type}|${day}`
      if (!groupsByMonthKey.has(key)) {
        groupsByMonthKey.set(key, [])
      }
      groupsByMonthKey.get(key).push(r)
    }

    console.log(
      `[0068] Total de grupos agrupados por mes/conta/subcat/tipo/dia: ${groupsByMonthKey.size}`,
    )

    // Processar cada grupo mês a mês
    for (const [key, records] of groupsByMonthKey.entries()) {
      if (records.length <= 1) {
        continue
      }

      const [ym, accId, subcatId, type, day] = key.split('|')

      // Agrupar registros do mesmo grupo pela seed
      const bySeed = new Map()
      for (const r of records) {
        const seed = resolveSeed(r)
        const seedId = seed ? seed.id : r.id
        if (!bySeed.has(seedId)) {
          bySeed.set(seedId, [])
        }
        bySeed.get(seedId).push(r)
      }

      // Se todas as ocorrências do grupo pertencem à MESMA seed, isso é uma duplicata intra-série
      // que migrations anteriores podem já ter tratado ou não.
      // Se pertencem a seeds DIFERENTES, são séries paralelas competindo pelo mesmo slot!
      const seedIds = Array.from(bySeed.keys())

      if (seedIds.length === 1) {
        // Mesma série com mais de 1 lançamento no mesmo mês: manter 1 (preferência pelo pago ou mais antigo)
        const sRecords = bySeed.get(seedIds[0])
        if (sRecords.length > 1) {
          // Ordenar: pagos primeiro, depois por created asc
          sRecords.sort((a, b) => {
            const aPaid = a.getBool('paid') ? 1 : 0
            const bPaid = b.getBool('paid') ? 1 : 0
            if (aPaid !== bPaid) return bPaid - aPaid
            return a.getString('created').localeCompare(b.getString('created'))
          })
          const kept = sRecords[0]
          for (let i = 1; i < sRecords.length; i++) {
            const dup = sRecords[i]
            duplicatesToDelete.push(dup)
            monthsBreakdown.set(ym, (monthsBreakdown.get(ym) || 0) + 1)
            pairsLog.push({
              month: ym,
              keptId: kept.id,
              keptDesc: kept.getString('description'),
              deletedId: dup.id,
              deletedDesc: dup.getString('description'),
              reason: `Duplicata intra-serie (mesma seed ${seedIds[0]}) no mesmo mes/dia`,
            })
          }
        }
        continue
      }

      // SEEDS DIFERENTES: analisar os pares de séries paralelas!
      // Decisões canônicas conhecidas mapeadas no diagnóstico:
      // Caso 1: Copel vs Conta de Luz (ambas subcat 8wrtonu3bnskaii, conta cptwpqlmt4hqigf, dia 05)
      // "Conta de Luz" foi a semente original importada de planilha (xf0o6rxany58q4v, notas 'Importado...').
      // "Copel" foi criada manualmente em 05/10/2026 (eqnqbv70umtrolx) com valor 405.18.
      // "Conta de Luz" (seed xf0o6rxany58q4v) tem histórico desde setembro. Porém, no app o usuário pode chamar de Copel ou Conta de Luz.
      // O prompt especifica claramente o par:
      // "1. Copel x Conta de Luz - duas séries de energia elétrica:
      //   - Copel: seed eqnqbv70umtrolx (criada 05/10/2026), R$ 405,18
      //   - Conta de Luz: seed xf0o6rxany58q4v (criada 03/11/2026 / 18/09/2026), R$ 370,99
      //   Qual série manter: preferir a série cuja seed tem histórico pago importado (notes ~ 'Importado'
      //   e/ou ocorrências pagas no passado jan-out/2026) - é a série 'real'. Entre duas sementes geradas,
      //   manter a de nome mais específico/canônico e created mais antigo."
      // Para Conta de Luz vs Copel: Conta de Luz possui notes 'Importado de planilha' e histórico pago anterior!
      // Portanto Conta de Luz é a mantida, Copel é a apagada (ou vice-versa se especificado).
      // Vamos verificar a pontuação getSeedScore(seedId):
      // xf0o6rxany58q4v: importedNotesCount > 0, paidBeforeNovCount > 0 -> Score muito maior que Copel!

      // Caso 2: Apple vs Apple Raffaela
      // Apple Raffaela (1muvu24wvuqjn5m): subcat 9yzonz6s451tv8p, conta ev5wboyw8somrnj, dia 18, R$ 19,90.
      // Apple (pbfre3blsngkjlj): gerou ocorrências de nov/2026 em diante com subcat 9yzonz6s451tv8p, conta ev5wboyw8somrnj, dia 18, R$ 19,90!
      // Apple Raffaela é o nome canônico específico e com histórico pago em setembro.
      // Apple genérico nessa mesma subcat 9yzonz6s451tv8p foi gerado em paralelo.
      // getSeedScore(1muvu24wvuqjn5m) vs getSeedScore(pbfre3blsngkjlj):
      // 1muvu24wvuqjn5m é a específica "Apple Raffaela".
      // Além disso, se uma tiver nome específico de pessoa ("Apple Raffaela") vs nome genérico ("Apple") na MESMA subcategoria da Raffaela,
      // a específica "Apple Raffaela" deve ser mantida, e a genérica duplicada "Apple" apagada!

      // Caso 3: Gympass vs Gympass Raffaela
      // Gympass Raffaela (4jpfm6k8udsyemi): subcat w0dteyo30thrp8q, conta ev5wboyw8somrnj, dia 18, R$ 91,70.
      // Gympass (wibvfueoue4xf2u): subcat w0dteyo30thrp8q, conta ev5wboyw8somrnj, dia 18, R$ 89,90.
      // Gympass Raffaela é a série específica da Raffaela. A genérica Gympass está colidindo na MESMA subcategoria e dia.

      // Caso 4: Clube Ifood vs Clube Ifood Fabricio na conta ev5wboyw8somrnj, subcat ie80grlzzfj72zw, dia 18, R$ 7,95
      // Clube Ifood Fabricio (jy98fhc0w3qt4o3): seed de 18/09 com notes 'Importado de planilha'.
      // Clube Ifood (ng8gjskzlmlnjz5): criada em 26/10 sem paid anterior.
      // Clube Ifood Fabricio tem maior score e nome específico canônico.

      // Ordenar as seeds candidatas por score decrescente
      seedIds.sort((sA, sB) => {
        const scoreA = getSeedScore(sA)
        const scoreB = getSeedScore(sB)
        if (scoreA !== scoreB) {
          return scoreB - scoreA
        }

        const seedRecA = seedStats.get(sA)?.seedRecord
        const seedRecB = seedStats.get(sB)?.seedRecord
        const descA = (seedRecA?.getString('description') || '').trim()
        const descB = (seedRecB?.getString('description') || '').trim()

        // Preferir nome mais específico (ex: "Apple Raffaela" > "Apple", "Gympass Raffaela" > "Gympass")
        const wordsA = descA.split(/\s+/).length
        const wordsB = descB.split(/\s+/).length
        if (wordsA !== wordsB) {
          return wordsB - wordsA
        }

        // Se empatar, preferir a mais antiga (created asc)
        const crA = seedRecA?.getString('created') || ''
        const crB = seedRecB?.getString('created') || ''
        return crA.localeCompare(crB)
      })

      const winnerSeedId = seedIds[0]
      const winnerRecords = bySeed.get(winnerSeedId)
      const winnerFirst = winnerRecords[0]

      // As demais seeds são perdedoras para esse slot
      for (let sIdx = 1; sIdx < seedIds.length; sIdx++) {
        const loserSeedId = seedIds[sIdx]
        const loserRecords = bySeed.get(loserSeedId)
        seedsToDisarm.add(loserSeedId)

        for (const loserRec of loserRecords) {
          duplicatesToDelete.push(loserRec)
          monthsBreakdown.set(ym, (monthsBreakdown.get(ym) || 0) + 1)
          pairsLog.push({
            month: ym,
            keptId: winnerFirst.id,
            keptDesc: winnerFirst.getString('description'),
            keptSeed: winnerSeedId,
            deletedId: loserRec.id,
            deletedDesc: loserRec.getString('description'),
            deletedSeed: loserSeedId,
            reason: `Serie paralela perdedora no mesmo mes (${ym}), conta (${accId}), subcat (${subcatId}), dia (${day})`,
          })
        }
      }
    }

    // Identificar casos avaliados como legítimos para listar no relatório
    // Ex: Apple Fabricio (subcat 16qxubbky7ea17q) vs Apple Raffaela (subcat 9yzonz6s451tv8p)
    // Gympass Matheus (xz3pehfsdr5n47l) vs Gympass Fabricio (2y3y17k2hlpuglw) vs Gympass Raffaela (w0dteyo30thrp8q)
    // Plano Celular Matheus vs Plano Celular Fabricio vs Plano Celular Raffaela
    evaluatedLegitimate.push({
      item: 'Gympass Matheus x Gympass Fabricio x Gympass Raffaela',
      reason:
        'Pessoas diferentes com subcategorias diferentes de benefícios/saúde na mesma conta ev5wboyw8somrnj.',
    })
    evaluatedLegitimate.push({
      item: 'Plano Celular Matheus x Plano Celular Fabricio x Plano Celular Raffaela x Plano Celular Lele',
      reason:
        'Planos individuais de linhas telefônicas de membros diferentes da família em suas respectivas subcategorias.',
    })
    evaluatedLegitimate.push({
      item: 'Apple Fabricio x Apple Raffaela x Apple Matheus',
      reason:
        'Assinaturas de contas Apple ID distintas (Fabricio, Raffaela e Matheus) alocadas em subcategorias individuais.',
    })
    evaluatedLegitimate.push({
      item: 'CDB x CDB Lele x CDB Manu',
      reason: 'Aportes de investimentos distintos para os filhos Lele e Manu e reserva familiar.',
    })
    evaluatedLegitimate.push({
      item: 'Pensão Lele x Pensão Manu',
      reason:
        'Obrigações canônicas mensais individuais de cada filha em contas/subcategorias próprias.',
    })

    console.log(
      `[0068] Total de duplicatas identificadas para exclusão: ${duplicatesToDelete.length}`,
    )
    console.log(`[0068] Total de seeds perdedoras a desarmar: ${seedsToDisarm.size}`)

    // Executar a exclusão de duplicatas identificadas
    const deletedIds = new Set()
    const accountsToRecalculate = new Set()

    for (const rec of duplicatesToDelete) {
      if (deletedIds.has(rec.id)) continue
      const accId = rec.getString('account_id')
      if (accId) accountsToRecalculate.add(accId)

      app.delete(rec)
      deletedIds.add(rec.id)
    }
    console.log(`[0068] Transações deletadas com sucesso: ${deletedIds.size}`)

    // Desarmar as seeds perdedoras para impedir que futuras execuções do gerador recriem as séries
    for (const seedId of seedsToDisarm) {
      const seedRec = recordsById.get(seedId)
      if (seedRec && !deletedIds.has(seedId)) {
        try {
          seedRec.set('is_recurring', false)
          seedRec.set('recurring', false)
          app.save(seedRec)
          console.log(
            `[0068] Semente ${seedId} (${seedRec.getString('description')}) desarmada com is_recurring=false, recurring=false.`,
          )
        } catch (e) {
          console.warn(`[0068] Falha ao desarmar semente ${seedId}:`, e)
        }
      }
    }

    // Recalcular saldo de todas as contas afetadas (ou de todas as contas do sistema para garantia)
    console.log('[0068] Recalculando saldo de todas as contas...')
    const allAccounts = app.findRecordsByFilter('accounts', '1 = 1', '+name', 0, 0)

    for (const acc of allAccounts) {
      const accId = acc.id
      const initialBalance = acc.getFloat('initial_balance') || 0

      // Buscar todas as transações PAGAS dessa conta
      const paidTransactions = app.findRecordsByFilter(
        'transactions',
        `account_id = '${accId}' && paid = true`,
        '+payment_date',
        0,
        0,
      )

      let currentBalance = initialBalance
      for (const tx of paidTransactions) {
        const type = tx.getString('type')
        const amount = tx.getFloat('amount') || 0
        if (type === 'receita') {
          currentBalance += amount
        } else if (type === 'despesa') {
          currentBalance -= amount
        }
      }

      currentBalance = Math.round(currentBalance * 100) / 100
      acc.set('current_balance', currentBalance)
      app.save(acc)
      console.log(
        `[0068] Conta '${acc.getString('name')}' (${accId}): saldo recalculado = R$ ${currentBalance.toFixed(2)} (${paidTransactions.length} txs pagas).`,
      )
    }

    // Registrar resumo detalhado no console
    console.log('[0068] ===== RESUMO DA LIMPEZA MÊS A MÊS =====')
    console.log(`[0068] Total excluído: ${deletedIds.size} ocorrências.`)
    console.log('[0068] Distribuição por mês:')
    const sortedMonths = Array.from(monthsBreakdown.keys()).sort()
    for (const m of sortedMonths) {
      console.log(`[0068]   ${m}: ${monthsBreakdown.get(m)} duplicatas removidas`)
    }

    console.log('[0068] Pares processados (mantido x apagado):')
    for (const p of pairsLog) {
      console.log(
        `[0068]   [${p.month}] MANTIDO: "${p.keptDesc}" (${p.keptId}) | APAGADO: "${p.deletedDesc}" (${p.deletedId}) | MOTIVO: ${p.reason}`,
      )
    }

    console.log('[0068] Migração 0068 concluída com sucesso.')
  },
  (app) => {
    console.log('[0068] Down migration: no-op (limpeza definitiva de duplicatas).')
  },
)
