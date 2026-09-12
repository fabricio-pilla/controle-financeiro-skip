// Migration 0040: Correção de transações com tipo incompatível com a categoria vinculada
// 1. Encontra todas as transações com type='receita' cuja categoria seja 'despesa' (e vice-versa).
// 2. Remapeia para a categoria correspondente correta do mesmo controle financeiro:
//    - "Despesa Fabrício" -> "Receita Fabrício" (e vice-versa)
//    - "Despesa Raffaela" -> "Receita Raffaela" (e vice-versa)
//    - Categoria "Investimento" vinculada a transação incompatível -> remapeia adequadamente.
//    - Preserva a subcategoria se ela já pertencer à nova categoria; caso contrário, busca
//      subcategoria homônima na nova categoria ou fallback para "Outros" / primeira subcategoria.
// 3. Recalcula os saldos das contas afetadas (respeitando regra de não incluir registros-pai).
// 4. Idempotente: se já estiverem corretas, nada é alterado.
migrate(
  (app) => {
    const nowIso = new Date().toISOString()

    function normalizeText(text) {
      if (!text) return ''
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    // Carregar todos os controles financeiros
    let controls = []
    try {
      controls = app.findRecordsByFilter('financial_controls', '', '', 100, 0)
    } catch (e) {
      console.log('[0040] Erro ao buscar controles:', e)
    }

    if (!controls || controls.length === 0) {
      console.log('[0040] Nenhum controle financeiro encontrado.')
      return
    }

    const affectedAccountIds = new Set()

    for (let c = 0; c < controls.length; c++) {
      const control = controls[c]
      const controlId = control.id
      console.log(`[0040] Processando controle: ${control.getString('name')} (${controlId})`)

      // Carregar todas as categorias do controle
      const categories = app.findRecordsByFilter(
        'categories',
        `control_id = '${controlId}'`,
        'name',
        500,
        0,
      )

      const catById = new Map()
      const catByNameNorm = new Map()

      categories.forEach((cat) => {
        catById.set(cat.id, cat)
        const norm = normalizeText(cat.getString('name'))
        catByNameNorm.set(norm, cat)
      })

      // Categorias de receita e despesa mapeadas por convenção
      // Fabrício
      const catRecFabricio =
        catByNameNorm.get('receita fabricio') ||
        categories.find(
          (cat) =>
            cat.getString('type') === 'receita' &&
            normalizeText(cat.getString('name')).includes('fabricio'),
        )
      const catDespFabricio =
        catByNameNorm.get('despesa fabricio') ||
        categories.find(
          (cat) =>
            cat.getString('type') === 'despesa' &&
            normalizeText(cat.getString('name')).includes('fabricio'),
        )

      // Raffaela
      const catRecRaffaela =
        catByNameNorm.get('receita raffaela') ||
        catByNameNorm.get('receita rafaela') ||
        categories.find(
          (cat) =>
            cat.getString('type') === 'receita' &&
            normalizeText(cat.getString('name')).includes('raffaela'),
        )
      const catDespRaffaela =
        catByNameNorm.get('despesa raffaela') ||
        catByNameNorm.get('despesa rafaela') ||
        categories.find(
          (cat) =>
            cat.getString('type') === 'despesa' &&
            normalizeText(cat.getString('name')).includes('raffaela'),
        )

      // Investimento
      const catInvestimento =
        catByNameNorm.get('investimento') || catByNameNorm.get('investimentos')

      // Carregar subcategorias do controle
      const subcategories = app.findRecordsByFilter(
        'subcategories',
        `control_id = '${controlId}'`,
        'name',
        1000,
        0,
      )

      const subById = new Map()
      const subsByCategoryId = new Map()

      subcategories.forEach((sub) => {
        subById.set(sub.id, sub)
        const cId = sub.getString('category_id')
        if (!subsByCategoryId.has(cId)) {
          subsByCategoryId.set(cId, [])
        }
        subsByCategoryId.get(cId).push(sub)
      })

      // Carregar todas as transações do controle
      const transactions = app.findRecordsByFilter(
        'transactions',
        `control_id = '${controlId}'`,
        'date',
        10000,
        0,
      )

      console.log(`[0040] Analisando ${transactions.length} transações no controle ${controlId}...`)

      let fixedCount = 0

      for (let t = 0; t < transactions.length; t++) {
        const tx = transactions[t]
        const txType = tx.getString('type') // 'receita' ou 'despesa'
        const currentCatId = tx.getString('category_id')
        const currentCat = catById.get(currentCatId)

        if (!currentCat) {
          continue
        }

        const catType = currentCat.getString('type') // 'receita' ou 'despesa'
        if (txType === catType) {
          // Tipo compatível, não precisa mexer!
          continue
        }

        const currentCatNorm = normalizeText(currentCat.getString('name'))
        const currentSubId = tx.getString('subcategory_id')
        const currentSub = currentSubId ? subById.get(currentSubId) : null
        const currentSubNorm = currentSub ? normalizeText(currentSub.getString('name')) : ''

        console.log(
          `[0040] Incompatibilidade encontrada: tx ${tx.id} type='${txType}' vinculada a cat '${currentCat.getString('name')}' (${currentCatId}) type='${catType}'. Sub atual: '${currentSub ? currentSub.getString('name') : 'nenhuma'}'.`,
        )

        let targetCat = null

        if (txType === 'receita') {
          // Transação de RECEITA vinculada a categoria de DESPESA
          if (currentCatNorm.includes('fabricio')) {
            targetCat = catRecFabricio
          } else if (currentCatNorm.includes('raffaela') || currentCatNorm.includes('rafaela')) {
            targetCat = catRecRaffaela
          } else if (currentCatNorm.includes('investimento')) {
            // Se categoria atual de despesa for Investimento, procurar categoria de receita apropriada
            // Se houver categoria de receita 'Investimento' usar ela; se não, fallback para Receita Fabrício
            const recInvest = categories.find(
              (c) =>
                c.getString('type') === 'receita' &&
                normalizeText(c.getString('name')).includes('investimento'),
            )
            targetCat = recInvest || catRecFabricio
          } else {
            // Outra categoria de despesa vinculada a receita: fallback para Receita Fabrício ou primeira receita
            targetCat = catRecFabricio || categories.find((c) => c.getString('type') === 'receita')
          }
        } else {
          // Transação de DESPESA vinculada a categoria de RECEITA
          if (currentCatNorm.includes('fabricio')) {
            targetCat = catDespFabricio
          } else if (currentCatNorm.includes('raffaela') || currentCatNorm.includes('rafaela')) {
            targetCat = catDespRaffaela
          } else if (currentCatNorm.includes('investimento')) {
            const despInvest = categories.find(
              (c) =>
                c.getString('type') === 'despesa' &&
                normalizeText(c.getString('name')).includes('investimento'),
            )
            targetCat = despInvest || catDespFabricio
          } else {
            targetCat = catDespFabricio || categories.find((c) => c.getString('type') === 'despesa')
          }
        }

        if (!targetCat) {
          console.log(`[0040] AVISO: Não foi possível determinar targetCat para tx ${tx.id}`)
          continue
        }

        const targetCatId = targetCat.id
        const targetSubs = subsByCategoryId.get(targetCatId) || []

        // Determinar nova subcategoria
        let newSubId = ''

        // 1. Se a subcategoria atual já pertencer à nova categoria
        if (currentSub && currentSub.getString('category_id') === targetCatId) {
          newSubId = currentSub.id
        } else if (currentSubNorm) {
          // 2. Procurar subcategoria com o mesmo nome na nova categoria
          const matchingSub = targetSubs.find(
            (s) => normalizeText(s.getString('name')) === currentSubNorm,
          )
          if (matchingSub) {
            newSubId = matchingSub.id
          }
        }

        // 3. Fallback: procurar subcategoria "Outros" na nova categoria, ou a primeira subcategoria disponível
        if (!newSubId && targetSubs.length > 0) {
          const outrosSub = targetSubs.find((s) => normalizeText(s.getString('name')) === 'outros')
          if (outrosSub) {
            newSubId = outrosSub.id
          } else {
            newSubId = targetSubs[0].id
          }
        }

        // Atualizar transação
        tx.set('category_id', targetCatId)
        if (newSubId) {
          tx.set('subcategory_id', newSubId)
        }
        app.save(tx)

        const accId = tx.getString('account_id')
        if (accId) {
          affectedAccountIds.add(accId)
        }

        fixedCount++
        console.log(
          `[0040] Tx ${tx.id} corrigida com sucesso -> cat: '${targetCat.getString('name')}' (${targetCatId}), subcat: ${newSubId}`,
        )
      }

      console.log(`[0040] Total de transações corrigidas no controle ${controlId}: ${fixedCount}`)
    }

    // Recalcular saldo de todas as contas afetadas (ou de todas as contas dos controles)
    // Regra:
    // NUNCA incluir registros pai (installment_number = 0 && installment_total > 0)
    // Se type === 'credito': saldo = sum(despesa) - sum(receita)
    // Se type !== 'credito': saldo = sum(receita) - sum(despesa)
    console.log(
      `[0040] Recalculando saldo de contas afetadas (${affectedAccountIds.size} contas)...`,
    )

    for (let c = 0; c < controls.length; c++) {
      const controlId = controls[c].id
      const accounts = app.findRecordsByFilter(
        'accounts',
        `control_id = '${controlId}'`,
        'created',
        100,
        0,
      )

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
          .newQuery(
            'UPDATE accounts SET balance = {:balance}, updated = {:updated} WHERE id = {:id}',
          )
          .bind({
            id: accId,
            balance: calcBalance,
            updated: nowIso,
          })
          .execute()

        console.log(
          `[0040] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
        )
      }
    }
  },
  (app) => {
    // Reversão não é necessária pois trata-se de correção de integridade de dados.
  },
)
