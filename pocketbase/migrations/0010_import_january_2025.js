/// <reference path="../pb_data/types.d.ts" />

// Migration 0010: Importação das transações de Janeiro/2025 para o controle "Casa"

migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const USER_ID = 'uc5jp6hewxu9yio'
    const USER_EMAIL = 'fabricio.pilla@gmail.com'

    // 1. Verificar se o controle "Casa" existe (ID: y9ewjfbhzoihnq0)
    let control = null
    try {
      control = app.findFirstRecordByData('financial_controls', 'id', CONTROL_ID)
    } catch (_) {
      try {
        const controls = app.findRecordsByFilter(
          'financial_controls',
          `id = '${CONTROL_ID}'`,
          '',
          1,
          0,
        )
        if (controls && controls.length > 0) {
          control = controls[0]
        }
      } catch (_) {}
    }

    if (!control) {
      throw new Error(`Controle financeiro "Casa" (ID: ${CONTROL_ID}) não foi encontrado.`)
    }

    // 2. Verificar se o usuário fabricio.pilla@gmail.com existe (ID: uc5jp6hewxu9yio)
    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', USER_EMAIL)
    } catch (_) {
      try {
        user = app.findFirstRecordByData('users', 'id', USER_ID)
      } catch (_) {
        throw new Error(`Usuário ${USER_EMAIL} (ID: ${USER_ID}) não foi encontrado.`)
      }
    }

    if (!user) {
      throw new Error(`Usuário ${USER_EMAIL} (ID: ${USER_ID}) não foi encontrado.`)
    }

    // 3. Verificar se já existem transações para jan/2025 no controle antes de inserir (usar COUNT)
    // Se já existirem, pular (return early)
    let existingJanCount = 0
    try {
      const janTxs = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && date >= '2025-01-01' && date <= '2025-01-31'`,
        '',
        1,
        0,
      )
      if (janTxs && janTxs.length > 0) {
        existingJanCount = janTxs.length
      }
    } catch (_) {}

    if (existingJanCount > 0) {
      console.log(
        `Transações de janeiro/2025 já existem no controle ${CONTROL_ID}. Pulando importação.`,
      )
      return
    }

    // 4. Verificar se as categorias existem. Se não, criar.
    const expectedCategories = [
      { id: 'kxvqi2ra497737q', name: 'Moradia', type: 'despesa', color: '#EF4444', icon: 'Home' },
      {
        id: 'iz62t6kb93nc6nl',
        name: 'Alimentação',
        type: 'despesa',
        color: '#F97316',
        icon: 'Utensils',
      },
      { id: 'r9v9sfd18j2albn', name: 'Pets', type: 'despesa', color: '#10B981', icon: 'PawPrint' },
      { id: 'kh9ygz7tygpy3q6', name: 'Transporte', type: 'despesa', color: '#F59E0B', icon: 'Car' },
      {
        id: 'b5xvx26xlghihne',
        name: 'Investimentos',
        type: 'despesa',
        color: '#6366F1',
        icon: 'TrendingUp',
      },
      { id: '7hkpxw7l79g5kqt', name: 'Filhos', type: 'despesa', color: '#8B5CF6', icon: 'Baby' },
      { id: '8zaixjgdmxhvttw', name: 'Pessoal', type: 'despesa', color: '#64748B', icon: 'User' },
      {
        id: '6tnq6xzo6jtyq3s',
        name: 'Salário',
        type: 'receita',
        color: '#10B981',
        icon: 'Briefcase',
      },
      {
        id: 'v79xgucyxeo93sb',
        name: 'Investimentos',
        type: 'receita',
        color: '#8B5CF6',
        icon: 'TrendingUp',
      },
    ]

    const categoriesCol = app.findCollectionByNameOrId('categories')
    const nowIso = new Date().toISOString()

    for (let i = 0; i < expectedCategories.length; i++) {
      const cat = expectedCategories[i]
      let exists = false
      try {
        const found = app.findFirstRecordByData('categories', 'id', cat.id)
        if (found) exists = true
      } catch (_) {}

      if (!exists) {
        try {
          const recs = app.findRecordsByFilter(
            'categories',
            `control_id = '${CONTROL_ID}' && name = '${cat.name}' && type = '${cat.type}'`,
            '',
            1,
            0,
          )
          if (recs && recs.length > 0) {
            exists = true
          }
        } catch (_) {}
      }

      if (!exists) {
        const rec = new Record(categoriesCol)
        rec.set('id', cat.id)
        rec.set('control_id', CONTROL_ID)
        rec.set('name', cat.name)
        rec.set('type', cat.type)
        rec.set('color', cat.color)
        rec.set('icon', cat.icon)
        rec.set('is_default', true)
        app.save(rec)
      }
    }

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

    // 5. Lista de transações de janeiro/2025 para importar
    const transactionsToImport = [
      // RECEITAS
      {
        description: 'Salário Fabrício',
        category_id: '6tnq6xzo6jtyq3s',
        type: 'receita',
        amount: 1847700,
        date: '2025-01-05',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Salário Raffaela',
        category_id: '6tnq6xzo6jtyq3s',
        type: 'receita',
        amount: 460000,
        date: '2025-01-05',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Rendimentos de Investimentos',
        category_id: 'v79xgucyxeo93sb',
        type: 'receita',
        amount: 3559700,
        date: '2025-01-31',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      // DESPESAS
      {
        description: 'Aluguel e contas da casa',
        category_id: 'kxvqi2ra497737q',
        type: 'despesa',
        amount: 278900,
        date: '2025-01-10',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Supermercado e feira do mês',
        category_id: 'iz62t6kb93nc6nl',
        type: 'despesa',
        amount: 900900,
        date: '2025-01-15',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Ração e pet shop',
        category_id: 'r9v9sfd18j2albn',
        type: 'despesa',
        amount: 37800,
        date: '2025-01-20',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Combustível e manutenção carro',
        category_id: 'kh9ygz7tygpy3q6',
        type: 'despesa',
        amount: 114300,
        date: '2025-01-10',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Aporte mensal investimentos',
        category_id: 'b5xvx26xlghihne',
        type: 'despesa',
        amount: 716500,
        date: '2025-01-30',
        is_recurring: true,
        recurring: true,
        recurrence_type: 'mensal',
      },
      {
        description: 'Gastos Emanuel',
        category_id: '7hkpxw7l79g5kqt',
        type: 'despesa',
        amount: 88200,
        date: '2025-01-15',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Gastos pessoais Fabrício',
        category_id: '8zaixjgdmxhvttw',
        type: 'despesa',
        amount: 88000,
        date: '2025-01-20',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Gastos Helena',
        category_id: '7hkpxw7l79g5kqt',
        type: 'despesa',
        amount: 128900,
        date: '2025-01-15',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Gastos Matheus',
        category_id: '7hkpxw7l79g5kqt',
        type: 'despesa',
        amount: 73400,
        date: '2025-01-15',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
      {
        description: 'Gastos pessoais Raffaela',
        category_id: '8zaixjgdmxhvttw',
        type: 'despesa',
        amount: 245500,
        date: '2025-01-20',
        is_recurring: false,
        recurring: false,
        recurrence_type: null,
      },
    ]

    // 6. Inserir dados usando $app.db().newQuery()
    for (let i = 0; i < transactionsToImport.length; i++) {
      const tx = transactionsToImport[i]
      const id = generateId()
      const txCreated = nowIso
      const txUpdated = nowIso

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
            date,
            paid,
            recurring,
            is_recurring,
            recurrence_type,
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
            {:date},
            {:paid},
            {:recurring},
            {:is_recurring},
            {:recurrence_type},
            {:created},
            {:updated}
          )`,
        )
        .bind({
          id: id,
          control_id: CONTROL_ID,
          user_id: USER_ID,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          category_id: tx.category_id,
          date: tx.date,
          paid: 1,
          recurring: tx.recurring ? 1 : 0,
          is_recurring: tx.is_recurring ? 1 : 0,
          recurrence_type: tx.recurrence_type || '',
          created: txCreated,
          updated: txUpdated,
        })
        .execute()
    }
  },
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const USER_ID = 'uc5jp6hewxu9yio'

    // Rollback: Remover transações de jan/2025 deste controle e usuário
    try {
      app
        .db()
        .newQuery(
          `DELETE FROM transactions 
           WHERE control_id = {:controlId} 
             AND user_id = {:userId} 
             AND date >= {:startDate} 
             AND date <= {:endDate}`,
        )
        .bind({
          controlId: CONTROL_ID,
          userId: USER_ID,
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        })
        .execute()
    } catch (_) {}
  },
)
