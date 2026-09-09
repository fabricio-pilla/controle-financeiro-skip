migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Identificar registros duplicados gerados pela migration 0036 para pais que já possuem uma série contínua iniciada em Julho
    // A série 79x do pai 'i4h4fyaipkqywfy' tem a parcela 1 em Julho ('j987i67bdks8627').
    // Na migration 0036, foi gerada uma parcela duplicada '7dvlaof5jomcjch' com data 2026-08-10 (1/79)
    // ao invés de vincular a série contínua.
    // Vamos remover com segurança '7dvlaof5jomcjch' caso exista:
    try {
      const dup79 = app.findFirstRecordByData('transactions', 'id', '7dvlaof5jomcjch')
      console.log(
        `[0038] Removendo parcela duplicada 1/79 de Agosto: ${dup79.id} (R$ ${dup79.getFloat('amount')})`,
      )
      app.delete(dup79)
    } catch (_) {
      console.log('[0038] Parcela 7dvlaof5jomcjch já removida ou não encontrada.')
    }

    // 2. Verificar se há qualquer outra duplicidade de parcela para a mesma série
    // Buscar todas as filhas ativas de pais consolidadores
    const parentRecords = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && installment_number = 0 && installment_total > 0`,
      'date',
      100,
      0,
    )

    for (let p = 0; p < parentRecords.length; p++) {
      const parent = parentRecords[p]
      const parentId = parent.id

      // Buscar filhas deste pai
      const daughters = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && parent_transaction_id = '${parentId}'`,
        'date',
        500,
        0,
      )

      // Agrupar por número de parcela
      const byNumber = {}
      for (let d = 0; d < daughters.length; d++) {
        const item = daughters[d]
        const num = item.getInt('installment_number')
        if (num <= 0) continue
        if (!byNumber[num]) byNumber[num] = []
        byNumber[num].push(item)
      }

      for (const numStr of Object.keys(byNumber)) {
        const list = byNumber[numStr]
        if (list.length > 1) {
          console.log(
            `[0038] Encontradas ${list.length} parcelas para número ${numStr} no pai ${parentId}`,
          )
          // Manter a mais antiga (original da importação) e remover as regeneradas duplicadas
          list.sort(
            (a, b) =>
              new Date(a.getString('created')).getTime() -
              new Date(b.getString('created')).getTime(),
          )
          for (let i = 1; i < list.length; i++) {
            const dup = list[i]
            console.log(
              `[0038] Removendo duplicata ${dup.id} da parcela ${numStr}/${parent.getInt('installment_total')}`,
            )
            app.delete(dup)
          }
        }
      }
    }

    // 3. Recalcular o saldo de TODAS as contas do controle de forma consistente e exata
    const accounts = app.findRecordsByFilter(
      'accounts',
      `control_id = '${CONTROL_ID}'`,
      'created',
      100,
      0,
    )

    console.log(`[0038] Recalculando saldo de ${accounts.length} contas do controle...`)

    for (let a = 0; a < accounts.length; a++) {
      const acc = accounts[a]
      const accId = acc.id
      const accType = acc.getString('type')

      // Buscar transações da conta
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

        // Ignorar registros pai consolidados
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
        .newQuery(`UPDATE accounts SET balance = {:balance}, updated = {:updated} WHERE id = {:id}`)
        .bind({
          id: accId,
          balance: calcBalance,
          updated: nowIso,
        })
        .execute()

      console.log(
        `[0038] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
      )
    }
  },
  (app) => {
    // Reversão
  },
)
