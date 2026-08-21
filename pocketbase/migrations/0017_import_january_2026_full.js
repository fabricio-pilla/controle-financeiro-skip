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

    // 1. Deletar TODAS as transações existentes e TODAS as contas antigas do controle "Casa"
    app
      .db()
      .newQuery('DELETE FROM transactions WHERE control_id = {:controlId}')
      .bind({ controlId: CONTROL_ID })
      .execute()

    app
      .db()
      .newQuery('DELETE FROM accounts WHERE control_id = {:controlId}')
      .bind({ controlId: CONTROL_ID })
      .execute()

    // 2. Criar 7 contas novas
    // 1. Neon Fabrício - tipo: banco (bank), cor: #10B981
    // 2. Neon Raffaela - tipo: banco (bank), cor: #EC4899
    // 3. Neon Fabrício Crédito - tipo: credito (credit), cor: #10B981
    // 4. Neon Raffaela Crédito - tipo: credito (credit), cor: #EC4899
    // 5. Santander Fabrício - tipo: banco (bank), cor: #EF4444
    // 6. Santander Fabrício Crédito - tipo: credito (credit), cor: #EF4444
    // 7. Flash - tipo: banco (bank), cor: #8B5CF6

    const accountsDefs = [
      { key: 'neon_fabricio', name: 'Neon Fabrício', type: 'banco', color: '#10B981' },
      { key: 'neon_raffaela', name: 'Neon Raffaela', type: 'banco', color: '#EC4899' },
      {
        key: 'neon_fabricio_credito',
        name: 'Neon Fabrício Crédito',
        type: 'credito',
        color: '#10B981',
      },
      {
        key: 'neon_raffaela_credito',
        name: 'Neon Raffaela Crédito',
        type: 'credito',
        color: '#EC4899',
      },
      { key: 'santander_fabricio', name: 'Santander Fabrício', type: 'banco', color: '#EF4444' },
      {
        key: 'santander_fabricio_credito',
        name: 'Santander Fabrício Crédito',
        type: 'credito',
        color: '#EF4444',
      },
      { key: 'flash', name: 'Flash', type: 'banco', color: '#8B5CF6' },
    ]

    const accountIds = {}

    for (let i = 0; i < accountsDefs.length; i++) {
      const acc = accountsDefs[i]
      const accId = generateId()
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
          id: accId,
          control_id: CONTROL_ID,
          name: acc.name,
          type: acc.type,
          balance: 0,
          color: acc.color,
          created: nowIso,
          updated: nowIso,
        })
        .execute()
      accountIds[acc.key] = accId
    }

    // Categorias do controle Casa
    // Despesas:
    const CAT_MORADIA = 'kxvqi2ra497737q'
    const CAT_ALIMENTACAO = 'iz62t6kb93nc6nl'
    const CAT_TRANSPORTE = 'kh9ygz7tygpy3q6'
    const CAT_SAUDE = 'jbj8jvykxh2ik88'
    const CAT_FILHOS = '7hkpxw7l79g5kqt'
    const CAT_PETS = 'r9v9sfd18j2albn'
    const CAT_LAZER = 'k5wo61de6ues5aj'
    const CAT_INVESTIMENTOS_DESPESA = 'b5xvx26xlghihne'
    const CAT_PESSOAL = '8zaixjgdmxhvttw'

    // Receitas:
    const CAT_SALARIO = '6tnq6xzo6jtyq3s'
    const CAT_INVESTIMENTOS_RECEITA = 'v79xgucyxeo93sb'
    const CAT_OUTROS = 'jkkx13t9b8oahx5'

    // Helper para inserir transação
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
            recurrence_period,
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
            {:recurrence_period},
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
          paid: tx.paid !== false ? 1 : 0,
          recurring: tx.is_recurring ? 1 : 0,
          is_recurring: tx.is_recurring ? 1 : 0,
          recurrence_type: tx.is_recurring ? 'mensal' : '',
          recurrence_period: tx.is_recurring ? 'mensal' : '',
          installment_number: tx.installment_number !== undefined ? tx.installment_number : 0,
          installment_total: tx.installment_total !== undefined ? tx.installment_total : 0,
          parent_transaction_id: tx.parent_transaction_id || '',
          created: nowIso,
          updated: nowIso,
        })
        .execute()
      return txId
    }

    // Helper para criar transação parcelada (pai + parcela)
    const insertInstallment = (parentTx, currentTx) => {
      const parentId = generateId()
      insertTransaction({
        id: parentId,
        date: currentTx.date,
        account_id: currentTx.account_id,
        description: parentTx.description,
        amount: parentTx.amount,
        type: currentTx.type,
        category_id: currentTx.category_id,
        paid: true,
        is_recurring: false,
        installment_number: 0,
        installment_total: parentTx.installment_total,
        parent_transaction_id: '',
      })

      insertTransaction({
        date: currentTx.date,
        account_id: currentTx.account_id,
        description: currentTx.description,
        amount: currentTx.amount,
        type: currentTx.type,
        category_id: currentTx.category_id,
        paid: true,
        is_recurring: false,
        installment_number: currentTx.installment_number,
        installment_total: currentTx.installment_total,
        parent_transaction_id: parentId,
      })
    }

    // ==========================================
    // 3. INSERÇÃO DAS TRANSAÇÕES DE JANEIRO/2026
    // ==========================================

    // 1. 01/01/2026 | Santander Fabricio | expense | Investimento | Financiamento Casa | 23/36 | 2501.31 | Parcelado
    // Categoria: Investimentos (despesa)
    insertInstallment(
      {
        description: 'Financiamento Casa (Total: R$ 90047.16)',
        amount: 0,
        installment_total: 36,
      },
      {
        date: '2026-01-01 00:00:00.000Z',
        account_id: accountIds.santander_fabricio,
        description: 'Financiamento Casa',
        amount: 2501.31,
        type: 'despesa',
        category_id: CAT_INVESTIMENTOS_DESPESA,
        installment_number: 23,
        installment_total: 36,
      },
    )

    // 2. 01/01/2026 | Flash | income | Fabrício | Salário | | 1400.91 | Recorrente
    // Categoria: Salário (receita)
    insertTransaction({
      date: '2026-01-01 00:00:00.000Z',
      account_id: accountIds.flash,
      description: 'Salário',
      amount: 1400.91,
      type: 'receita',
      category_id: CAT_SALARIO,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 3. 01/01/2026 | Flash | expense | Família | Supermercado | | 1400.91 | Recorrente
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-01 00:00:00.000Z',
      account_id: accountIds.flash,
      description: 'Supermercado',
      amount: 1400.91,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 4. 01/01/2026 | Neon Fabricio | expense | Família | Plano de Saúde (Cooparticipação) | | 25.62 | Recorrente
    // Categoria: Saúde
    insertTransaction({
      date: '2026-01-01 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Plano de Saúde (Cooparticipação)',
      amount: 25.62,
      type: 'despesa',
      category_id: CAT_SAUDE,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 5. 01/01/2026 | Neon Fabricio | expense | Helena | Pensão | | 550.00 | Recorrente
    // Categoria: Filhos
    insertTransaction({
      date: '2026-01-01 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Pensão',
      amount: 550.0,
      type: 'despesa',
      category_id: CAT_FILHOS,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 6. 01/01/2026 | Neon Fabricio | expense | Emanuel | Pensão | | 550.00 | Recorrente
    // Categoria: Filhos
    insertTransaction({
      date: '2026-01-01 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Pensão',
      amount: 550.0,
      type: 'despesa',
      category_id: CAT_FILHOS,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 7. 01/01/2026 | Neon Fabricio | income | Fabrício | Salário | | 5308.47 | Recorrente
    // Categoria: Salário (receita)
    insertTransaction({
      date: '2026-01-01 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Salário',
      amount: 5308.47,
      type: 'receita',
      category_id: CAT_SALARIO,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 8. 05/01/2026 | Neon Fabricio | expense | Helena | Diversos (CDB) | | 160.00 | Recorrente
    // Categoria: Filhos
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Diversos (CDB)',
      amount: 160.0,
      type: 'despesa',
      category_id: CAT_FILHOS,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 9. 05/01/2026 | Neon Fabricio | expense | Emanuel | Diversos (CDB) | | 160.00 | Recorrente
    // Categoria: Filhos
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Diversos (CDB)',
      amount: 160.0,
      type: 'despesa',
      category_id: CAT_FILHOS,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 10. 05/01/2026 | Neon Fabricio Crédito | expense | Família | Assinaturas (Spotify) | | 31.90 | Recorrente
    // Categoria: Lazer
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Assinaturas (Spotify)',
      amount: 31.9,
      type: 'despesa',
      category_id: CAT_LAZER,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 11. 05/01/2026 | Santander Fabricio | expense | Casa | Luz | | 204.81 | Recorrente
    // Categoria: Moradia
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.santander_fabricio,
      description: 'Luz',
      amount: 204.81,
      type: 'despesa',
      category_id: CAT_MORADIA,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 12. 05/01/2026 | Santander Fabricio | expense | Helena | Celular | | 67.53 | Recorrente
    // Categoria: Filhos
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.santander_fabricio,
      description: 'Celular',
      amount: 67.53,
      type: 'despesa',
      category_id: CAT_FILHOS,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 13. 05/01/2026 | Santander Fabricio | expense | Família | Lazer (Certidão Clube) | | 135.00 | Á Vista
    // Categoria: Lazer
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.santander_fabricio,
      description: 'Lazer (Certidão Clube)',
      amount: 135.0,
      type: 'despesa',
      category_id: CAT_LAZER,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 14. 05/01/2026 | Neon Fabricio Crédito | expense | Automóvel | Combustível | | 149.18 | Á Vista
    // Categoria: Transporte
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Combustível',
      amount: 149.18,
      type: 'despesa',
      category_id: CAT_TRANSPORTE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 15. 05/01/2026 | Neon Fabricio Crédito | expense | Família | Restaurantes/Delivery | | 18.00 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Restaurantes/Delivery',
      amount: 18.0,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 16. 05/01/2026 | Neon Fabricio Crédito | expense | Família | Restaurantes/Delivery | | 97.00 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Restaurantes/Delivery',
      amount: 97.0,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 17. 05/01/2026 | Neon Fabricio Crédito | expense | Família | Presentes | | 289.80 | Á Vista
    // Categoria: Lazer
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Presentes',
      amount: 289.8,
      type: 'despesa',
      category_id: CAT_LAZER,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 18. 05/01/2026 | Neon Fabricio Crédito | expense | Família | Presentes | | 296.60 | Á Vista
    // Categoria: Lazer
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Presentes',
      amount: 296.6,
      type: 'despesa',
      category_id: CAT_LAZER,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 19. 05/01/2026 | Neon Fabricio Crédito | expense | Família | Presentes | | 458.00 | Á Vista
    // Categoria: Lazer
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Presentes',
      amount: 458.0,
      type: 'despesa',
      category_id: CAT_LAZER,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 20. 05/01/2026 | Neon Fabricio Crédito | expense | Família | Supermercado | | 20.00 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Supermercado',
      amount: 20.0,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 21. 05/01/2026 | Neon Fabricio Crédito | expense | Família | Supermercado | | 20.00 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-05 00:00:00.000Z',
      account_id: accountIds.neon_fabricio_credito,
      description: 'Supermercado',
      amount: 20.0,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 22. 08/01/2026 | Neon Fabricio | expense | Casa | Água | | 145.01 | Recorrente
    // Categoria: Moradia
    insertTransaction({
      date: '2026-01-08 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Água',
      amount: 145.01,
      type: 'despesa',
      category_id: CAT_MORADIA,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 23. 10/01/2026 | Neon Fabricio | expense | Fabrício | Celular | | 64.25 | Recorrente
    // Categoria: Pessoal
    insertTransaction({
      date: '2026-01-10 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Celular',
      amount: 64.25,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 24. 10/01/2026 | Neon Fabricio | expense | Raffaela | Celular | | 64.25 | Recorrente
    // Categoria: Pessoal
    insertTransaction({
      date: '2026-01-10 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Celular',
      amount: 64.25,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 25. 10/01/2026 | Neon Fabricio | expense | Casa | Internet | | 133.40 | Recorrente
    // Categoria: Moradia
    insertTransaction({
      date: '2026-01-10 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Internet',
      amount: 133.4,
      type: 'despesa',
      category_id: CAT_MORADIA,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 26. 10/01/2026 | Neon Fabricio | expense | Matheus | Celular | | 64.25 | Recorrente
    // Categoria: Filhos
    insertTransaction({
      date: '2026-01-10 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Celular',
      amount: 64.25,
      type: 'despesa',
      category_id: CAT_FILHOS,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 27. 10/01/2026 | Neon Raffaela | income | Raffaela | Salário | | 4600.00 | Á Vista
    // Categoria: Salário (receita)
    insertTransaction({
      date: '2026-01-10 00:00:00.000Z',
      account_id: accountIds.neon_raffaela,
      description: 'Salário',
      amount: 4600.0,
      type: 'receita',
      category_id: CAT_SALARIO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 28. 11/01/2026 | Neon Raffaela Crédito | expense | Raffaela | Transporte | | 25.43 | Á Vista
    // Categoria: Pessoal
    insertTransaction({
      date: '2026-01-11 00:00:00.000Z',
      account_id: accountIds.neon_raffaela_credito,
      description: 'Transporte',
      amount: 25.43,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 29. 12/01/2026 | Neon Fabricio | expense | Automóvel | Impostos (IPVA) | 01/05 | 154.97 | Á Vista
    // Categoria: Transporte
    insertInstallment(
      {
        description: 'Impostos (IPVA) (Total: R$ 774.85)',
        amount: 0,
        installment_total: 5,
      },
      {
        date: '2026-01-12 00:00:00.000Z',
        account_id: accountIds.neon_fabricio,
        description: 'Impostos (IPVA)',
        amount: 154.97,
        type: 'despesa',
        category_id: CAT_TRANSPORTE,
        installment_number: 1,
        installment_total: 5,
      },
    )

    // 30. 13/01/2026 | Neon Fabricio | expense | Automóvel | Multas | | 299.98 | Á Vista
    // Categoria: Transporte
    insertTransaction({
      date: '2026-01-13 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Multas',
      amount: 299.98,
      type: 'despesa',
      category_id: CAT_TRANSPORTE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 31. 13/01/2026 | Neon Fabricio | expense | Automóvel | Impostos | | 94.61 | Á Vista
    // Categoria: Transporte
    insertTransaction({
      date: '2026-01-13 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Impostos',
      amount: 94.61,
      type: 'despesa',
      category_id: CAT_TRANSPORTE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 32. 13/01/2026 | Neon Fabricio | expense | Automóvel | Impostos | | 94.61 | Á Vista
    // Categoria: Transporte
    insertTransaction({
      date: '2026-01-13 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Impostos',
      amount: 94.61,
      type: 'despesa',
      category_id: CAT_TRANSPORTE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 33. 15/01/2026 | Neon Fabricio | income | Fabrício | Salário | | 6194.61 | Recorrente
    // Categoria: Salário (receita)
    insertTransaction({
      date: '2026-01-15 00:00:00.000Z',
      account_id: accountIds.neon_fabricio,
      description: 'Salário',
      amount: 6194.61,
      type: 'receita',
      category_id: CAT_SALARIO,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 34. 18/01/2026 | Santander Fabricio Crédito | expense | Fabrício | Educação (IOF GitHub) | | 1.97 | Recorrente
    // Categoria: Pessoal
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Educação (IOF GitHub)',
      amount: 1.97,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 35. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Restaurantes/Delivery | | 4.00 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Restaurantes/Delivery',
      amount: 4.0,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 36. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Restaurantes/Delivery | | 5.00 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Restaurantes/Delivery',
      amount: 5.0,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 37. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Restaurantes/Delivery | | 5.59 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Restaurantes/Delivery',
      amount: 5.59,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 38. 18/01/2026 | Santander Fabricio Crédito | expense | Fabrício | Celular (Apple) | | 5.90 | Recorrente
    // Categoria: Pessoal
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Celular (Apple)',
      amount: 5.9,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 39. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Restaurantes/Delivery (Clube Ifood) | | 5.95 | Recorrente
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Restaurantes/Delivery (Clube Ifood)',
      amount: 5.95,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 40. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Restaurantes/Delivery | | 9.98 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Restaurantes/Delivery',
      amount: 9.98,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 41. 18/01/2026 | Santander Fabricio Crédito | expense | Automóvel | Estacionamento/Pedágio | | 10.00 | Á Vista
    // Categoria: Transporte
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Estacionamento/Pedágio',
      amount: 10.0,
      type: 'despesa',
      category_id: CAT_TRANSPORTE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 42. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Restaurantes/Delivery | | 11.98 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Restaurantes/Delivery',
      amount: 11.98,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 43. 18/01/2026 | Santander Fabricio Crédito | expense | Automóvel | Combustível | | 17.00 | Á Vista
    // Categoria: Transporte
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Combustível',
      amount: 17.0,
      type: 'despesa',
      category_id: CAT_TRANSPORTE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 44. 18/01/2026 | Santander Fabricio Crédito | expense | Casa | Manutenção | | 17.55 | Á Vista
    // Categoria: Moradia
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Manutenção',
      amount: 17.55,
      type: 'despesa',
      category_id: CAT_MORADIA,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 45. 18/01/2026 | Santander Fabricio Crédito | expense | Casa | Decoração/Utensílios | | 18.00 | Á Vista
    // Categoria: Moradia
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Decoração/Utensílios',
      amount: 18.0,
      type: 'despesa',
      category_id: CAT_MORADIA,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 46. 18/01/2026 | Santander Fabricio Crédito | expense | Raffaela | Celular (Apple) | | 19.90 | Recorrente
    // Categoria: Pessoal
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Celular (Apple)',
      amount: 19.9,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 47. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Restaurantes/Delivery | | 21.50 | Á Vista
    // Categoria: Alimentação
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Restaurantes/Delivery',
      amount: 21.5,
      type: 'despesa',
      category_id: CAT_ALIMENTACAO,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 48. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Farmácia | | 23.49 | Á Vista
    // Categoria: Saúde
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Farmácia',
      amount: 23.49,
      type: 'despesa',
      category_id: CAT_SAUDE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 49. 18/01/2026 | Santander Fabricio Crédito | expense | Casa | Manutenção | | 26.60 | Á Vista
    // Categoria: Moradia
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Manutenção',
      amount: 26.6,
      type: 'despesa',
      category_id: CAT_MORADIA,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 50. 18/01/2026 | Santander Fabricio Crédito | expense | Família | Farmácia | | 27.89 | Á Vista
    // Categoria: Saúde
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Farmácia',
      amount: 27.89,
      type: 'despesa',
      category_id: CAT_SAUDE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 51. 18/01/2026 | Santander Fabricio Crédito | expense | Automóvel | Combustível | | 30.00 | Á Vista
    // Categoria: Transporte
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Combustível',
      amount: 30.0,
      type: 'despesa',
      category_id: CAT_TRANSPORTE,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // 52. 18/01/2026 | Santander Fabricio Crédito | expense | Matheus | Alimentação | | 33.49 | Á Vista
    // Categoria: Filhos
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Alimentação',
      amount: 33.49,
      type: 'despesa',
      category_id: CAT_FILHOS,
      paid: true,
      is_recurring: false,
      installment_number: 0,
      installment_total: 0,
    })

    // =========================================================================
    // 5 REGISTROS ADICIONAIS EXISTENTES NA BASE / PLANILHA
    // =========================================================================

    // 53. 18/01/2026 | Santander Fabricio Crédito | Raffaela | Exercícios | Gympass | 89.90 | Recorrente
    // Categoria: Pessoal
    insertTransaction({
      date: '2026-01-18 00:00:00.000Z',
      account_id: accountIds.santander_fabricio_credito,
      description: 'Gympass',
      amount: 89.9,
      type: 'despesa',
      category_id: CAT_PESSOAL,
      paid: true,
      is_recurring: true,
      installment_number: 0,
      installment_total: 0,
    })

    // 54. 18/01/2026 | Santander Fabricio Crédito | Raffaela | Roupas e Acessórios | Uza | 08/10 | 203.96 | Parcelado
    // Categoria: Pessoal
    insertInstallment(
      {
        description: 'Uza (Total: R$ 2039.60)',
        amount: 0,
        installment_total: 10,
      },
      {
        date: '2026-01-18 00:00:00.000Z',
        account_id: accountIds.santander_fabricio_credito,
        description: 'Uza',
        amount: 203.96,
        type: 'despesa',
        category_id: CAT_PESSOAL,
        installment_number: 8,
        installment_total: 10,
      },
    )

    // 55. 18/01/2026 | Santander Fabricio Crédito | Raffaela | Educação | Curso Terapeuta | 04/12 | 498.72 | Parcelado
    // Categoria: Pessoal
    insertInstallment(
      {
        description: 'Curso Terapeuta (Total: R$ 5984.64)',
        amount: 0,
        installment_total: 12,
      },
      {
        date: '2026-01-18 00:00:00.000Z',
        account_id: accountIds.santander_fabricio_credito,
        description: 'Curso Terapeuta',
        amount: 498.72,
        type: 'despesa',
        category_id: CAT_PESSOAL,
        installment_number: 4,
        installment_total: 12,
      },
    )

    // 56. 18/01/2026 | Santander Fabricio Crédito | Raffaela | Médicos / Psicólogos | Coluna Alinhada | 03/03 | 500.00 | Parcelado
    // Categoria: Pessoal
    insertInstallment(
      {
        description: 'Coluna Alinhada (Total: R$ 1500.00)',
        amount: 0,
        installment_total: 3,
      },
      {
        date: '2026-01-18 00:00:00.000Z',
        account_id: accountIds.santander_fabricio_credito,
        description: 'Coluna Alinhada',
        amount: 500.0,
        type: 'despesa',
        category_id: CAT_PESSOAL,
        installment_number: 3,
        installment_total: 3,
      },
    )

    // 57. 18/01/2026 | Santander Fabricio Crédito | Raffaela | Médicos / Psicólogos | Dentista Placa | 03/03 | 1053.33 | Parcelado
    // Categoria: Pessoal
    insertInstallment(
      {
        description: 'Dentista Placa (Total: R$ 3159.99)',
        amount: 0,
        installment_total: 3,
      },
      {
        date: '2026-01-18 00:00:00.000Z',
        account_id: accountIds.santander_fabricio_credito,
        description: 'Dentista Placa',
        amount: 1053.33,
        type: 'despesa',
        category_id: CAT_PESSOAL,
        installment_number: 3,
        installment_total: 3,
      },
    )
  },
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    try {
      app
        .db()
        .newQuery('DELETE FROM transactions WHERE control_id = {:controlId}')
        .bind({ controlId: CONTROL_ID })
        .execute()

      app
        .db()
        .newQuery('DELETE FROM accounts WHERE control_id = {:controlId}')
        .bind({ controlId: CONTROL_ID })
        .execute()
    } catch (_) {}
  },
)
