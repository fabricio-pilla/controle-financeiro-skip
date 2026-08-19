migrate(
  (app) => {
    // Only seed if there are already companies (avoid double-seeding)
    try {
      const existing = app.findRecordsByFilter('companies', '1=1', '', 1)
      if (existing && existing.length > 0) return
    } catch (_) {
      // ignore and proceed
    }

    const usersCol = app.findCollectionByNameOrId('users')
    const companiesCol = app.findCollectionByNameOrId('companies')
    const membersCol = app.findCollectionByNameOrId('company_members')
    const accountsCol = app.findCollectionByNameOrId('accounts')
    const categoriesCol = app.findCollectionByNameOrId('categories')
    const transactionsCol = app.findCollectionByNameOrId('transactions')

    const PASSWORD = '12345678'
    const now = new Date()
    const daysAgo = (d) => new Date(now.getTime() - 1000 * 60 * 60 * 24 * d).toISOString()
    const dateAgo = (d) =>
      new Date(now.getTime() - 1000 * 60 * 60 * 24 * d).toISOString().split('T')[0]

    // --- Users ---
    const mkUser = (name, email) => {
      const r = new Record(usersCol, { name, email, password: PASSWORD, passwordConfirm: PASSWORD })
      app.save(r)
      return r.id
    }
    const carlosId = mkUser('Carlos Henrique', 'carlos@empresa.com.br')
    const marinaId = mkUser('Marina Silveira', 'marina@empresa.com.br')
    const lucasId = mkUser('Lucas Ferreira', 'lucas@empresa.com.br')

    // email -> userId map (for invites / membership resolution)
    const emailToId = {
      'carlos@empresa.com.br': carlosId,
      'marina@empresa.com.br': marinaId,
      'lucas@empresa.com.br': lucasId,
    }

    // --- Companies ---
    const mkCompany = (name, segment, color, description, ownerId) => {
      const r = new Record(companiesCol, { name, segment, color, description, owner_id: ownerId })
      app.save(r)
      return r.id
    }
    const techId = mkCompany(
      'Nexus Soluções Digitais',
      'Tecnologia',
      '#6366F1',
      'Software house especializada em desenvolvimento de plataformas digitais, aplicativos e infraestrutura cloud para fintechs e e-commerce.',
      carlosId,
    )
    const varejoId = mkCompany(
      'Aurora Comércio & Design',
      'Varejo',
      '#10B981',
      'Loja de mobiliário planejado e artigos de decoração com showroom físico, atuando no varejo de design de interiores e ambientação sob medida.',
      carlosId,
    )

    // --- Members ---
    const mkMember = (companyId, userId, email, role, status) => {
      const r = new Record(membersCol, {
        company_id: companyId,
        user_id: userId,
        email,
        role,
        status,
      })
      app.save(r)
    }
    mkMember(techId, carlosId, 'carlos@empresa.com.br', 'owner', 'active')
    mkMember(techId, marinaId, 'marina@empresa.com.br', 'admin', 'active')
    mkMember(techId, lucasId, 'lucas@empresa.com.br', 'member', 'active')
    mkMember(varejoId, carlosId, 'carlos@empresa.com.br', 'owner', 'active')
    mkMember(varejoId, marinaId, 'marina@empresa.com.br', 'member', 'active')
    mkMember(varejoId, lucasId, 'lucas@empresa.com.br', 'admin', 'active')

    // --- Default categories ---
    const DEFAULT_EXPENSE = [
      { name: 'Aluguel', color: '#EF4444', icon: 'Home' },
      { name: 'Salários', color: '#F97316', icon: 'Users' },
      { name: 'Fornecedores', color: '#F59E0B', icon: 'Truck' },
      { name: 'Marketing', color: '#EC4899', icon: 'Megaphone' },
      { name: 'Impostos', color: '#8B5CF6', icon: 'Receipt' },
      { name: 'Transporte', color: '#06B6D4', icon: 'Car' },
      { name: 'Material de escritório', color: '#6366F1', icon: 'FileText' },
      { name: 'Utilidades', color: '#10B981', icon: 'Zap' },
      { name: 'Outros', color: '#64748B', icon: 'MoreHorizontal' },
    ]
    const DEFAULT_INCOME = [
      { name: 'Vendas', color: '#10B981', icon: 'ShoppingBag' },
      { name: 'Serviços', color: '#06B6D4', icon: 'Briefcase' },
      { name: 'Investimentos', color: '#8B5CF6', icon: 'TrendingUp' },
      { name: 'Outros', color: '#64748B', icon: 'PlusCircle' },
    ]

    const catMap = {} // key `${companyId}:${name}:${type}` -> id
    const seedCategories = (companyId) => {
      DEFAULT_EXPENSE.forEach((item) => {
        const r = new Record(categoriesCol, {
          company_id: companyId,
          name: item.name,
          type: 'despesa',
          color: item.color,
          icon: item.icon,
          is_default: true,
        })
        app.save(r)
        catMap[`${companyId}:${item.name}:despesa`] = r.id
      })
      DEFAULT_INCOME.forEach((item) => {
        const r = new Record(categoriesCol, {
          company_id: companyId,
          name: item.name,
          type: 'receita',
          color: item.color,
          icon: item.icon,
          is_default: true,
        })
        app.save(r)
        catMap[`${companyId}:${item.name}:receita`] = r.id
      })
    }
    seedCategories(techId)
    seedCategories(varejoId)

    // --- Accounts ---
    const mkAccount = (companyId, name, type, balance, color, bank, limit) => {
      const data = { company_id: companyId, name, type, balance, color, bank }
      if (limit !== undefined) data.limit = limit
      const r = new Record(accountsCol, data)
      app.save(r)
      return r.id
    }
    const accTech1 = mkAccount(
      techId,
      'Banco Itaú PJ',
      'banco',
      84520.5,
      '#F97316',
      'Itaú Unibanco',
    )
    const accTech2 = mkAccount(techId, 'Nubank PJ / Pix', 'pix', 29400.0, '#8B5CF6', 'Nubank')
    const accTech3 = mkAccount(
      techId,
      'Cartão Corporativo XP',
      'credito',
      14280.0,
      '#06B6D4',
      'XP Investimentos',
      50000.0,
    )
    const accTech4 = mkAccount(
      techId,
      'Reserva Selic 100%',
      'investimento',
      150000.0,
      '#10B981',
      'BTG Pactual',
    )
    const accVarejo1 = mkAccount(
      varejoId,
      'Bradesco Comercial',
      'banco',
      42100.0,
      '#EF4444',
      'Banco Bradesco',
    )
    const accVarejo2 = mkAccount(
      varejoId,
      'Caixa da Loja Física',
      'carteira',
      3850.0,
      '#10B981',
      'Caixa Interno',
    )

    // --- Transactions ---
    const mkTx = (
      companyId,
      userId,
      type,
      amount,
      description,
      catName,
      accId,
      days,
      recurring,
    ) => {
      const catKey = `${companyId}:${catName}:${type}`
      const r = new Record(transactionsCol, {
        company_id: companyId,
        user_id: userId,
        type,
        amount,
        description,
        category_id: catMap[catKey] || '',
        account_id: accId,
        date: dateAgo(days),
        paid: true,
        is_recurring: !!recurring,
        recurrence_type: recurring ? 'mensal' : '',
      })
      app.save(r)
    }

    // Tech transactions
    const techTx = [
      ['Contrato Mensal - Fintech Alfa', 32000, 'receita', 'Serviços', accTech1, 2, carlosId, true],
      [
        'Desenvolvimento App Mobile - Beta Corp',
        45000,
        'receita',
        'Serviços',
        accTech2,
        5,
        marinaId,
        false,
      ],
      [
        'Folha de Pagamento - Equipe Dev',
        28500,
        'despesa',
        'Salários',
        accTech1,
        6,
        carlosId,
        true,
      ],
      ['Aluguel Escritório Coworking', 5200, 'despesa', 'Aluguel', accTech1, 8, carlosId, true],
      [
        'Servidores AWS & Cloud Computing',
        4320.5,
        'despesa',
        'Utilidades',
        accTech3,
        10,
        marinaId,
        false,
      ],
      [
        'Campanha Google Ads & LinkedIn Ads',
        6800,
        'despesa',
        'Marketing',
        accTech3,
        12,
        lucasId,
        false,
      ],
      [
        'Consultoria de Arquitetura Cloud',
        18500,
        'receita',
        'Serviços',
        accTech2,
        14,
        carlosId,
        false,
      ],
      [
        'Licenças Software JetBrains & Figma',
        1890,
        'despesa',
        'Material de escritório',
        accTech3,
        15,
        lucasId,
        false,
      ],
      [
        'Impostos Federais DAS / Simples Nacional',
        7900,
        'despesa',
        'Impostos',
        accTech1,
        18,
        marinaId,
        false,
      ],
      [
        'Rendimentos Aplicação CDI',
        1650,
        'receita',
        'Investimentos',
        accTech4,
        20,
        carlosId,
        false,
      ],
      [
        'Viagem técnica visita cliente SP',
        1450,
        'despesa',
        'Transporte',
        accTech3,
        22,
        lucasId,
        false,
      ],
      [
        'Contrato Manutenção de Sistemas',
        15000,
        'receita',
        'Serviços',
        accTech1,
        25,
        marinaId,
        false,
      ],
      [
        'Honorários Contabilidade Externa',
        2100,
        'despesa',
        'Fornecedores',
        accTech1,
        27,
        carlosId,
        false,
      ],
      [
        'Contrato Mensal - Fintech Alfa',
        32000,
        'receita',
        'Serviços',
        accTech1,
        32,
        carlosId,
        true,
      ],
      [
        'Entrega Projeto E-commerce Prime',
        38000,
        'receita',
        'Serviços',
        accTech2,
        35,
        marinaId,
        false,
      ],
      [
        'Folha de Pagamento - Equipe Dev',
        28500,
        'despesa',
        'Salários',
        accTech1,
        36,
        carlosId,
        true,
      ],
      ['Aluguel Escritório Coworking', 5200, 'despesa', 'Aluguel', accTech1, 38, carlosId, true],
      [
        'Servidores AWS & Cloud Computing',
        4100,
        'despesa',
        'Utilidades',
        accTech3,
        40,
        marinaId,
        false,
      ],
      ['Campanha Tráfego Pago', 5500, 'despesa', 'Marketing', accTech3, 43, lucasId, false],
      ['Impostos Federais DAS', 6800, 'despesa', 'Impostos', accTech1, 48, marinaId, false],
      [
        'Rendimentos Aplicação CDI',
        1580,
        'receita',
        'Investimentos',
        accTech4,
        50,
        carlosId,
        false,
      ],
      [
        'Contrato Mensal - Fintech Alfa',
        32000,
        'receita',
        'Serviços',
        accTech1,
        62,
        carlosId,
        true,
      ],
      [
        'Auditoria de Segurança da Informação',
        22000,
        'receita',
        'Serviços',
        accTech2,
        65,
        marinaId,
        false,
      ],
      [
        'Folha de Pagamento - Equipe Dev',
        26000,
        'despesa',
        'Salários',
        accTech1,
        66,
        carlosId,
        true,
      ],
      ['Aluguel Escritório Coworking', 5200, 'despesa', 'Aluguel', accTech1, 68, carlosId, true],
      [
        'Servidores AWS & Cloud Computing',
        3950,
        'despesa',
        'Utilidades',
        accTech3,
        70,
        marinaId,
        false,
      ],
      [
        'Rendimentos Aplicação CDI',
        1520,
        'receita',
        'Investimentos',
        accTech4,
        80,
        carlosId,
        false,
      ],
    ]
    techTx.forEach((t) => mkTx(techId, t[7], t[2], t[1], t[0], t[3], t[4], t[5], t[6]))

    // Varejo transactions
    const varejoTx = [
      [
        'Venda de Mobiliário Planejado Loja A',
        18400,
        'receita',
        'Vendas',
        accVarejo1,
        3,
        carlosId,
        false,
      ],
      [
        'Venda de Luminárias e Decoração',
        7300,
        'receita',
        'Vendas',
        accVarejo2,
        5,
        marinaId,
        false,
      ],
      [
        'Fornecedor de Madeiras e Acabamentos',
        9200,
        'despesa',
        'Fornecedores',
        accVarejo1,
        7,
        carlosId,
        false,
      ],
      ['Aluguel do Showroom Comercial', 6500, 'despesa', 'Aluguel', accVarejo1, 9, carlosId, true],
      [
        'Salários dos Vendedores e Montadores',
        14200,
        'despesa',
        'Salários',
        accVarejo1,
        11,
        carlosId,
        true,
      ],
      [
        'Consultoria de Ambientação e Design',
        8500,
        'receita',
        'Serviços',
        accVarejo1,
        15,
        marinaId,
        false,
      ],
      [
        'Taxas de Maquininha de Cartão e Fretes',
        1250,
        'despesa',
        'Transporte',
        accVarejo1,
        19,
        marinaId,
        false,
      ],
      [
        'Anúncios em Redes Sociais e Catálogo',
        3200,
        'despesa',
        'Marketing',
        accVarejo1,
        24,
        carlosId,
        false,
      ],
      [
        'Venda de Mobiliário Planejado Loja A',
        16800,
        'receita',
        'Vendas',
        accVarejo1,
        33,
        carlosId,
        false,
      ],
      [
        'Projeto de Decoração Corporativo',
        12400,
        'receita',
        'Serviços',
        accVarejo1,
        36,
        lucasId,
        false,
      ],
      [
        'Fornecedor de Tecidos e Estofados',
        6800,
        'despesa',
        'Fornecedores',
        accVarejo1,
        38,
        carlosId,
        false,
      ],
      ['Aluguel do Showroom Comercial', 6500, 'despesa', 'Aluguel', accVarejo1, 39, carlosId, true],
      [
        'Salários dos Vendedores e Montadores',
        13200,
        'despesa',
        'Salários',
        accVarejo1,
        41,
        carlosId,
        true,
      ],
      [
        'Campanha de Marketing Digital',
        2800,
        'despesa',
        'Marketing',
        accVarejo1,
        45,
        lucasId,
        false,
      ],
      [
        'Material de Escritório e Embalagens',
        980,
        'despesa',
        'Material de escritório',
        accVarejo1,
        48,
        marinaId,
        false,
      ],
      [
        'Venda de Mobiliário Planejado Loja A',
        15200,
        'receita',
        'Vendas',
        accVarejo1,
        63,
        carlosId,
        false,
      ],
      [
        'Venda de Luminárias e Decoração',
        6400,
        'receita',
        'Vendas',
        accVarejo2,
        66,
        marinaId,
        false,
      ],
      ['Aluguel do Showroom Comercial', 6500, 'despesa', 'Aluguel', accVarejo1, 69, carlosId, true],
      [
        'Salários dos Vendedores e Montadores',
        12800,
        'despesa',
        'Salários',
        accVarejo1,
        71,
        carlosId,
        true,
      ],
      [
        'Fornecedor de Madeiras e Acabamentos',
        7600,
        'despesa',
        'Fornecedores',
        accVarejo1,
        74,
        carlosId,
        false,
      ],
      ['Frete e Entrega Regional', 1850, 'despesa', 'Transporte', accVarejo1, 78, lucasId, false],
    ]
    varejoTx.forEach((t) => mkTx(varejoId, t[7], t[2], t[1], t[0], t[3], t[4], t[5], t[6]))
  },
  (app) => {
    // Best-effort rollback: delete seed-created records (non-default data)
    const cols = [
      'transactions',
      'goals',
      'budgets',
      'categories',
      'credit_cards',
      'accounts',
      'company_members',
      'companies',
    ]
    cols.forEach((n) => {
      try {
        const col = app.findCollectionByNameOrId(n)
        const recs = app.findRecordsByFilter(n, '1=1', '', 500)
        recs.forEach((r) => app.delete(r))
        void col
      } catch (_) {}
    })
    // Note: auth users are not removed on rollback (kept for safety)
  },
)
