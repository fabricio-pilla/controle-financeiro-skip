migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Reconciliação do avulso 'c41q3w9lcu4hdl0' (amount 1130.95, date 2026-07-10)
    // Este avulso é a parcela 1/79 da série cujo pai é '3p0noh354v2g44j' (total 89345.05, 79x).
    // Na importação de planilha original, ele entrou com installment_number = 1 mas installment_total = 0, sem parent_transaction_id.
    // Vamos reconciliar via findRecordsByFilter e app.save():
    const parentRecords = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && installment_number = 0 && installment_total > 0`,
      'date',
      100,
      0,
    )

    console.log(`[0037] Encontrados ${parentRecords.length} registros pais para conferência.`)

    const affectedAccountIds = new Set()

    const generateId = () => {
      try {
        if (typeof $security !== 'undefined' && $security.randomString) {
          return $security.randomString(15).toLowerCase()
        }
      } catch (_) {}
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let res = ''
      for (let i = 0; i < 15; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return res
    }

    const addMonthsToDateStr = (dateStr, monthsToAdd) => {
      const d = new Date(dateStr)
      const origDay = d.getUTCDate()
      const origYear = d.getUTCFullYear()
      const origMonth = d.getUTCMonth() // 0-based

      const targetTotalMonth = origMonth + monthsToAdd
      const targetYear = origYear + Math.floor(targetTotalMonth / 12)
      const targetMonth = ((targetTotalMonth % 12) + 12) % 12

      const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
      const targetDay = Math.min(origDay, lastDayOfTargetMonth)

      const yyyy = String(targetYear).padStart(4, '0')
      const mm = String(targetMonth + 1).padStart(2, '0')
      const dd = String(targetDay).padStart(2, '0')

      return `${yyyy}-${mm}-${dd} 00:00:00.000Z`
    }

    const cleanParentDescription = (desc) => {
      if (!desc) return 'Sem descrição'
      let res = desc.replace(/\s*\(Total:\s*R\$[^\)]+\)\s*$/i, '').trim()
      res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
      return res || 'Sem descrição'
    }

    const now = new Date()
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`

    for (let p = 0; p < parentRecords.length; p++) {
      const parent = parentRecords[p]
      const parentId = parent.id
      const totalInstallments = parent.getInt('installment_total')
      const totalAmount = parent.getFloat('amount')
      const parentDateStr = parent.getString('date')
      const rawDesc = parent.getString('description')
      const baseDesc = cleanParentDescription(rawDesc)
      const categoryId = parent.getString('category_id')
      const subcategoryId = parent.getString('subcategory_id')
      const accountId = parent.getString('account_id')
      const creditCardId = parent.getString('credit_card_id')
      const parentUserId = parent.getString('user_id') || 'uc5jp6hewxu9yio'

      if (accountId) affectedAccountIds.add(accountId)

      const baseParcelAmount = Math.round((totalAmount / totalInstallments) * 100) / 100
      const lastParcelAmount =
        Math.round((totalAmount - baseParcelAmount * (totalInstallments - 1)) * 100) / 100

      // Procurar candidatos avulsos com findRecordsByFilter
      const candidateSingles = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && subcategory_id = '${subcategoryId}' && account_id = '${accountId}' && installment_total = 0`,
        'date',
        100,
        0,
      )

      let firstParcelDate = parentDateStr

      for (let s = 0; s < candidateSingles.length; s++) {
        const single = candidateSingles[s]
        const singleAmt = single.getFloat('amount')
        // Conferir se o valor bate com o da parcela da série
        if (Math.abs(singleAmt - baseParcelAmount) < 0.05) {
          const singleId = single.id
          firstParcelDate = single.getString('date') || parentDateStr
          const pDate = single.getString('payment_date') || single.getString('date')

          console.log(
            `[0037] Reconciliando avulso ${singleId} (R$ ${singleAmt}) como parcela 1/${totalInstallments} do pai ${parentId}`,
          )

          app
            .db()
            .newQuery(`
              UPDATE transactions
              SET parent_transaction_id = {:parentId},
                  installment_number = 1,
                  installment_total = {:totalInstallments},
                  description = {:desc},
                  payment_date = {:paymentDate},
                  notes = 'Reconciliado: parcela 1/' || {:totalInstallments} || ' vinculada ao registro pai',
                  updated = {:updated}
              WHERE id = {:id}
            `)
            .bind({
              id: singleId,
              parentId: parentId,
              totalInstallments: totalInstallments,
              desc: `${baseDesc} (1/${totalInstallments})`,
              paymentDate: pDate,
              updated: nowIso,
            })
            .execute()
        }
      }

      // Agora verificar filhas 1..totalInstallments deste pai
      const existingDaughters = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && parent_transaction_id = '${parentId}'`,
        'installment_number',
        500,
        0,
      )

      const daughterNumbers = new Set()
      for (let d = 0; d < existingDaughters.length; d++) {
        const num = existingDaughters[d].getInt('installment_number')
        if (num > 0) daughterNumbers.add(num)
      }

      // Se filhas faltarem para este pai, gerar
      for (let n = 1; n <= totalInstallments; n++) {
        if (daughterNumbers.has(n)) {
          continue // Já existe!
        }

        const parcelAmount = n === totalInstallments ? lastParcelAmount : baseParcelAmount
        const parcelDateStr = addMonthsToDateStr(firstParcelDate, n - 1)
        const parcelDatePrefix = parcelDateStr.substring(0, 10)
        const isPaid = parcelDatePrefix <= todayStr
        const parcelDesc = `${baseDesc} (${n}/${totalInstallments})`
        const newId = generateId()

        app
          .db()
          .newQuery(`
            INSERT INTO transactions (
              id, control_id, user_id, type, amount, description,
              category_id, subcategory_id, account_id, credit_card_id,
              date, payment_date, paid, recurring, is_recurring,
              recurrence_type, recurrence_period, installment_number,
              installment_total, parent_transaction_id, notes,
              created, updated
            ) VALUES (
              {:id}, {:control_id}, {:user_id}, {:type}, {:amount}, {:description},
              {:category_id}, {:subcategory_id}, {:account_id}, {:credit_card_id},
              {:date}, {:payment_date}, {:paid}, {:recurring}, {:is_recurring},
              {:recurrence_type}, {:recurrence_period}, {:installment_number},
              {:installment_total}, {:parent_transaction_id}, {:notes},
              {:created}, {:updated}
            )
          `)
          .bind({
            id: newId,
            control_id: CONTROL_ID,
            user_id: parentUserId,
            type: 'despesa',
            amount: parcelAmount,
            description: parcelDesc,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            account_id: accountId,
            credit_card_id: creditCardId,
            date: parcelDateStr,
            payment_date: parcelDateStr,
            paid: isPaid ? 1 : 0,
            recurring: 0,
            is_recurring: 0,
            recurrence_type: '',
            recurrence_period: '',
            installment_number: n,
            installment_total: totalInstallments,
            parent_transaction_id: parentId,
            notes: 'Regenerado: parcela faltante da série',
            created: nowIso,
            updated: nowIso,
          })
          .execute()

        daughterNumbers.add(n)
        console.log(
          `[0037] Criada parcela ${n}/${totalInstallments} para pai ${parentId} na data ${parcelDateStr}`,
        )
      }
    }

    // 2. Recalcular o saldo de TODAS as contas do controle usando findRecordsByFilter
    // Regra:
    // NUNCA incluir registros pai (installment_number = 0 && installment_total > 0)
    // Se type === 'credito': saldo = sum(despesa) - sum(receita)
    // Se type !== 'credito': saldo = sum(receita) - sum(despesa)
    const accounts = app.findRecordsByFilter(
      'accounts',
      `control_id = '${CONTROL_ID}'`,
      'created',
      100,
      0,
    )

    console.log(`[0037] Recalculando saldo de ${accounts.length} contas do controle...`)

    for (let a = 0; a < accounts.length; a++) {
      const acc = accounts[a]
      const accId = acc.id
      const accType = acc.getString('type')

      // Buscar transações da conta via findRecordsByFilter
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

        // Ignorar registros pai
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
        `[0037] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
      )
    }
  },
  (app) => {
    // Reverter transações criadas por esta migration
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM transactions WHERE notes = 'Regenerado: parcela faltante da série' AND created >= '2026-09-09'",
        )
        .execute()
    } catch (_) {}
  },
)
