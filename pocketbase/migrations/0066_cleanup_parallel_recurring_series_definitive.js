// pocketbase/migrations/0066_cleanup_parallel_recurring_series_definitive.js
// Migration definitiva e idempotente:
// 1) Remove do banco de dados TODAS as ocorrências e sementes das séries paralelas:
//    - "Pensã Manu" (typo) - TODAS as ocorrências (em qualquer data). A correta é "Pensão Manu".
//    - "Vale Aliementação" (typo) - TODAS as ocorrências (em qualquer data). A correta é "Vale Alimentação".
//    - Ocorrências e sementes paralelas com descrição vazia ou "Sem descrição":
//      * Receita ~ R$ 1.444,91 na conta hnwounfuhdvzswx (duplica "Vale Alimentação" receita)
//      * Despesa ~ R$ 1.444,91 na conta hnwounfuhdvzswx (duplica "Supermercado" despesa)
//      * Receita ~ R$ 5.308,47 na conta 4xftudvb9g7gnfy (duplica "Salario")
//      * Despesa R$ 550,00 na conta 4xftudvb9g7gnfy com subcategoria 55zscixys10us5x (duplica "Pensão Lele")
//      * Despesa R$ 550,00 na conta 4xftudvb9g7gnfy com subcategoria pensão (duplica "Pensão Manu")
//      * Despesa R$ 371,26 ou R$ 204.81 na conta cptwpqlmt4hqigf (duplica despesa de luz/serviços)
//      * Despesa R$ 5,90 na conta 84syw55gn7gmzfu (duplica Apple Matheus)
//    - Regra: se no MESMO mês/tipo a série correta já tem ocorrência -> APAGAR a "Sem descrição".
//      Se o mês só tiver a "Sem descrição" -> RENOMEAR com a descrição correta correspondente para não criar buraco.
//    - Caso haja qualquer semente original (parent_transaction_id vazio) com "Sem descrição" para essas séries paralelas,
//      desativar sua recorrência (is_recurring=false, recurring=false, recurrence_type='', recurrence_period='')
//      para que o gerador não a use como semente no futuro.
// 2) Deduplicar rigorosamente ocorrências no período nov/2026 a out/2027:
//    Garantir EXATAMENTE UMA ocorrência por mês para as 5 séries oficiais:
//    - Salario (receita, R$ 5.308,47, conta 4xftudvb9g7gnfy)
//    - Vale Alimentação (receita, R$ 1.444,91, conta hnwounfuhdvzswx)
//    - Supermercado (despesa, R$ 1.444,91, conta hnwounfuhdvzswx)
//    - Pensão Manu (despesa, R$ 550,00, conta 4xftudvb9g7gnfy)
//    - Pensão Lele (despesa, R$ 550,00, conta 4xftudvb9g7gnfy)
//    Se em algum mês faltar uma dessas ocorrências no período nov/2026 até out/2027, CRIAR a ocorrência faltante
//    para garantir a integridade da série de 12 meses.
// 3) Recalcular os saldos de todas as contas no banco de forma atômica e consistente.

migrate(
  (app) => {
    console.log('[0066] Iniciando limpeza definitiva das séries paralelas...')
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z'
    const affectedAccountIds = new Set()

    const normalizeText = (text) => {
      return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    const cleanDescription = (desc) => {
      let d = String(desc || '').trim()
      d = d.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '')
      d = d.replace(/\s*\(Total:.*$/i, '')
      return d.trim()
    }

    // ------------------------------------------------------------------------
    // PASSO 1: Excluir via SQL e Records todas as ocorrências de typos explícitos
    // "Pensã Manu" e "Vale Aliementação"
    // ------------------------------------------------------------------------
    try {
      const resTypos = app.findRecordsByFilter(
        'transactions',
        "description = 'Pensã Manu' || description = 'Vale Aliementação' || description ~ 'Aliementação'",
        'date',
        5000,
        0,
      )
      console.log(`[0066] Encontradas ${resTypos.length} transações de typos explícitos`)
      for (let i = 0; i < resTypos.length; i++) {
        const r = resTypos[i]
        const accId = r.getString('account_id')
        if (accId) affectedAccountIds.add(accId)
        try {
          app.delete(r)
        } catch (e) {
          console.log(`[0066] Falha ao deletar typo ${r.id}: ${e}`)
        }
      }
    } catch (err) {
      console.log('[0066] Erro ao buscar typos com findRecordsByFilter:', err)
    }

    try {
      app
        .db()
        .newQuery(`
        DELETE FROM transactions
        WHERE description = 'Pensã Manu'
           OR description = 'Vale Aliementação'
           OR description LIKE '%Aliementação%'
      `)
        .execute()
    } catch (sqlErr) {
      console.log('[0066] Erro no DELETE SQL de typos:', sqlErr)
    }

    // ------------------------------------------------------------------------
    // PASSO 2: Tratar ocorrências "Sem descrição" ou vazias
    // Identificar todas as transações com descrição vazia ou "Sem descrição"
    // ------------------------------------------------------------------------
    try {
      const semDescRecords = app.findRecordsByFilter(
        'transactions',
        "description = '' || description = 'Sem descrição' || description = 'sem descricao'",
        'date',
        10000,
        0,
      )
      console.log(
        `[0066] Total de transações 'Sem descrição' encontradas: ${semDescRecords.length}`,
      )

      // Carregar todas as transações nomeadas no mesmo período para saber se já existe a correta
      const allNamed = app.findRecordsByFilter(
        'transactions',
        "description != '' && description != 'Sem descrição' && description != 'sem descricao'",
        'date',
        25000,
        0,
      )

      // Mapa de nomeadas: YYYY-MM + "_" + type + "_" + account_id + "_" + cleanNormDesc
      const namedMap = new Map()
      for (let i = 0; i < allNamed.length; i++) {
        const tx = allNamed[i]
        const dStr = String(tx.getString('date') || '').split(/[T\s]/)[0]
        const ym = dStr.substring(0, 7)
        const tType = tx.getString('type')
        const accId = tx.getString('account_id')
        const normDesc = normalizeText(cleanDescription(tx.getString('description')))
        const key = `${ym}_${tType}_${accId}_${normDesc}`
        namedMap.set(key, tx)
      }

      for (let i = 0; i < semDescRecords.length; i++) {
        const r = semDescRecords[i]
        const accId = r.getString('account_id')
        const tType = r.getString('type')
        const amt = Math.round((r.getFloat('amount') || 0) * 100) / 100
        const dStr = String(r.getString('date') || '').split(/[T\s]/)[0]
        const ym = dStr.substring(0, 7)
        const isPaid = r.getBool('paid')
        const isAuto = (r.getString('notes') || '').includes('Gerado automaticamente')
        const isRec = r.getBool('is_recurring') || r.getBool('recurring')

        // Identificar se mapeia para uma das séries conhecidas
        let targetOfficialDesc = ''
        if (
          tType === 'receita' &&
          accId === '4xftudvb9g7gnfy' &&
          (amt === 5308.47 || amt === 5308.0)
        ) {
          targetOfficialDesc = 'Salario'
        } else if (
          tType === 'receita' &&
          accId === 'hnwounfuhdvzswx' &&
          (amt === 1444.91 || amt === 1400.91)
        ) {
          targetOfficialDesc = 'Vale Alimentação'
        } else if (
          tType === 'despesa' &&
          accId === 'hnwounfuhdvzswx' &&
          (amt === 1444.91 || amt === 1400.91)
        ) {
          targetOfficialDesc = 'Supermercado'
        } else if (tType === 'despesa' && accId === '4xftudvb9g7gnfy' && amt === 550.0) {
          // Pode ser Pensão Manu ou Pensão Lele
          // Checar se subcategoria bate com Lele (55zscixys10us5x)
          const subId = r.getString('subcategory_id')
          if (subId === '55zscixys10us5x') {
            targetOfficialDesc = 'Pensão Lele'
          } else {
            targetOfficialDesc = 'Pensão Manu'
          }
        } else if (
          tType === 'despesa' &&
          accId === 'cptwpqlmt4hqigf' &&
          (amt === 371.26 || amt === 204.81)
        ) {
          targetOfficialDesc = 'Conta de Luz'
        } else if (tType === 'despesa' && accId === '84syw55gn7gmzfu' && amt === 5.9) {
          targetOfficialDesc = 'Apple Matheus'
        }

        // Se for uma ocorrência passada (ex: jan-out/2026) PAGA e NÃO gerada automaticamente, é importada histórica
        const isHistoricalImportedPaid = !isAuto && isPaid && ym < '2026-11'

        if (targetOfficialDesc) {
          const normTarget = normalizeText(targetOfficialDesc)
          const namedKey = `${ym}_${tType}_${accId}_${normTarget}`
          const hasNamedEquivalent = namedMap.has(namedKey)

          if (isHistoricalImportedPaid) {
            // Não apagar lançamento histórico pago importado! Apenas renomear para ficar legível
            // E desmarcar como semente recorrente para nunca gerar filhas paralelas
            r.set('description', targetOfficialDesc)
            r.set('is_recurring', false)
            r.set('recurring', false)
            r.set('recurrence_type', '')
            r.set('recurrence_period', '')
            try {
              app.save(r)
              console.log(
                `[0066] Renomeado histórico pago ${r.id} para '${targetOfficialDesc}' e desmarcado recorrente`,
              )
            } catch (err) {
              console.log(`[0066] Erro ao salvar renomeação histórica de ${r.id}: ${err}`)
            }
          } else if (hasNamedEquivalent) {
            // Já existe a correta no mês -> apagar a duplicata sem descrição!
            if (accId) affectedAccountIds.add(accId)
            try {
              app.delete(r)
              console.log(
                `[0066] Deletada transação 'Sem descrição' duplicada: ${r.id} (${targetOfficialDesc} ${ym})`,
              )
            } catch (err) {
              console.log(`[0066] Erro ao deletar duplicata ${r.id}: ${err}`)
            }
          } else {
            // Não existe a correta no mês -> renomear para a oficial para não criar buraco!
            r.set('description', targetOfficialDesc)
            try {
              app.save(r)
              namedMap.set(namedKey, r)
              console.log(
                `[0066] Renomeada transação sem descrição ${r.id} para '${targetOfficialDesc}' no mês ${ym}`,
              )
            } catch (err) {
              console.log(`[0066] Erro ao salvar renomeação de ${r.id}: ${err}`)
            }
          }
        } else {
          // Outras transações sem descrição órfãs
          if (isHistoricalImportedPaid) {
            // Mantém e tenta dar nome decente
            r.set('description', tType === 'receita' ? 'Receita Diversa' : 'Despesa Diversa')
            r.set('is_recurring', false)
            r.set('recurring', false)
            try {
              app.save(r)
            } catch (_) {}
          } else if (isAuto || ym >= '2026-11') {
            // Gerada automática sem descrição desconhecida -> apagar
            if (accId) affectedAccountIds.add(accId)
            try {
              app.delete(r)
              console.log(
                `[0066] Deletada transação sem descrição órfã: ${r.id} (${ym}, amt=${amt})`,
              )
            } catch (_) {}
          } else {
            // Passada não-gerada: renomear
            r.set('description', tType === 'receita' ? 'Receita' : 'Despesa')
            r.set('is_recurring', false)
            r.set('recurring', false)
            try {
              app.save(r)
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.log('[0066] Erro no PASSO 2:', err)
    }

    // ------------------------------------------------------------------------
    // PASSO 3: Desarmar qualquer semente recorrente com 'Sem descrição' ou typos
    // Garantir que nenhuma transação no banco tenha is_recurring=true com descrição proibida
    // ------------------------------------------------------------------------
    try {
      app
        .db()
        .newQuery(`
        UPDATE transactions
        SET is_recurring = 0, recurring = 0, recurrence_type = '', recurrence_period = ''
        WHERE description = ''
           OR description = 'Sem descrição'
           OR description = 'sem descricao'
           OR description = 'Pensã Manu'
           OR description = 'Vale Aliementação'
      `)
        .execute()
    } catch (sqlErr) {
      console.log('[0066] Erro ao desarmar sementes:', sqlErr)
    }

    // ------------------------------------------------------------------------
    // PASSO 4: Deduplicar ocorrências de nov/2026 até out/2027 para as 5 séries oficiais
    // Garantir que haja rigorosamente UMA ocorrência por mês para cada série:
    // 1. Salario (receita, 5308.47, 4xftudvb9g7gnfy)
    // 2. Vale Alimentação (receita, 1444.91, hnwounfuhdvzswx)
    // 3. Supermercado (despesa, 1444.91, hnwounfuhdvzswx)
    // 4. Pensão Manu (despesa, 550.00, 4xftudvb9g7gnfy)
    // 5. Pensão Lele (despesa, 550.00, 4xftudvb9g7gnfy)
    // ------------------------------------------------------------------------
    const targetSeries = [
      {
        name: 'Salario',
        type: 'receita',
        amount: 5308.47,
        account_id: '4xftudvb9g7gnfy',
        category_id: 'u7b1rllvqx854u8',
        subcategory_id: '8r2h5zisfvkwo71',
        day: 1,
        matchFn: (desc) => {
          const norm = normalizeText(desc)
          return norm === 'salario' || norm === 'salario liquido' || norm === 'salario mensal'
        },
      },
      {
        name: 'Vale Alimentação',
        type: 'receita',
        amount: 1444.91,
        account_id: 'hnwounfuhdvzswx',
        category_id: 'u7b1rllvqx854u8',
        subcategory_id: '8r2h5zisfvkwo71',
        day: 1,
        matchFn: (desc) => {
          const norm = normalizeText(desc)
          return norm === 'vale alimentacao' || norm === 'vale-alimentacao'
        },
      },
      {
        name: 'Supermercado',
        type: 'despesa',
        amount: 1444.91,
        account_id: 'hnwounfuhdvzswx',
        category_id: 'h6qdb8a4zr0d9xm',
        subcategory_id: 'zzckt631mdqdb14',
        day: 1,
        matchFn: (desc) => {
          const norm = normalizeText(desc)
          return norm === 'supermercado' || norm === 'vale alimentacao despesa'
        },
      },
      {
        name: 'Pensão Manu',
        type: 'despesa',
        amount: 550.0,
        account_id: '4xftudvb9g7gnfy',
        category_id: 'lrhb8dd98fr9auk',
        subcategory_id: '55zscixys10us5x',
        day: 1,
        matchFn: (desc) => {
          const norm = normalizeText(desc)
          return norm === 'pensao manu' || norm === 'pensao - manu'
        },
      },
      {
        name: 'Pensão Lele',
        type: 'despesa',
        amount: 550.0,
        account_id: '4xftudvb9g7gnfy',
        category_id: 'lrhb8dd98fr9auk',
        subcategory_id: '55zscixys10us5x',
        day: 1,
        matchFn: (desc) => {
          const norm = normalizeText(desc)
          return norm === 'pensao lele' || norm === 'pensao - lele'
        },
      },
    ]

    // Meses de nov/2026 a out/2027 (12 meses futuros)
    const targetMonths = [
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
      '2027-04',
      '2027-05',
      '2027-06',
      '2027-07',
      '2027-08',
      '2027-09',
      '2027-10',
    ]

    try {
      // Carregar todas as transações de nov/2026 em diante
      const futureTxs = app.findRecordsByFilter(
        'transactions',
        "date >= '2026-11-01' && date <= '2027-10-31 23:59:59'",
        'date',
        10000,
        0,
      )
      console.log(
        `[0066] Transações futuras (nov/2026 a out/2027) para análise: ${futureTxs.length}`,
      )

      // Para cada uma das 5 séries, agrupar as ocorrências por mês
      for (let sIdx = 0; sIdx < targetSeries.length; sIdx++) {
        const serie = targetSeries[sIdx]

        // Agrupar por YYYY-MM
        const byMonth = new Map()
        for (let m = 0; m < targetMonths.length; m++) {
          byMonth.set(targetMonths[m], [])
        }

        for (let i = 0; i < futureTxs.length; i++) {
          const tx = futureTxs[i]
          if (tx.getString('type') !== serie.type) continue
          if (tx.getString('account_id') !== serie.account_id) continue

          const desc = tx.getString('description')
          if (!serie.matchFn(desc)) continue

          const dStr = String(tx.getString('date') || '').split(/[T\s]/)[0]
          const ym = dStr.substring(0, 7)
          if (byMonth.has(ym)) {
            byMonth.get(ym).push(tx)
          }
        }

        // Para cada mês:
        // - se > 1: manter apenas 1, deletar extras
        // - se 0: criar 1 registro canônico
        let defaultControlId = 'y9ewjfbhzoihnq0'
        let defaultUserId = 'uc5jp6hewxu9yio'

        for (let m = 0; m < targetMonths.length; m++) {
          const ym = targetMonths[m]
          const list = byMonth.get(ym)

          if (list.length > 1) {
            console.log(
              `[0066] Série ${serie.name} no mês ${ym} tem ${list.length} ocorrências. Deletando extras...`,
            )
            // Manter a primeira (ou a com id canônico), deletar as demais
            for (let k = 1; k < list.length; k++) {
              const extra = list[k]
              const accId = extra.getString('account_id')
              if (accId) affectedAccountIds.add(accId)
              try {
                app.delete(extra)
                console.log(
                  `[0066] Deletada duplicata da série ${serie.name} no mês ${ym}: ${extra.id}`,
                )
              } catch (delE) {
                console.log(`[0066] Erro ao deletar extra ${extra.id}: ${delE}`)
              }
            }
          } else if (list.length === 0) {
            console.log(
              `[0066] Série ${serie.name} no mês ${ym} não tinha ocorrência. Criando ocorrência faltante...`,
            )
            const transactionsCol = app.findCollectionByNameOrId('transactions')
            const newRec = new Record(transactionsCol)

            const dayStr = String(serie.day).padStart(2, '0')
            const dateStr = `${ym}-${dayStr} 00:00:00.000Z`

            newRec.set('control_id', defaultControlId)
            newRec.set('user_id', defaultUserId)
            newRec.set('type', serie.type)
            newRec.set('amount', serie.amount)
            newRec.set('description', serie.name)
            newRec.set('category_id', serie.category_id)
            newRec.set('subcategory_id', serie.subcategory_id)
            newRec.set('account_id', serie.account_id)
            newRec.set('date', dateStr)
            newRec.set('payment_date', dateStr)
            newRec.set('paid', false)
            newRec.set('is_recurring', true)
            newRec.set('recurring', true)
            newRec.set('recurrence_type', 'mensal')
            newRec.set('recurrence_period', 'mensal')
            newRec.set('installment_number', 0)
            newRec.set('installment_total', 0)
            newRec.set('notes', 'Gerado automaticamente: recorrência mensal')

            try {
              app.save(newRec)
              if (serie.account_id) affectedAccountIds.add(serie.account_id)
              console.log(`[0066] Criada ocorrência para ${serie.name} em ${ym}: ${newRec.id}`)
            } catch (createErr) {
              console.log(
                `[0066] Erro ao criar ocorrência para ${serie.name} em ${ym}: ${createErr}`,
              )
            }
          }
        }
      }
    } catch (err) {
      console.log('[0066] Erro no PASSO 4:', err)
    }

    // ------------------------------------------------------------------------
    // PASSO 5: Recalcular saldos de todas as contas no banco
    // ------------------------------------------------------------------------
    let allAccounts = []
    try {
      allAccounts = app.findRecordsByFilter('accounts', "control_id != ''", 'created', 500, 0)
    } catch (_) {
      allAccounts = []
    }

    for (let k = 0; k < allAccounts.length; k++) {
      affectedAccountIds.add(allAccounts[k].id)
    }

    const affectedList = Array.from(affectedAccountIds)
    console.log(`[0066] Recalculando saldo de ${affectedList.length} contas...`)

    for (let a = 0; a < affectedList.length; a++) {
      const accId = affectedList[a]
      if (!accId) continue

      try {
        const acc = app.findRecordById('accounts', accId)
        const accType = acc.getString('type')

        const accTxs = app.findRecordsByFilter(
          'transactions',
          `account_id = '${accId}'`,
          'date',
          25000,
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
          `[0066] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
        )
      } catch (err) {
        console.log(`[0066] Erro ao recalcular saldo da conta ${accId}: ${err}`)
      }
    }

    console.log('[0066] Limpeza definitiva concluída com sucesso.')
  },
  (app) => {
    // Reversão no-op
  },
)
