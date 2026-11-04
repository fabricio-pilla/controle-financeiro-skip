// pocketbase/migrations/0057_cleanup_duplicate_recurring_salaro_conta_de_agua.js
// Limpeza das séries recorrentes duplicadas manuais "Salaro" e "Conta de Agua",
// mantendo as séries importadas originais ("Salario" e "Agua") e recalculando saldos.
// Idempotente e segura para banco vazio ou já migrado.

migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Localizar e apagar ocorrências e sementes da série "Salaro"
    // Semente conhecida: r971jxnob9k2e6v (manual 05/10/2026, receita 5308.47)
    // Ocorrências geradas filhas: parent_transaction_id = r971jxnob9k2e6v ou description = 'Salaro'
    console.log('[0057] Buscando registros da série "Salaro"...')
    const salaroTxs = app.findRecordsByFilter(
      'transactions',
      `description = 'Salaro' || parent_transaction_id = 'r971jxnob9k2e6v'`,
      'created',
      1000,
      0,
    )

    console.log(`[0057] Encontrados ${salaroTxs.length} registros para "Salaro".`)
    const affectedAccountIds = new Set()

    for (let i = 0; i < salaroTxs.length; i++) {
      const tx = salaroTxs[i]
      const accId = tx.getString('account_id')
      if (accId) affectedAccountIds.add(accId)
      console.log(
        `[0057] Apagando Salaro: id=${tx.id}, date=${tx.getString('date')}, amount=${tx.getFloat('amount')}, paid=${tx.getBool('paid')}, parent=${tx.getString('parent_transaction_id')}`,
      )
      app.delete(tx)
    }

    // 2. Localizar e apagar ocorrências e sementes da série "Conta de Agua"
    // Semente: ay4r716ds7i6j3g (despesa 199.87)
    // Ocorrências geradas filhas: parent_transaction_id = ay4r716ds7i6j3g ou description = 'Conta de Agua'
    // Atenção: a série mantida se chama "Agua" (semente 00gnjaodvuikbft), NÃO TOCAR em "Agua" nem em "Salario".
    console.log('[0057] Buscando registros da série "Conta de Agua"...')
    const contaDeAguaTxs = app.findRecordsByFilter(
      'transactions',
      `description = 'Conta de Agua' || parent_transaction_id = 'ay4r716ds7i6j3g'`,
      'created',
      1000,
      0,
    )

    console.log(`[0057] Encontrados ${contaDeAguaTxs.length} registros para "Conta de Agua".`)
    for (let i = 0; i < contaDeAguaTxs.length; i++) {
      const tx = contaDeAguaTxs[i]
      const accId = tx.getString('account_id')
      if (accId) affectedAccountIds.add(accId)
      console.log(
        `[0057] Apagando Conta de Agua: id=${tx.id}, date=${tx.getString('date')}, amount=${tx.getFloat('amount')}, paid=${tx.getBool('paid')}, parent=${tx.getString('parent_transaction_id')}`,
      )
      app.delete(tx)
    }

    // 3. Validação de segurança: conferir se a série "Salario" permanece intacta
    const salarioTxs = app.findRecordsByFilter(
      'transactions',
      `description = 'Salario'`,
      'date',
      100,
      0,
    )
    console.log(`[0057] Verificação: Total de registros "Salario" mantidos = ${salarioTxs.length}`)

    // 4. Validação de segurança: conferir se a série "Agua" permanece intacta
    const aguaTxs = app.findRecordsByFilter('transactions', `description = 'Agua'`, 'date', 100, 0)
    console.log(`[0057] Verificação: Total de registros "Agua" mantidos = ${aguaTxs.length}`)

    // 5. Validação de segurança: conferir que "Vale Alimentação" / "Vale Aliementação" NÃO foram alterados
    const valeTxs = app.findRecordsByFilter('transactions', `description ~ 'Vale'`, 'date', 100, 0)
    console.log(`[0057] Verificação: Total de registros "Vale..." mantidos = ${valeTxs.length}`)

    // 6. Recalcular saldos de todas as contas afetadas (e contas do controle se houver)
    // Se for banco vazio (affectedAccountIds vazio), buscar contas do controle
    if (affectedAccountIds.size === 0) {
      const allAccounts = app.findRecordsByFilter(
        'accounts',
        `control_id = '${CONTROL_ID}'`,
        'created',
        100,
        0,
      )
      for (let a = 0; a < allAccounts.length; a++) {
        affectedAccountIds.add(allAccounts[a].id)
      }
    }

    console.log(`[0057] Recalculando saldo de ${affectedAccountIds.size} contas...`)

    for (const accId of affectedAccountIds) {
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

          // Ignorar registros pai consolidados de compras parceladas
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
          `[0057] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
        )
      } catch (err) {
        console.log(`[0057] Erro ao recalcular saldo da conta ${accId}: ${err}`)
      }
    }

    console.log('[0057] Migração de limpeza de duplicatas concluída com sucesso.')
  },
  (app) => {
    // Reversão no-op — registros duplicados não devem ser restaurados
  },
)
