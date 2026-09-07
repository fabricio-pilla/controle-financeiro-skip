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
      // new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
      const targetDay = Math.min(origDay, lastDayOfTargetMonth)

      const yyyy = String(targetYear).padStart(4, '0')
      const mm = String(targetMonth + 1).padStart(2, '0')
      const dd = String(targetDay).padStart(2, '0')

      return `${yyyy}-${mm}-${dd} 00:00:00.000Z`
    }

    // Helper para extrair prefixo da descrição sem "(N/T)"
    const cleanDescription = (desc) => {
      if (!desc) return ''
      return desc.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
    }

    const nowIso = new Date().toISOString()

    // Helper para inserir transação de forma padronizada
    const insertTransaction = (tx) => {
      const txId = tx.id || generateId()
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
          id: txId,
          control_id: CONTROL_ID,
          user_id: USER_ID,
          type: tx.type || 'despesa',
          amount: tx.amount,
          description: tx.description,
          category_id: tx.category_id || '',
          subcategory_id: tx.subcategory_id || '',
          account_id: tx.account_id || '',
          credit_card_id: tx.credit_card_id || '',
          date: tx.date,
          payment_date: tx.payment_date || '',
          paid: tx.paid ? 1 : 0,
          recurring: tx.is_recurring ? 1 : 0,
          is_recurring: tx.is_recurring ? 1 : 0,
          recurrence_type: tx.recurrence_type || '',
          recurrence_period: tx.recurrence_period || '',
          installment_number: tx.installment_number || 0,
          installment_total: tx.installment_total || 0,
          parent_transaction_id: tx.parent_transaction_id || '',
          notes: tx.notes || '',
          created: nowIso,
          updated: nowIso,
        })
        .execute()

      return txId
    }

    // =========================================================================
    // PARTE 1: DESPESAS RECORRENTES DE AGOSTO/2026
    // Replicar para os próximos 12 meses (Setembro/2026 até Agosto/2027)
    // =========================================================================

    // Buscar todas as despesas recorrentes de Agosto de 2026
    const recurringAugRecords = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && date >= '2026-08-01' && date <= '2026-08-31 23:59:59' && type = 'despesa' && (is_recurring = true || recurring = true)`,
      'date',
      500,
      0,
    )

    console.log(`Encontradas ${recurringAugRecords.length} despesas recorrentes em Agosto/2026.`)

    let totalRecCreated = 0

    for (let i = 0; i < recurringAugRecords.length; i++) {
      const rec = recurringAugRecords[i]
      const origDateStr = rec.getString('date')
      const origAmount = rec.getFloat('amount')
      const origDesc = rec.getString('description')
      const origCategoryId = rec.getString('category_id')
      const origSubcategoryId = rec.getString('subcategory_id')
      const origAccountId = rec.getString('account_id')
      const origCreditCardId = rec.getString('credit_card_id')
      const origRecurrenceType = rec.getString('recurrence_type') || 'mensal'
      const origRecurrencePeriod = rec.getString('recurrence_period') || 'mensal'
      const origNotes = rec.getString('notes')

      // Criar 12 lançamentos subsequentes (mês +1 até mês +12)
      for (let m = 1; m <= 12; m++) {
        const nextDateStr = addMonthsToDateStr(origDateStr, m)
        const nextDatePrefix = nextDateStr.substring(0, 10) // "YYYY-MM-DD"

        // Verificar idempotência: já existe lançamento recorrente equivalente nesta data?
        // Verificamos por control_id, data ~ nextDatePrefix, category_id, subcategory_id, amount, account_id, description
        const existing = app.findRecordsByFilter(
          'transactions',
          `control_id = '${CONTROL_ID}' && date >= '${nextDatePrefix} 00:00:00' && date <= '${nextDatePrefix} 23:59:59' && type = 'despesa' && category_id = '${origCategoryId}' && subcategory_id = '${origSubcategoryId}' && account_id = '${origAccountId}' && amount = ${origAmount} && description = '${origDesc}' && (is_recurring = true || recurring = true)`,
          '',
          1,
          0,
        )

        if (existing && existing.length > 0) {
          // Já existe, pula
          continue
        }

        insertTransaction({
          type: 'despesa',
          amount: origAmount,
          description: origDesc,
          category_id: origCategoryId,
          subcategory_id: origSubcategoryId,
          account_id: origAccountId,
          credit_card_id: origCreditCardId,
          date: nextDateStr,
          payment_date: '',
          paid: false, // Meses futuros ficam como pendentes (não pagos)
          is_recurring: true,
          recurrence_type: origRecurrenceType,
          recurrence_period: origRecurrencePeriod,
          installment_number: 1,
          installment_total: 0,
          parent_transaction_id: '',
          notes: origNotes,
        })
        totalRecCreated++
      }
    }

    console.log(`Total de despesas recorrentes criadas: ${totalRecCreated}`)

    // =========================================================================
    // PARTE 2: DESPESAS PARCELADAS DE AGOSTO/2026
    // Continuar gerando as parcelas restantes até installment_total
    // =========================================================================

    // Buscar todas as parcelas ativas de Agosto/2026 (installment_total > 0 && installment_number > 0)
    const installmentAugRecords = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && date >= '2026-08-01' && date <= '2026-08-31 23:59:59' && type = 'despesa' && installment_total > 0 && installment_number > 0`,
      'date',
      100,
      0,
    )

    console.log(`Encontradas ${installmentAugRecords.length} parcelas ativas em Agosto/2026.`)

    let totalInstCreated = 0

    for (let i = 0; i < installmentAugRecords.length; i++) {
      const inst = installmentAugRecords[i]
      const currentNumber = inst.getInt('installment_number')
      const totalNumber = inst.getInt('installment_total')
      const origDateStr = inst.getString('date')
      const amount = inst.getFloat('amount')
      const origDesc = inst.getString('description')
      const baseDesc = cleanDescription(origDesc)
      const categoryId = inst.getString('category_id')
      const subcategoryId = inst.getString('subcategory_id')
      const accountId = inst.getString('account_id')
      const creditCardId = inst.getString('credit_card_id')
      const parentId = inst.getString('parent_transaction_id')

      if (currentNumber >= totalNumber) {
        // Já é a última parcela em agosto
        continue
      }

      // Gerar parcelas restantes: currentNumber + 1 até totalNumber
      for (let n = currentNumber + 1; n <= totalNumber; n++) {
        const monthsToAdd = n - currentNumber
        const parcelDateStr = addMonthsToDateStr(origDateStr, monthsToAdd)
        const parcelDesc = `${baseDesc} (${n}/${totalNumber})`
        const parcelNotes = `Importado de planilha: parcela ${n}/${totalNumber}`

        // Verificar idempotência: já existe a parcela n desta série?
        // Pode ser checado por parent_transaction_id e installment_number, ou por control_id, category_id, subcategory_id e installment_number/total
        let alreadyExists = false
        if (parentId) {
          const checkParent = app.findRecordsByFilter(
            'transactions',
            `control_id = '${CONTROL_ID}' && parent_transaction_id = '${parentId}' && installment_number = ${n}`,
            '',
            1,
            0,
          )
          if (checkParent && checkParent.length > 0) {
            alreadyExists = true
          }
        }

        if (!alreadyExists) {
          const checkDesc = app.findRecordsByFilter(
            'transactions',
            `control_id = '${CONTROL_ID}' && installment_total = ${totalNumber} && installment_number = ${n} && category_id = '${categoryId}' && subcategory_id = '${subcategoryId}'`,
            '',
            1,
            0,
          )
          if (checkDesc && checkDesc.length > 0) {
            alreadyExists = true
          }
        }

        if (alreadyExists) {
          continue
        }

        insertTransaction({
          type: 'despesa',
          amount: amount,
          description: parcelDesc,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          account_id: accountId,
          credit_card_id: creditCardId,
          date: parcelDateStr,
          payment_date: '',
          paid: false, // Parcelas futuras ficam como pendentes
          is_recurring: false,
          recurrence_type: '',
          recurrence_period: '',
          installment_number: n,
          installment_total: totalNumber,
          parent_transaction_id: parentId,
          notes: parcelNotes,
        })
        totalInstCreated++
      }
    }

    console.log(`Total de parcelas futuras criadas: ${totalInstCreated}`)
  },
  (app) => {
    // Reverter transações criadas após Agosto/2026 para o controle
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM transactions WHERE control_id = {:controlId} AND date >= '2026-09-01 00:00:00'",
        )
        .bind({ controlId: CONTROL_ID })
        .execute()
    } catch (_) {}
  },
)
