migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const USER_ID = 'uc5jp6hewxu9yio'

    // Helper para gerar ID alfanumérico padrão PocketBase (15 caracteres)
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

    // Helper para adicionar N meses mantendo o dia limite do mês
    // dateStr: "YYYY-MM-DD ..." ou "YYYY-MM-DDTHH:mm:ss.sssZ"
    const addMonthsToDateStr = (dateStr, monthsToAdd) => {
      const d = new Date(dateStr)
      const origDay = d.getUTCDate()
      const origYear = d.getUTCFullYear()
      const origMonth = d.getUTCMonth() // 0-based

      const targetTotalMonth = origMonth + monthsToAdd
      const targetYear = origYear + Math.floor(targetTotalMonth / 12)
      const targetMonth = ((targetTotalMonth % 12) + 12) % 12

      // Último dia do mês alvo em UTC
      const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
      const targetDay = Math.min(origDay, lastDayOfTargetMonth)

      const yyyy = String(targetYear).padStart(4, '0')
      const mm = String(targetMonth + 1).padStart(2, '0')
      const dd = String(targetDay).padStart(2, '0')

      return `${yyyy}-${mm}-${dd} 00:00:00.000Z`
    }

    // Helper para limpar sufixo do pai (ex.: " (Total: R$ ...)") e "(n/total)"
    const cleanParentDescription = (desc) => {
      if (!desc) return 'Sem descrição'
      let res = desc.replace(/\s*\(Total:\s*R\$[^\)]+\)\s*$/i, '').trim()
      res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
      return res || 'Sem descrição'
    }

    const now = new Date()
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    const nowIso = now.toISOString()

    // 1. Buscar todos os registros pais do controle (installment_number = 0 && installment_total > 0)
    const parentRecords = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && installment_number = 0 && installment_total > 0`,
      'date',
      100,
      0,
    )

    console.log(
      `[0036] Encontrados ${parentRecords.length} registros pais para verificação no controle ${CONTROL_ID}.`,
    )

    const affectedAccountIds = new Set()
    let totalCreated = 0

    // Processar cada pai
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
      const parentUserId = parent.getString('user_id') || USER_ID

      if (accountId) {
        affectedAccountIds.add(accountId)
      }

      // Buscar filhas existentes por parent_transaction_id
      const existingByParent = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && parent_transaction_id = '${parentId}'`,
        'installment_number',
        500,
        0,
      )

      // Também buscar filhas órfãs (parent_transaction_id vazio ou diferente mas com descrição / número equivalentes)
      const existingByDescAndTotal = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && installment_total = ${totalInstallments} && installment_number > 0`,
        'installment_number',
        500,
        0,
      )

      // Mapear números de parcelas que já existem
      const existingInstallmentNumbers = new Set()

      for (let i = 0; i < existingByParent.length; i++) {
        const num = existingByParent[i].getInt('installment_number')
        if (num > 0) {
          existingInstallmentNumbers.add(num)
        }
      }

      for (let i = 0; i < existingByDescAndTotal.length; i++) {
        const item = existingByDescAndTotal[i]
        const num = item.getInt('installment_number')
        const itemAcc = item.getString('account_id')
        const itemCat = item.getString('category_id')
        const itemDesc = item.getString('description')

        // Checar compatibilidade
        const matchAcc = !accountId || itemAcc === accountId
        const matchCat = !categoryId || itemCat === categoryId
        const matchDesc = itemDesc.toLowerCase().startsWith(baseDesc.toLowerCase())

        if (num > 0 && matchAcc && (matchCat || matchDesc)) {
          existingInstallmentNumbers.add(num)
        }
      }

      // Calcular valor de cada parcela
      // amount_parcela = round(pai.amount / installment_total, 2)
      // Ajustar a última parcela para soma exata das filhas = pai.amount
      const baseParcelAmount = Math.round((totalAmount / totalInstallments) * 100) / 100
      const lastParcelAmount =
        Math.round((totalAmount - baseParcelAmount * (totalInstallments - 1)) * 100) / 100

      console.log(
        `[0036] Pai ${parentId} ("${baseDesc}", total R$ ${totalAmount}, ${totalInstallments}x): ` +
          `${existingInstallmentNumbers.size} filhas existentes de ${totalInstallments}.`,
      )

      // Criar parcelas faltantes (de 1 a totalInstallments)
      for (let n = 1; n <= totalInstallments; n++) {
        if (existingInstallmentNumbers.has(n)) {
          continue // Já existe! Idempotência garantida.
        }

        const parcelAmount = n === totalInstallments ? lastParcelAmount : baseParcelAmount
        const parcelDateStr = addMonthsToDateStr(parentDateStr, n - 1)
        const parcelDatePrefix = parcelDateStr.substring(0, 10) // "YYYY-MM-DD"
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

        totalCreated++
      }
    }

    console.log(`[0036] Total de parcelas regeneradas: ${totalCreated}.`)

    // 4. Recalcular o saldo das contas afetadas de forma agregada
    const accountsToRecompute = Array.from(affectedAccountIds)
    console.log(`[0036] Recalculando saldo de ${accountsToRecompute.length} conta(s)...`)

    for (let a = 0; a < accountsToRecompute.length; a++) {
      const accId = accountsToRecompute[a]
      try {
        const accRecord = app.findFirstRecordByData('accounts', 'id', accId)
        const accType = accRecord.getString('type') // 'credito' ou 'banco'/'dinheiro'/etc.

        // Buscar transações associadas a esta conta (ignorando registros pais installment_number = 0 && installment_total > 0)
        // Regra de saldo em skip-cloud:
        // Se type === 'credito': calcBalance += tType === 'despesa' ? amt : -amt
        // Se type !== 'credito': calcBalance += tType === 'receita' ? amt : -amt
        // Note: registros pais (installment_number=0 && installment_total>0) não devem impactar o saldo
        // para não somar duas vezes o valor consolidado e as parcelas individuais!
        const rows = app
          .db()
          .newQuery(`
            SELECT type, amount FROM transactions
            WHERE account_id = {:accountId}
            AND NOT (installment_number = 0 AND installment_total > 0)
          `)
          .bind({ accountId: accId })
          .all()

        let calcBalance = 0
        for (let r = 0; r < rows.length; r++) {
          const tType = rows[r].type
          const amt = Number(rows[r].amount) || 0
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
            `UPDATE accounts SET balance = {:balance}, updated = {:updated} WHERE id = {:id}`,
          )
          .bind({
            id: accId,
            balance: calcBalance,
            updated: nowIso,
          })
          .execute()

        console.log(
          `[0036] Conta ${accId} (${accRecord.getString('name')}) novo saldo: ${calcBalance}`,
        )
      } catch (err) {
        console.log(`[0036] Erro ao recalcular saldo da conta ${accId}:`, err)
      }
    }
  },
  (app) => {
    // Reverter transações criadas por esta migration
    try {
      app
        .db()
        .newQuery("DELETE FROM transactions WHERE notes = 'Regenerado: parcela faltante da série'")
        .execute()
    } catch (_) {}
  },
)
