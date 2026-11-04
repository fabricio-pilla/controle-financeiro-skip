// pocketbase/migrations/0058_purge_duplicate_recurring_salaro_conta_de_agua.js
// Remoção definitiva e completa das séries duplicadas "Salaro" e "Conta de Agua",
// incluindo sementes (r971jxnob9k2e6v, ay4r716ds7i6j3g) e todas as suas ocorrências filhas.
// Preserva intactas as séries originais "Salario" e "Agua", além de "Vale Alimentação".
// Recalcula e sincroniza saldos das contas impactadas.

migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()
    const affectedAccountIds = new Set()

    console.log('[0058] Iniciando expurgo definitivo de Salaro e Conta de Agua...')

    // 1. Usar app.findRecordsByFilter para coletar contas afetadas e dados para log
    try {
      const salaroTxs = app.findRecordsByFilter(
        'transactions',
        `description = 'Salaro' || parent_transaction_id = 'r971jxnob9k2e6v' || id = 'r971jxnob9k2e6v'`,
        'created',
        1000,
        0,
      )
      console.log(`[0058] Encontrados ${salaroTxs.length} registros para Salaro.`)
      for (let i = 0; i < salaroTxs.length; i++) {
        const accId = salaroTxs[i].getString('account_id')
        if (accId) affectedAccountIds.add(accId)
      }
    } catch (e) {
      console.log('[0058] Aviso ao listar Salaro:', e)
    }

    try {
      const contaAguaTxs = app.findRecordsByFilter(
        'transactions',
        `description = 'Conta de Agua' || parent_transaction_id = 'ay4r716ds7i6j3g' || id = 'ay4r716ds7i6j3g'`,
        'created',
        1000,
        0,
      )
      console.log(`[0058] Encontrados ${contaAguaTxs.length} registros para Conta de Agua.`)
      for (let i = 0; i < contaAguaTxs.length; i++) {
        const accId = contaAguaTxs[i].getString('account_id')
        if (accId) affectedAccountIds.add(accId)
      }
    } catch (e) {
      console.log('[0058] Aviso ao listar Conta de Agua:', e)
    }

    // 2. Executar deleção via raw SQL execute() — deleta em lote sem disparar hooks JSVM
    app
      .db()
      .newQuery(`
      DELETE FROM transactions
      WHERE description = 'Salaro'
         OR parent_transaction_id = 'r971jxnob9k2e6v'
         OR id = 'r971jxnob9k2e6v'
    `)
      .execute()
    console.log('[0058] DELETE executado para Salaro e semente r971jxnob9k2e6v.')

    app
      .db()
      .newQuery(`
      DELETE FROM transactions
      WHERE description = 'Conta de Agua'
         OR parent_transaction_id = 'ay4r716ds7i6j3g'
         OR id = 'ay4r716ds7i6j3g'
    `)
      .execute()
    console.log('[0058] DELETE executado para Conta de Agua e semente ay4r716ds7i6j3g.')

    // 3. Se houver ai_learnings com Salaro, limpar
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM ai_learnings
        WHERE ai_description = 'Salaro' OR corrected_description = 'Salaro'
      `)
        .execute()
    } catch (_) {}

    // 4. Recalcular saldos das contas afetadas
    affectedAccountIds.add('4xftudvb9g7gnfy')

    const affectedList = Array.from(affectedAccountIds)
    console.log(
      `[0058] Recalculando saldo de ${affectedList.length} contas: ${affectedList.join(', ')}...`,
    )

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

          // Ignorar registros pai consolidados de parcelamento (instNum=0 && instTot>0)
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
          `[0058] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
        )
      } catch (err) {
        console.log(`[0058] Erro ao recalcular saldo da conta ${accId}: ${err}`)
      }
    }

    console.log('[0058] Expurgo definitivo concluído.')
  },
  (app) => {
    // Reversão no-op
  },
)
