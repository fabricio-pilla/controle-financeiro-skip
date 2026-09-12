migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Encontrar e remover as parcelas anômalas da série 0xlqvczbobn16e6
    // que foram geradas com anos 2029 e 2030 (números 36 a 47) devido à confusão
    // com a outra série paralela 91f5phpfejdjpcq.
    // A série 0xlqvczbobn16e6 no mês atual (09/2026) era a parcela 4/79 (s5qh89j4lze8mo7).
    // As parcelas futuras reais devem começar em 5/79 em 10/2026.
    try {
      const wrongParcels = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && parent_transaction_id = '0xlqvczbobn16e6' && installment_number >= 36 && (date >= '2028-01-01' || date >= '2029-01-01')`,
        'installment_number',
        100,
        0,
      )

      console.log(
        `[0039] Encontradas ${wrongParcels.length} parcelas com anos incorretos (2029/2030) na série 0xlqvczbobn16e6. Removendo...`,
      )
      for (let i = 0; i < wrongParcels.length; i++) {
        const item = wrongParcels[i]
        console.log(
          `[0039] Removendo parcela com data incorreta: ${item.id} - ${item.getString('description')} (${item.getString('date')})`,
        )
        app.delete(item)
      }
    } catch (err) {
      console.log('[0039] Nenhuma parcela anômala encontrada ou erro na busca:', err)
    }

    // 2. Agora vamos gerar de forma correta as próximas 12 parcelas da série 0xlqvczbobn16e6:
    // No mês atual (09/2026), temos a parcela 4/79.
    // As 12 parcelas seguintes devem ser: 5/79 a 16/79, de 10/2026 a 09/2027.
    try {
      const parentRecord = app.findFirstRecordByData('transactions', 'id', '0xlqvczbobn16e6')
      const daughter4 = app.findFirstRecordByData('transactions', 'id', 's5qh89j4lze8mo7')
      const userId = daughter4.getString('user_id') || parentRecord.getString('user_id')
      const accountId = daughter4.getString('account_id')
      const categoryId = daughter4.getString('category_id')
      const subcategoryId = daughter4.getString('subcategory_id')
      const amount = daughter4.getFloat('amount') || 1130.95
      const total = 79

      const txCol = app.findCollectionByNameOrId('transactions')

      for (let offset = 1; offset <= 12; offset++) {
        const n = 4 + offset // 5..16
        // Calcular ano e mês UTC a partir de 2026-09
        const totalMonths = 9 - 1 + offset // 8 + offset
        const targetYear = 2026 + Math.floor(totalMonths / 12)
        const targetMonth = (((totalMonths % 12) + 12) % 12) + 1 // 1-12
        const yyyy = String(targetYear).padStart(4, '0')
        const mm = String(targetMonth).padStart(2, '0')
        const targetDate = `${yyyy}-${mm}-10 00:00:00.000Z`

        // Checagem de idempotência
        const existing = app.findRecordsByFilter(
          'transactions',
          `control_id = '${CONTROL_ID}' && parent_transaction_id = '0xlqvczbobn16e6' && installment_number = ${n}`,
          'created',
          1,
          0,
        )

        if (existing.length === 0) {
          const rec = new Record(txCol)
          rec.set('control_id', CONTROL_ID)
          rec.set('user_id', userId)
          rec.set('type', 'despesa')
          rec.set('amount', amount)
          rec.set('description', `Sem descrição (${n}/${total})`)
          rec.set('category_id', categoryId)
          rec.set('subcategory_id', subcategoryId)
          rec.set('account_id', accountId)
          rec.set('date', targetDate)
          rec.set('payment_date', targetDate)
          rec.set('paid', false)
          rec.set('recurring', false)
          rec.set('is_recurring', false)
          rec.set('recurrence_type', '')
          rec.set('recurrence_period', '')
          rec.set('installment_number', n)
          rec.set('installment_total', total)
          rec.set('parent_transaction_id', '0xlqvczbobn16e6')
          rec.set('notes', 'Gerado automaticamente: parcela da série')
          app.save(rec)
          console.log(`[0039] Criada parcela corrigida ${n}/${total} para a data ${targetDate}`)
        }
      }
    } catch (err) {
      console.log('[0039] Erro ao criar parcelas 5..16 para 0xlqvczbobn16e6:', err)
    }

    // 3. Recalcular e sincronizar o saldo de todas as contas do controle
    const accounts = app.findRecordsByFilter(
      'accounts',
      `control_id = '${CONTROL_ID}'`,
      'created',
      100,
      0,
    )

    console.log(`[0039] Recalculando saldo de ${accounts.length} contas do controle...`)

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
        `[0039] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
      )
    }
  },
  (app) => {
    // Reversão
  },
)
