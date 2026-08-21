migrate(
  (app) => {
    const CONTROL_ID = 'c22txbyfbjqxk0o'
    const CARLOS_USER_ID = 'wgr2b9cd097862r'
    const CARLOS_EMAIL = 'carlos@empresa.com.br'

    // 1. ADICIONA CARLOS COMO MEMBRO DO CONTROLE "CASA"
    const membersCol = app.findCollectionByNameOrId('control_members')
    let memberExists = false
    try {
      const existingMembers = app.findRecordsByFilter(
        'control_members',
        `control_id = '${CONTROL_ID}' && (user_id = '${CARLOS_USER_ID}' || email = '${CARLOS_EMAIL}')`,
        '',
        1,
      )
      if (existingMembers && existingMembers.length > 0) {
        memberExists = true
      }
    } catch (_) {
      // not found or filter error, proceed
    }

    if (!memberExists) {
      const newMember = new Record(membersCol)
      newMember.set('control_id', CONTROL_ID)
      newMember.set('user_id', CARLOS_USER_ID)
      newMember.set('email', CARLOS_EMAIL)
      newMember.set('role', 'admin')
      newMember.set('status', 'active')
      app.save(newMember)
    }

    // 2. SUBSTITUI AS CATEGORIAS DO CONTROLE "CASA"
    // Deletar categorias existentes do controle
    try {
      const oldCategories = app.findRecordsByFilter(
        'categories',
        `control_id = '${CONTROL_ID}'`,
        '',
        100,
      )
      oldCategories.forEach((cat) => {
        app.delete(cat)
      })
    } catch (_) {}

    // Criar as 12 categorias
    const categoriesCol = app.findCollectionByNameOrId('categories')

    const newCategoriesData = [
      // Despesas
      { name: 'Moradia', type: 'despesa', color: '#EF4444', icon: 'Home' },
      { name: 'Alimentação', type: 'despesa', color: '#F97316', icon: 'Utensils' },
      { name: 'Transporte', type: 'despesa', color: '#F59E0B', icon: 'Car' },
      { name: 'Saúde', type: 'despesa', color: '#EC4899', icon: 'Heart' },
      { name: 'Filhos', type: 'despesa', color: '#8B5CF6', icon: 'Baby' },
      { name: 'Pets', type: 'despesa', color: '#10B981', icon: 'PawPrint' },
      { name: 'Lazer', type: 'despesa', color: '#06B6D4', icon: 'Gamepad2' },
      { name: 'Investimentos', type: 'despesa', color: '#6366F1', icon: 'TrendingUp' },
      { name: 'Pessoal', type: 'despesa', color: '#64748B', icon: 'User' },
      // Receitas
      { name: 'Salário', type: 'receita', color: '#10B981', icon: 'Briefcase' },
      { name: 'Investimentos', type: 'receita', color: '#8B5CF6', icon: 'TrendingUp' },
      { name: 'Outros', type: 'receita', color: '#64748B', icon: 'PlusCircle' },
    ]

    newCategoriesData.forEach((catData) => {
      const rec = new Record(categoriesCol)
      rec.set('control_id', CONTROL_ID)
      rec.set('name', catData.name)
      rec.set('type', catData.type)
      rec.set('color', catData.color)
      rec.set('icon', catData.icon)
      rec.set('is_default', true)
      app.save(rec)
    })

    // Mapeamento dinâmico de categorias recém-criadas: `${name}:${type}` -> id
    const createdCategories = app.findRecordsByFilter(
      'categories',
      `control_id = '${CONTROL_ID}'`,
      '',
      100,
    )
    const categoryMap = {}
    createdCategories.forEach((cat) => {
      categoryMap[`${cat.get('name')}:${cat.get('type')}`] = cat.id
    })

    // 3. IMPORTA TRANSAÇÕES DA PLANILHA (Jan a Dez de 2025)
    // Deletar transações existentes do controle para manter idempotência
    try {
      const existingTxs = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}'`,
        '',
        500,
      )
      existingTxs.forEach((tx) => {
        app.delete(tx)
      })
    } catch (_) {}

    const transactionsCol = app.findCollectionByNameOrId('transactions')

    const months = [
      '2025-01-01',
      '2025-02-01',
      '2025-03-01',
      '2025-04-01',
      '2025-05-01',
      '2025-06-01',
      '2025-07-01',
      '2025-08-01',
      '2025-09-01',
      '2025-10-01',
      '2025-11-01',
      '2025-12-01',
    ]

    // Definir as séries de transações da planilha
    const transactionSeries = [
      // DESPESAS
      {
        description: 'Despesas com moradia',
        categoryName: 'Moradia',
        type: 'despesa',
        values: [2789, 4095, 10192, 3471, 4277, 2686, 3264, 2899, 2415, 2019, 1870, 1373],
      },
      {
        description: 'Alimentação e supermercado',
        categoryName: 'Alimentação',
        type: 'despesa',
        values: [9009, 9666, 7865, 12478, 6871, 9291, 8800, 3273, 1978, 1978, 1978, 1978],
      },
      {
        description: 'Animais de estimação',
        categoryName: 'Pets',
        type: 'despesa',
        values: [378, 734, 304, 377, 0, 682, 756, 0, 0, 0, 0, 0],
      },
      {
        description: 'Despesas com automóvel',
        categoryName: 'Transporte',
        type: 'despesa',
        values: [1143, 1817, 1307, 1049, 3887, 2893, 4963, 3346, 2180, 2180, 2180, 2180],
      },
      {
        description: 'Investimentos e aportes',
        categoryName: 'Investimentos',
        type: 'despesa',
        recurring: true,
        recurrence_type: 'mensal',
        values: [7165, 7165, 7165, 7165, 7165, 7165, 7165, 7165, 7165, 7165, 7165, 7165],
      },
      {
        description: 'Emanuel',
        categoryName: 'Filhos',
        type: 'despesa',
        values: [882, 710, 1310, 865, 860, 1721, 1513, 710, 710, 710, 710, 710],
      },
      {
        description: 'Fabrício — gastos pessoais',
        categoryName: 'Pessoal',
        type: 'despesa',
        values: [880, 1020, 1371, 1480, 1754, 1511, 4560, 1353, 1078, 928, 928, 928],
      },
      {
        description: 'Fast Escova',
        categoryName: 'Pessoal',
        type: 'despesa',
        values: [0, 0, 0, 0, 0, 0, 0, 71, 0, 0, 0, 0],
      },
      {
        description: 'Helena',
        categoryName: 'Filhos',
        type: 'despesa',
        values: [1289, 1417, 1208, 2419, 904, 1053, 825, 760, 760, 760, 760, 760],
      },
      {
        description: 'Matheus',
        categoryName: 'Filhos',
        type: 'despesa',
        values: [734, 1772, 2152, 1165, 705, 1403, 664, 428, 428, 299, 299, 299],
      },
      {
        description: 'Raffaela — gastos pessoais',
        categoryName: 'Pessoal',
        type: 'despesa',
        values: [2455, 1838, 2216, 2859, 4451, 3185, 5015, 2103, 1764, 1265, 1265, 1265],
      },

      // RECEITAS
      {
        description: 'Salário Fabrício',
        categoryName: 'Salário',
        type: 'receita',
        values: [
          18477, 20975, 25657, 25465, 24901, 25155, 29185, 24458, 20286, 20286, 20286, 20286,
        ],
      },
      {
        description: 'Salário Raffaela',
        categoryName: 'Salário',
        type: 'receita',
        values: [4600, 0, 0, 0, 1445, 90, 0, 0, 0, 0, 0, 0],
      },
      {
        description: 'Rendimento de investimentos',
        categoryName: 'Investimentos',
        type: 'receita',
        values: [35597, 8379, 26930, 555, 0, 19115, 0, 0, 0, 0, 0, 0],
      },
    ]

    transactionSeries.forEach((series) => {
      const catKey = `${series.categoryName}:${series.type}`
      const categoryId = categoryMap[catKey] || ''

      series.values.forEach((val, idx) => {
        // Regra especial: Valores 0 (zero) ou negativos NÃO devem gerar transação
        if (val <= 0) return

        const txDate = months[idx]

        const tx = new Record(transactionsCol)
        tx.set('control_id', CONTROL_ID)
        tx.set('user_id', CARLOS_USER_ID)
        tx.set('type', series.type)
        tx.set('amount', val)
        tx.set('description', series.description)
        tx.set('category_id', categoryId)
        tx.set('date', txDate)
        tx.set('paid', true)

        if (series.recurring) {
          tx.set('recurring', true)
          tx.set('is_recurring', true)
          tx.set('recurrence_type', series.recurrence_type)
          tx.set('recurrence_period', series.recurrence_type)
        }

        app.save(tx)
      })
    })
  },
  (app) => {
    const CONTROL_ID = 'c22txbyfbjqxk0o'
    const CARLOS_USER_ID = 'wgr2b9cd097862r'
    const CARLOS_EMAIL = 'carlos@empresa.com.br'

    // Rollback: Remover transações criadas para este controle
    try {
      const txs = app.findRecordsByFilter(
        'transactions',
        `control_id = '${CONTROL_ID}' && user_id = '${CARLOS_USER_ID}'`,
        '',
        500,
      )
      txs.forEach((tx) => app.delete(tx))
    } catch (_) {}

    // Rollback: Remover membro Carlos deste controle
    try {
      const members = app.findRecordsByFilter(
        'control_members',
        `control_id = '${CONTROL_ID}' && (user_id = '${CARLOS_USER_ID}' || email = '${CARLOS_EMAIL}')`,
        '',
        10,
      )
      members.forEach((m) => app.delete(m))
    } catch (_) {}
  },
)
