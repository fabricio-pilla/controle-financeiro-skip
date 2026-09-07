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

    const nowIso = new Date().toISOString()

    // Mapear categorias corretas de Receita caso a transação de agosto ainda esteja
    // apontando para a categoria antiga "uvu77y4t4rpyccx" (Despesa Fabrício)
    // Categoria "Receita Fabrício": u7b1rllvqx854u8
    // Categoria "Receita Raffaela": 7oulvlevev2euss
    let receitaFabricioId = 'u7b1rllvqx854u8'
    let receitaRaffaelaId = '7oulvlevev2euss'

    try {
      const catFab = app.findFirstRecordByData('categories', 'name', 'Receita Fabrício')
      if (catFab) receitaFabricioId = catFab.id
    } catch (_) {}

    try {
      const catRaff = app.findFirstRecordByData('categories', 'name', 'Receita Raffaela')
      if (catRaff) receitaRaffaelaId = catRaff.id
    } catch (_) {}

    // Subcategorias de salário
    let subSalarioFabId = '8r2h5zisfvkwo71'
    let subSalarioRaffId = 'eies4131sbt1l68'

    try {
      const subFab = app.findRecordsByFilter(
        'subcategories',
        `control_id = '${CONTROL_ID}' && category_id = '${receitaFabricioId}' && name = 'Salário'`,
        '',
        1,
        0,
      )
      if (subFab && subFab.length > 0) subSalarioFabId = subFab[0].id
    } catch (_) {}

    try {
      const subRaff = app.findRecordsByFilter(
        'subcategories',
        `control_id = '${CONTROL_ID}' && category_id = '${receitaRaffaelaId}' && name = 'Salário'`,
        '',
        1,
        0,
      )
      if (subRaff && subRaff.length > 0) subSalarioRaffId = subRaff[0].id
    } catch (_) {}

    // 1. Também corrigir as receitas de agosto/2026 existentes que apontam para categoria antiga 'uvu77y4t4rpyccx'
    // Como a conta é Neon Fabrício (4xftudvb9g7gnfy) ou Flash (hnwounfuhdvzswx), são de Fabrício
    try {
      const existingAugReceitas = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && date >= '2026-08-01' && date <= '2026-08-31 23:59:59' && type = 'receita' && category_id = 'uvu77y4t4rpyccx'`,
        '',
        100,
        0,
      )
      existingAugReceitas.forEach((rec) => {
        rec.set('category_id', receitaFabricioId)
        if (rec.getString('subcategory_id') === 'jf0e1brebxweo04') {
          rec.set('subcategory_id', subSalarioFabId)
        }
        app.save(rec)
      })
    } catch (e) {
      console.log('Aviso ao corrigir categoria das receitas de agosto:', e)
    }

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
          type: tx.type || 'receita',
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
    // RECEITAS RECORRENTES DE AGOSTO/2026
    // Replicar para os próximos 12 meses (Setembro/2026 até Agosto/2027)
    // =========================================================================

    // Buscar todas as receitas recorrentes de Agosto de 2026
    const recurringAugRecords = app.findRecordsByFilter(
      'transactions',
      `control_id = '${CONTROL_ID}' && date >= '2026-08-01' && date <= '2026-08-31 23:59:59' && type = 'receita' && (is_recurring = true || recurring = true)`,
      'date',
      500,
      0,
    )

    console.log(`Encontradas ${recurringAugRecords.length} receitas recorrentes em Agosto/2026.`)

    let totalRecCreated = 0

    for (let i = 0; i < recurringAugRecords.length; i++) {
      const rec = recurringAugRecords[i]
      const origDateStr = rec.getString('date')
      const origAmount = rec.getFloat('amount')
      const origDesc = rec.getString('description')
      let origCategoryId = rec.getString('category_id')
      let origSubcategoryId = rec.getString('subcategory_id')
      const origAccountId = rec.getString('account_id')
      const origCreditCardId = rec.getString('credit_card_id')
      const origRecurrenceType = rec.getString('recurrence_type') || 'mensal'
      const origRecurrencePeriod = rec.getString('recurrence_period') || 'mensal'
      const origNotes = rec.getString('notes')

      // Se categoria ainda for a antiga ou estiver associada ao Fabrício
      if (origCategoryId === 'uvu77y4t4rpyccx') {
        origCategoryId = receitaFabricioId
        if (origSubcategoryId === 'jf0e1brebxweo04') {
          origSubcategoryId = subSalarioFabId
        }
      }

      // Criar 12 lançamentos subsequentes (mês +1 até mês +12)
      for (let m = 1; m <= 12; m++) {
        const nextDateStr = addMonthsToDateStr(origDateStr, m)
        const nextDatePrefix = nextDateStr.substring(0, 10) // "YYYY-MM-DD"

        // Verificar idempotência: já existe lançamento de receita recorrente equivalente nesta data?
        const existing = app.findRecordsByFilter(
          'transactions',
          `control_id = '${CONTROL_ID}' && date >= '${nextDatePrefix} 00:00:00' && date <= '${nextDatePrefix} 23:59:59' && type = 'receita' && account_id = '${origAccountId}' && amount = ${origAmount} && (is_recurring = true || recurring = true)`,
          '',
          1,
          0,
        )

        if (existing && existing.length > 0) {
          continue
        }

        insertTransaction({
          type: 'receita',
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

    console.log(`Total de receitas recorrentes criadas: ${totalRecCreated}`)
  },
  (app) => {
    // Reverter transações de receita criadas após Agosto/2026 para o controle
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM transactions WHERE control_id = {:controlId} AND type = 'receita' AND date >= '2026-09-01 00:00:00'",
        )
        .bind({ controlId: CONTROL_ID })
        .execute()
    } catch (_) {}
  },
)
