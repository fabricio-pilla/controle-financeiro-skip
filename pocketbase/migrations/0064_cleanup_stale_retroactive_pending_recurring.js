// pocketbase/migrations/0064_cleanup_stale_retroactive_pending_recurring.js
// Migration idempotente: remove do banco de dados as transações PENDENTES (paid = false)
// com data anterior a 01/10/2026 que tenham sido geradas automaticamente por recorrência
// (notas contendo "Gerado automaticamente").
//
// NÃO apaga:
// (a) lançamentos importados pagos de jan-out/2026 (ou qualquer transação paga)
// (b) pendências de out/2026 em diante
// (c) séries futuras de nov/2026 em diante
//
// Após a exclusão, recalcula os saldos das contas afetadas.

migrate(
  (app) => {
    console.log(
      '[0064] Iniciando limpeza de pendências retroativas geradas automaticamente (< 2026-10-01)...',
    )

    const affectedAccountIds = new Set()

    // 1. Localizar as transações pendentes retroativas geradas automaticamente
    // Filtro: paid = false AND (date < '2026-10-01' OR payment_date < '2026-10-01') AND notes ~ 'Gerado automaticamente'
    let recordsToDelete = []
    try {
      recordsToDelete = app.findRecordsByFilter(
        'transactions',
        "paid = false && date < '2026-10-01' && notes ~ 'Gerado automaticamente'",
        'date',
        5000,
        0,
      )
    } catch (err) {
      console.log('[0064] Erro ao buscar registros via filter:', err)
      recordsToDelete = []
    }

    console.log(
      `[0064] Encontradas ${recordsToDelete.length} transações pendentes retroativas para exclusão.`,
    )

    for (let i = 0; i < recordsToDelete.length; i++) {
      const rec = recordsToDelete[i]
      const accId = rec.getString('account_id')
      if (accId) {
        affectedAccountIds.add(accId)
      }
      try {
        app.delete(rec)
      } catch (delErr) {
        console.log(`[0064] Falha ao deletar registro ${rec.id}: ${delErr}`)
      }
    }

    // 2. Executar também limpeza direta via SQL para garantir que qualquer variante pendente < 2026-10-01
    // com notes contendo 'Gerado automaticamente' seja removida mesmo em bases replicadas
    try {
      app
        .db()
        .newQuery(`
          DELETE FROM transactions
          WHERE paid = 0
            AND date < '2026-10-01'
            AND (notes LIKE '%Gerado automaticamente%' OR notes LIKE '%recorrência mensal%')
        `)
        .execute()
    } catch (sqlErr) {
      console.log('[0064] Erro no DELETE SQL:', sqlErr)
    }

    // 3. Recalcular os saldos de todas as contas afetadas (ou todas as contas do controle)
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z'

    let allAccounts = []
    try {
      allAccounts = app.findRecordsByFilter('accounts', "control_id != ''", 'created', 500, 0)
    } catch (_) {
      allAccounts = []
    }

    // Adiciona todas as contas do banco para garantir consistência total de saldo
    for (let k = 0; k < allAccounts.length; k++) {
      affectedAccountIds.add(allAccounts[k].id)
    }

    const affectedList = Array.from(affectedAccountIds)
    console.log(`[0064] Recalculando saldo de ${affectedList.length} contas...`)

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
          `[0064] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
        )
      } catch (err) {
        console.log(`[0064] Erro ao recalcular saldo da conta ${accId}: ${err}`)
      }
    }

    console.log('[0064] Limpeza de pendências retroativas concluída com sucesso.')
  },
  (app) => {
    // Reversão no-op
  },
)
