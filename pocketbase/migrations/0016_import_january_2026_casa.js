/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const USER_ID = 'uc5jp6hewxu9yio'

    // Helper para gerar ID alfanumérico aleatório de 15 caracteres estilo PocketBase
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

    const nowIso = new Date().toISOString()

    // 4. Verificação de idempotência: Se já existirem transações para janeiro/2026 no controle Casa, pula.
    let existingJan2026Count = 0
    try {
      const existingJan2026 = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && date >= '2026-01-01' && date <= '2026-01-31'`,
        '',
        1,
        0,
      )
      if (existingJan2026 && existingJan2026.length > 0) {
        existingJan2026Count = existingJan2026.length
      }
    } catch (_) {}

    if (existingJan2026Count > 0) {
      console.log('Transações de janeiro/2026 já existem para o controle Casa. Pulando migração.')
      return
    }

    // 1. DELETAR todas as transações existentes do controle "Casa" (y9ewjfbhzoihnq0)
    app
      .db()
      .newQuery('DELETE FROM transactions WHERE control_id = {:controlId}')
      .bind({ controlId: CONTROL_ID })
      .execute()

    // 2. CRIAR 4 contas na collection accounts (ou reutilizar se existirem para idempotência)
    const accountsData = [
      { key: 'neon_fabricio', name: 'Neon Fabrício', type: 'banco', color: '#00E5A0' },
      { key: 'neon_raffaela', name: 'Neon Raffaela', type: 'banco', color: '#FF6B6B' },
      {
        key: 'neon_raffaela_credito',
        name: 'Neon Raffaela Crédito',
        type: 'credito',
        color: '#FF6B6B',
      },
      {
        key: 'santander_fabricio_credito',
        name: 'Santander Fabrício Crédito',
        type: 'credito',
        color: '#CC0000',
      },
    ]

    const accountIds = {}

    for (let i = 0; i < accountsData.length; i++) {
      const acc = accountsData[i]
      let existingAcc = null
      try {
        const found = app.findRecordsByFilter(
          'accounts',
          `control_id = '${CONTROL_ID}' && name = '${acc.name}'`,
          '',
          1,
          0,
        )
        if (found && found.length > 0) {
          existingAcc = found[0]
        }
      } catch (_) {}

      if (existingAcc) {
        accountIds[acc.key] = existingAcc.id
      } else {
        const newId = generateId()
        app
          .db()
          .newQuery(
            `INSERT INTO accounts (
              id,
              control_id,
              name,
              type,
              balance,
              color,
              created,
              updated
            ) VALUES (
              {:id},
              {:control_id},
              {:name},
              {:type},
              {:balance},
              {:color},
              {:created},
              {:updated}
            )`,
          )
          .bind({
            id: newId,
            control_id: CONTROL_ID,
            name: acc.name,
            type: acc.type,
            balance: 0,
            color: acc.color,
            created: nowIso,
            updated: nowIso,
          })
          .execute()
        accountIds[acc.key] = newId
      }
    }

    // IDs das categorias conhecidas
    const CAT_PESSOAL = '8zaixjgdmxhvttw'
    const CAT_SALARIO = '6tnq6xzo6jtyq3s'
    const CAT_TRANSPORTE = 'kh9ygz7tygpy3q6'
    const CAT_SAUDE = 'jbj8jvykxh2ik88'

    // Helper para inserir uma transação via newQuery
    const insertTransaction = (tx) => {
      const txId = tx.id || generateId()
      app
        .db()
        .newQuery(
          `INSERT INTO transactions (
            id,
            control_id,
            user_id,
            type,
            amount,
            description,
            category_id,
            account_id,
            date,
            paid,
            recurring,
            is_recurring,
            recurrence_type,
            installment_number,
            installment_total,
            parent_transaction_id,
            created,
            updated
          ) VALUES (
            {:id},
            {:control_id},
            {:user_id},
            {:type},
            {:amount},
            {:description},
            {:category_id},
            {:account_id},
            {:date},
            {:paid},
            {:recurring},
            {:is_recurring},
            {:recurrence_type},
            {:installment_number},
            {:installment_total},
            {:parent_transaction_id},
            {:created},
            {:updated}
          )`,
        )
        .bind({
          id: txId,
          control_id: CONTROL_ID,
          user_id: USER_ID,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          category_id: tx.category_id || '',
          account_id: tx.account_id || '',
          date: tx.date,
          paid: tx.paid ? 1 : 0,
          recurring: tx.recurring ? 1 : 0,
          is_recurring: tx.is_recurring ? 1 : 0,
          recurrence_type: tx.recurrence_type || '',
          installment_number: tx.installment_number !== undefined ? tx.installment_number : 0,
          installment_total: tx.installment_total !== undefined ? tx.installment_total : 0,
          parent_transaction_id: tx.parent_transaction_id || '',
          created: nowIso,
          updated: nowIso,
        })
        .execute()
      return txId
    }

    // 3. IMPORTAR TRANSAÇÕES

    // 3.1 Transação 1: Celular (Recorrente)
    // 2026-01-10, Neon Fabrício, Celular, 64.25, despesa, Pessoal
    insertTransaction({
      date: '2026-01-10 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Celular',
      amount: 64.25,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: true,
      recurring: true,
      recurrence_type: 'mensal',
      installment_number: 0,
      installment_total: 0,
    })

    // 3.2 Transação 2: Salário (Normal)
    // 2026-01-10, Neon Raffaela, Salário, 4600.00, receita, Salário
    insertTransaction({
      date: '2026-01-10 00:00:00.000Z',
      account_id: accountIds.neon_raffaela,
      description: 'Salário',
      amount: 4600.0,
      type: 'receita',
      category_id: CAT_SALARIO,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 0,
      installment_total: 0,
    })

    // 3.3 Transação 3: Transporte (Normal)
    // 2026-01-11, Neon Raffaela Crédito, Transporte, 25.43, despesa, Transporte
    insertTransaction({
      date: '2026-01-11 00:00:00.000Z',
      account_id: accountIds.neon_raffaela_credito,
      description: 'Transporte',
      amount: 25.43,
      type: 'despesa',
      category_id: CAT_TRANSPORTE,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 0,
      installment_total: 0,
    })

    // 3.4 Transação 4: Apple (Recorrente)
    // 2026-01-18, Santander Fabrício Crédito, Apple, 19.90, despesa, Pessoal
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Apple',
      amount: 19.9,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: true,
      recurring: true,
      recurrence_type: 'mensal',
      installment_number: 0,
      installment_total: 0,
    })

    // 3.5 Transação 5: Gympass (Recorrente)
    // 2026-01-18, Santander Fabrício Crédito, Gympass, 89.90, despesa, Saúde
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Gympass',
      amount: 89.9,
      type: 'despesa',
      category_id: CAT_SAUDE,
      paid: true,
      is_recurring: true,
      recurring: true,
      recurrence_type: 'mensal',
      installment_number: 0,
      installment_total: 0,
    })

    // 3.6 Transação 6: Uza (Parcelado - Parcela 8 de 10)
    // Parent: amount = 203.96 * 10 = 2039.60, installment_total = 10
    // Parcela Jan: amount = 203.96, installment_number = 8, installment_total = 10
    const parentUzaId = generateId()
    insertTransaction({
      id: parentUzaId,
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Uza',
      amount: 2039.6,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 0,
      installment_total: 10,
      parent_transaction_id: '',
    })

    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Uza',
      amount: 203.96,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 8,
      installment_total: 10,
      parent_transaction_id: parentUzaId,
    })

    // 3.7 Transação 7: Curso Terapeuta (Parcelado - Parcela 4 de 12)
    // Parent: amount = 498.72 * 12 = 5984.64, installment_total = 12
    // Parcela Jan: amount = 498.72, installment_number = 4, installment_total = 12
    const parentCursoId = generateId()
    insertTransaction({
      id: parentCursoId,
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Curso Terapeuta',
      amount: 5984.64,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 0,
      installment_total: 12,
      parent_transaction_id: '',
    })

    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Curso Terapeuta',
      amount: 498.72,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 4,
      installment_total: 12,
      parent_transaction_id: parentCursoId,
    })

    // 3.8 Transação 8: Coluna Alinhada (Parcelado - Parcela 3 de 3)
    // Parent: amount = 500.00 * 3 = 1500.00, installment_total = 3
    // Parcela Jan: amount = 500.00, installment_number = 3, installment_total = 3
    const parentColunaId = generateId()
    insertTransaction({
      id: parentColunaId,
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Coluna Alinhada',
      amount: 1500.0,
      type: 'despesa',
      category_id: CAT_SAUDE,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 0,
      installment_total: 3,
      parent_transaction_id: '',
    })

    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Coluna Alinhada',
      amount: 500.0,
      type: 'despesa',
      category_id: CAT_SAUDE,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 3,
      installment_total: 3,
      parent_transaction_id: parentColunaId,
    })

    // 3.9 Transação 9: Dentista Placa (Parcelado - Parcela 3 de 3)
    // Parent: amount = 1053.33 * 3 = 3160.00, installment_total = 3
    // Parcela Jan: amount = 1053.33, installment_number = 3, installment_total = 3
    const parentDentistaId = generateId()
    insertTransaction({
      id: parentDentistaId,
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Dentista Placa',
      amount: 3160.0,
      type: 'despesa',
      category_id: CAT_SAUDE,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 0,
      installment_total: 3,
      parent_transaction_id: '',
    })

    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Dentista Placa',
      amount: 1053.33,
      type: 'despesa',
      category_id: CAT_SAUDE,
      paid: true,
      is_recurring: false,
      recurring: false,
      recurrence_type: '',
      installment_number: 3,
      installment_total: 3,
      parent_transaction_id: parentDentistaId,
    })
  },
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    // Down migration: deletar transações de 2026 do controle Casa
    try {
      app
        .db()
        .newQuery(
          `DELETE FROM transactions 
           WHERE control_id = {:controlId} 
             AND date >= {:startDate} 
             AND date <= {:endDate}`,
        )
        .bind({
          controlId: CONTROL_ID,
          startDate: '2026-01-01',
          endDate: '2026-01-31',
        })
        .execute()
    } catch (_) {}
  },
)
