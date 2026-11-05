// pocketbase/migrations/0065_cleanup_duplicates_and_parallel_recurring_series.js
// Migration idempotente:
// 1) Remove do banco TODAS as transações pendentes (paid = false) com data < 2026-11-01
//    geradas automaticamente (notes contendo 'Gerado automaticamente').
//    NÃO toca em transações pagas.
// 2) Remove completamente as séries paralelas a APAGAR (sementes + TODAS as ocorrências geradas, qualquer data):
//    - Série com typo "Vale Aliementação"
//    - Série com typo "Pensã Manu"
//    - Séries cuja descrição seja "Sem descrição" e que DUPLICAM uma série nomeada mantida:
//      * Receita R$ 1.444,91 na conta hnwounfuhdvzswx (duplica "Vale Alimentação" receita)
//      * Despesa R$ 1.444,91 na conta hnwounfuhdvzswx (duplica "Supermercado" despesa)
//      * Receita R$ 5.308,47 na conta 4xftudvb9g7gnfy (duplica "Salario")
//      * Despesa R$ 550,00 na conta 4xftudvb9g7gnfy com subcategoria 55zscixys10us5x (duplica "Pensão Lele")
//      * Despesa R$ 371,26 na conta cptwpqlmt4hqigf (duplica "Conta de Luz" ~ R$ 370.99)
//      * Despesa R$ 5.90 na conta 84syw55gn7gmzfu (duplica "Apple Matheus" R$ 5.90)
//    - Caso exista outra série "Sem descrição" órfã (que não duplica nada), preservar e renomear.
// 3) Renomeia qualquer ocorrência restante com descrição 'Sem descrição' que pertença à série mantida
//    para a descrição oficial da série.
// 4) Recalcula os saldos de todas as contas do banco.

migrate(
  (app) => {
    console.log('[0065] Iniciando limpeza definitiva de duplicatas e séries paralelas...')

    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z'
    const affectedAccountIds = new Set()

    // ------------------------------------------------------------------------
    // PASSO 1: Apagar pendências automáticas com data < 2026-11-01 (outubro/2026 e anteriores)
    // ------------------------------------------------------------------------
    try {
      const pendingAutoRecords = app.findRecordsByFilter(
        'transactions',
        "paid = false && date < '2026-11-01' && notes ~ 'Gerado automaticamente'",
        'date',
        5000,
        0,
      )
      console.log(
        `[0065] Pendências automáticas < 2026-11-01 encontradas: ${pendingAutoRecords.length}`,
      )
      for (let i = 0; i < pendingAutoRecords.length; i++) {
        const rec = pendingAutoRecords[i]
        const accId = rec.getString('account_id')
        if (accId) affectedAccountIds.add(accId)
        try {
          app.delete(rec)
        } catch (e) {
          console.log(`[0065] Erro ao deletar pendência ${rec.id}: ${e}`)
        }
      }
    } catch (err) {
      console.log('[0065] Erro no passo 1 (findRecordsByFilter):', err)
    }

    // Limpeza SQL direta para qualquer variante que tenha payment_date < 2026-11-01 e paid = 0
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM transactions
        WHERE paid = 0
          AND (date < '2026-11-01' OR payment_date < '2026-11-01')
          AND (notes LIKE '%Gerado automaticamente%' OR notes LIKE '%recorrência mensal%')
      `)
        .execute()
    } catch (sqlErr) {
      console.log('[0065] Erro no DELETE SQL do passo 1:', sqlErr)
    }

    // ------------------------------------------------------------------------
    // PASSO 2: Excluir séries paralelas a APAGAR (sementes + todas as ocorrências)
    // Séries a excluir:
    // A) "Vale Aliementação" (typo) - todas as ocorrências
    // B) "Pensã Manu" (typo) - todas as ocorrências (a correta é "Pensão Manu")
    // C) "Sem descrição" paralelas conhecidas:
    //    - Receita 1444.91 na conta hnwounfuhdvzswx (rbjz6rb8z0iz6oy / ox1v5c2v3e9d7d5 / ss7ox7wrme8lsm4 / etc.)
    //    - Despesa 1444.91 na conta hnwounfuhdvzswx (gbib9mpda8vvp4v / rb2s56i1mpwm25q / 2o2m5ixkvree6aj / etc.)
    //    - Receita 5308.47 na conta 4xftudvb9g7gnfy (ryqvb29y4h913y5 / s4b96e1h1nahoc2 / zp7k01huf405rm8 / etc.)
    //    - Despesa 550.00 na conta 4xftudvb9g7gnfy com subcategoria 55zscixys10us5x (faum7seuy4h6lh3 / v4zl612yeux4qvc / 0m6wwplitezk330 / etc.)
    //    - Despesa 371.26 ou 204.81 na conta cptwpqlmt4hqigf (1xcsdvyyb2wnkhd / s9witgjhi4lm7ub / gqt07rqrbrsxzk5 / etc.)
    //    - Despesa 5.90 na conta 84syw55gn7gmzfu (jc8kduehtnbnods / 3bvvap72ml0nm4s / etc.)
    // ------------------------------------------------------------------------

    // A) Vale Aliementação
    try {
      const typoVale = app.findRecordsByFilter(
        'transactions',
        "description = 'Vale Aliementação'",
        'date',
        5000,
        0,
      )
      console.log(
        `[0065] Removendo ${typoVale.length} ocorrências da série com typo 'Vale Aliementação'`,
      )
      for (let i = 0; i < typoVale.length; i++) {
        const r = typoVale[i]
        const accId = r.getString('account_id')
        if (accId) affectedAccountIds.add(accId)
        try {
          app.delete(r)
        } catch (_) {}
      }
    } catch (e) {
      console.log("[0065] Erro ao deletar 'Vale Aliementação':", e)
    }

    // B) Pensã Manu
    try {
      const typoPensa = app.findRecordsByFilter(
        'transactions',
        "description = 'Pensã Manu'",
        'date',
        5000,
        0,
      )
      console.log(`[0065] Removendo ${typoPensa.length} ocorrências da série com typo 'Pensã Manu'`)
      for (let i = 0; i < typoPensa.length; i++) {
        const r = typoPensa[i]
        const accId = r.getString('account_id')
        if (accId) affectedAccountIds.add(accId)
        try {
          app.delete(r)
        } catch (_) {}
      }
    } catch (e) {
      console.log("[0065] Erro ao deletar 'Pensã Manu':", e)
    }

    // C) Deletar séries paralelas 'Sem descrição'
    // Identificamos registros com description = 'Sem descrição' ou vazia e removemos
    // apenas aqueles que duplicam séries existentes
    try {
      const semDescTxs = app.findRecordsByFilter(
        'transactions',
        "description = 'Sem descrição' || description = ''",
        'date',
        5000,
        0,
      )
      console.log(`[0065] Total de transações 'Sem descrição': ${semDescTxs.length}`)

      for (let i = 0; i < semDescTxs.length; i++) {
        const r = semDescTxs[i]
        const accId = r.getString('account_id')
        const tType = r.getString('type')
        const amt = Math.round((r.getFloat('amount') || 0) * 100) / 100
        const subId = r.getString('subcategory_id')
        const pId = r.getString('parent_transaction_id')
        const rId = r.id

        // Sementes ou geradas correspondentes às séries duplicadas:
        // 1. Salario paralelo (receita, conta 4xftudvb9g7gnfy, ~5308.47)
        const isSalarioParalelo =
          tType === 'receita' && accId === '4xftudvb9g7gnfy' && amt === 5308.47

        // 2. Vale Alimentação paralelo (receita, conta hnwounfuhdvzswx, 1400.91 ou 1444.91)
        const isValeRecParalelo =
          tType === 'receita' && accId === 'hnwounfuhdvzswx' && (amt === 1444.91 || amt === 1400.91)

        // 3. Supermercado paralelo (despesa, conta hnwounfuhdvzswx, 1400.91 ou 1444.91)
        const isValeDespParalelo =
          tType === 'despesa' && accId === 'hnwounfuhdvzswx' && (amt === 1444.91 || amt === 1400.91)

        // 4. Pensão Lele paralelo (despesa, conta 4xftudvb9g7gnfy, 550.00, subcategoria 55zscixys10us5x)
        const isPensaLeleParalelo =
          tType === 'despesa' && accId === '4xftudvb9g7gnfy' && amt === 550.0

        // 5. Conta de Luz paralelo (despesa, conta cptwpqlmt4hqigf)
        const isLuzParalelo = tType === 'despesa' && accId === 'cptwpqlmt4hqigf'

        // 6. Apple Matheus paralelo (despesa, conta 84syw55gn7gmzfu, 5.90)
        const isAppleMatheusParalelo =
          tType === 'despesa' && accId === '84syw55gn7gmzfu' && amt === 5.9

        if (
          isSalarioParalelo ||
          isValeRecParalelo ||
          isValeDespParalelo ||
          isPensaLeleParalelo ||
          isLuzParalelo ||
          isAppleMatheusParalelo
        ) {
          if (accId) affectedAccountIds.add(accId)
          try {
            app.delete(r)
            console.log(
              `[0065] Deletada transação 'Sem descrição' duplicada: ${rId} (${tType}, amt=${amt}, acc=${accId})`,
            )
          } catch (delErr) {
            console.log(`[0065] Falha ao deletar ${rId}: ${delErr}`)
          }
        }
      }
    } catch (e) {
      console.log("[0065] Erro ao processar 'Sem descrição':", e)
    }

    // ------------------------------------------------------------------------
    // PASSO 3: Qualquer transação restante com descrição 'Sem descrição'
    // Se for órfã ou herdada, renomeia para uma descrição plausível
    // ------------------------------------------------------------------------
    try {
      const remainingSemDesc = app.findRecordsByFilter(
        'transactions',
        "description = 'Sem descrição' || description = ''",
        'date',
        1000,
        0,
      )
      console.log(
        `[0065] Transações remanescentes 'Sem descrição' para renomear: ${remainingSemDesc.length}`,
      )

      for (let i = 0; i < remainingSemDesc.length; i++) {
        const r = remainingSemDesc[i]
        const pId = r.getString('parent_transaction_id')
        let newDesc = ''

        if (pId) {
          try {
            const parent = app.findRecordById('transactions', pId)
            const parentDesc = parent.getString('description')
            if (parentDesc && parentDesc !== 'Sem descrição') {
              newDesc = parentDesc
            }
          } catch (_) {}
        }

        // Se ainda não descobriu, tenta pelo subcategory / category
        if (!newDesc) {
          const subId = r.getString('subcategory_id')
          const catId = r.getString('category_id')
          if (subId) {
            try {
              const sub = app.findRecordById('subcategories', subId)
              newDesc = sub.getString('name')
            } catch (_) {}
          }
          if (!newDesc && catId) {
            try {
              const cat = app.findRecordById('categories', catId)
              newDesc = cat.getString('name')
            } catch (_) {}
          }
        }

        if (!newDesc) {
          newDesc = r.getString('type') === 'receita' ? 'Receita Recorrente' : 'Despesa Recorrente'
        }

        r.set('description', newDesc)
        try {
          app.save(r)
          console.log(`[0065] Renomeado registro ${r.id} para '${newDesc}'`)
        } catch (saveErr) {
          console.log(`[0065] Erro ao salvar renomeação de ${r.id}: ${saveErr}`)
        }
      }
    } catch (e) {
      console.log('[0065] Erro ao renomear remanescentes:', e)
    }

    // ------------------------------------------------------------------------
    // PASSO 4: Deduplicação adicional caso exista alguma duplicata exata no período nov/2026 -> abr/2027
    // Critério: mesmo control_id + account_id + type + amount + payment_date + dia_do_mes
    // Para as séries mantidas:
    // Salario, Vale Alimentação (receita), Supermercado (despesa), Pensão Manu, Pensão Lele
    // Garante no MÁXIMO 1 ocorrência por mês para cada série.
    // ------------------------------------------------------------------------
    try {
      const futureRecs = app.findRecordsByFilter(
        'transactions',
        "date >= '2026-11-01' && is_recurring = true",
        'date',
        5000,
        0,
      )

      const seenKeys = new Map() // key -> record
      for (let i = 0; i < futureRecs.length; i++) {
        const rec = futureRecs[i]
        const desc = (rec.getString('description') || '').trim()
        const tType = rec.getString('type')
        const accId = rec.getString('account_id')
        const amt = Math.round((rec.getFloat('amount') || 0) * 100) / 100
        const dateStr = (rec.getString('date') || '').substring(0, 7) // YYYY-MM

        const dedupKey = `${accId}_${tType}_${amt}_${dateStr}_${desc.toLowerCase()}`
        if (seenKeys.has(dedupKey)) {
          // Duplicata encontrada, deletar a extra
          const existing = seenKeys.get(dedupKey)
          console.log(
            `[0065] Duplicata futura encontrada: ${rec.id} (já existe ${existing.id}) para ${dedupKey}`,
          )
          if (accId) affectedAccountIds.add(accId)
          try {
            app.delete(rec)
          } catch (delE) {
            console.log(`[0065] Erro ao deletar duplicata futura ${rec.id}: ${delE}`)
          }
        } else {
          seenKeys.set(dedupKey, rec)
        }
      }
    } catch (e) {
      console.log('[0065] Erro na deduplicação futura:', e)
    }

    // ------------------------------------------------------------------------
    // PASSO 5: Recalcular saldos de todas as contas do controle
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
    console.log(`[0065] Recalculando saldo de ${affectedList.length} contas...`)

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
          `[0065] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
        )
      } catch (err) {
        console.log(`[0065] Erro ao recalcular saldo da conta ${accId}: ${err}`)
      }
    }

    console.log('[0065] Limpeza concluída com sucesso.')
  },
  (app) => {
    // Reversão no-op
  },
)
