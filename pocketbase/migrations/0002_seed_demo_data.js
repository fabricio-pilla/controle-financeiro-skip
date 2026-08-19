migrate(
  (app) => {
    // ------------------------------------------------------------------
    // Seed users (auth collection "_pb_users_auth_")
    // Demo credentials:
    //   lucas@demo.com   / senha123
    //   mariana@demo.com / senha123
    //   carlos@empresa.com.br / senha123  (owner of the demo companies)
    // ------------------------------------------------------------------
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    function seedUser(name, email, password) {
      try {
        app.findAuthRecordByEmail('_pb_users_auth_', email)
        return null // already exists
      } catch (_) {}
      const rec = new Record(usersCol)
      rec.setEmail(email)
      rec.setPassword(password)
      rec.setVerified(true)
      rec.set('name', name)
      app.save(rec)
      return rec
    }

    const carlos = seedUser('Carlos Henrique', 'carlos@empresa.com.br', 'senha123')
    const mariana = seedUser('Mariana Souza', 'mariana@demo.com', 'senha123')
    const lucas = seedUser('Lucas Ferreira', 'lucas@demo.com', 'senha123')

    // Resolve ids (whether freshly created or already present)
    const carlosId = app.findAuthRecordByEmail('_pb_users_auth_', 'carlos@empresa.com.br').id
    const marianaId = app.findAuthRecordByEmail('_pb_users_auth_', 'mariana@demo.com').id
    const lucasId = app.findAuthRecordByEmail('_pb_users_auth_', 'lucas@demo.com').id

    // ------------------------------------------------------------------
    // Companies
    // ------------------------------------------------------------------
    const companiesCol = app.findCollectionByNameOrId('companies')

    function findCompanyByName(name) {
      try {
        return app.findFirstRecordByData('companies', 'name', name)
      } catch (_) {
        return null
      }
    }

    let nexus = findCompanyByName('Nexus Soluções Digitais')
    if (!nexus) {
      nexus = new Record(companiesCol)
      nexus.set('name', 'Nexus Soluções Digitais')
      nexus.set('segment', 'Tecnologia')
      nexus.set('color', '#6366F1')
      nexus.set(
        'description',
        'Software house especializada em desenvolvimento de plataformas digitais, aplicativos e infraestrutura cloud para fintechs e e-commerce.',
      )
      nexus.set('owner_id', carlosId)
      app.save(nexus)
    }

    let aurora = findCompanyByName('Aurora Comércio & Design')
    if (!aurora) {
      aurora = new Record(companiesCol)
      aurora.set('name', 'Aurora Comércio & Design')
      aurora.set('segment', 'Varejo')
      aurora.set('color', '#10B981')
      aurora.set(
        'description',
        'Loja de mobiliário planejado e artigos de decoração com showroom físico, atuando no varejo de design de interiores e ambientação sob medida.',
      )
      aurora.set('owner_id', carlosId)
      app.save(aurora)
    }

    const nexusId = nexus.id
    const auroraId = aurora.id

    // ------------------------------------------------------------------
    // Company members (email field drives tenant filtering)
    // ------------------------------------------------------------------
    const membersCol = app.findCollectionByNameOrId('company_members')

    function findMember(companyId, email) {
      try {
        return app.findFirstRecordByData('company_members', 'email', email) &&
          app
            .findRecordsByFilter(
              'company_members',
              "company_id = '" + companyId + "' && email = '" + email + "'",
              '',
              1,
              0,
            )
            .length > 0
          ? app.findRecordsByFilter(
              'company_members',
              "company_id = '" + companyId + "' && email = '" + email + "'",
              '',
              1,
              0,
            )[0]
          : null
      } catch (_) {
        return null
      }
    }

    function seedMember(companyId, userId, email, role) {
      const existing = findMember(companyId, email)
      if (existing) return existing
      const rec = new Record(membersCol)
      rec.set('company_id', companyId)
      rec.set('user_id', userId)
      rec.set('email', email)
      rec.set('role', role)
      rec.set('status', 'active')
      app.save(rec)
      return rec
    }

    seedMember(nexusId, carlosId, 'carlos@empresa.com.br', 'owner')
    seedMember(nexusId, marianaId, 'mariana@demo.com', 'admin')
    seedMember(nexusId, lucasId, 'lucas@demo.com', 'member')

    seedMember(auroraId, carlosId, 'carlos@empresa.com.br', 'owner')
    seedMember(auroraId, marianaId, 'mariana@demo.com', 'member')
    seedMember(auroraId, lucasId, 'lucas@demo.com', 'admin')

    // ------------------------------------------------------------------
    // Accounts
    // ------------------------------------------------------------------
    const accountsCol = app.findCollectionByNameOrId('accounts')

    function findAccount(companyId, name) {
      try {
        const list = app.findRecordsByFilter(
          'accounts',
          "company_id = '" + companyId + "' && name = '" + name.replace(/'/g, "\\'") + "'",
          '',
          1,
          0,
        )
        return list.length > 0 ? list[0] : null
      } catch (_) {
        return null
      }
    }

    function seedAccount(companyId, data) {
      const existing = findAccount(companyId, data.name)
      if (existing) return existing
      const rec = new Record(accountsCol)
      rec.set('company_id', companyId)
      rec.set('name', data.name)
      rec.set('type', data.type)
      rec.set('balance', data.balance)
      if (data.limit !== undefined) rec.set('limit', data.limit)
      rec.set('color', data.color || '#6366F1')
      if (data.bank) rec.set('bank', data.bank)
      app.save(rec)
      return rec
    }

    const accNexusItau = seedAccount(nexusId, {
      name: 'Banco Itaú PJ',
      type: 'banco',
      balance: 84520.5,
      color: '#F97316',
      bank: 'Itaú Unibanco',
    })
    const accNexusNubank = seedAccount(nexusId, {
      name: 'Nubank PJ / Pix',
      type: 'pix',
      balance: 29400.0,
      color: '#8B5CF6',
      bank: 'Nubank',
    })
    const accNexusXP = seedAccount(nexusId, {
      name: 'Cartão Corporativo XP',
      type: 'credito',
      balance: 14280.0,
      limit: 50000.0,
      color: '#06B6D4',
      bank: 'XP Investimentos',
    })
    const accNexusReserva = seedAccount(nexusId, {
      name: 'Reserva Selic 100%',
      type: 'investimento',
      balance: 150000.0,
      color: '#10B981',
      bank: 'BTG Pactual',
    })

    const accAuroraBradesco = seedAccount(auroraId, {
      name: 'Bradesco Comercial',
      type: 'banco',
      balance: 42100.0,
      color: '#EF4444',
      bank: 'Banco Bradesco',
    })
    const accAuroraCaixa = seedAccount(auroraId, {
      name: 'Caixa da Loja Física',
      type: 'carteira',
      balance: 3850.0,
      color: '#10B981',
      bank: 'Caixa Interno',
    })

    // ------------------------------------------------------------------
    // Categories (default expense + income per company)
    // ------------------------------------------------------------------
    const categoriesCol = app.findCollectionByNameOrId('categories')

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

    function findCategory(companyId, name, type) {
      try {
        const list = app.findRecordsByFilter(
          'categories',
          "company_id = '" + companyId + "' && name = '" + name.replace(/'/g, "\\'") + "' && type = '" + type + "'",
          '',
          1,
          0,
        )
        return list.length > 0 ? list[0] : null
      } catch (_) {
        return null
      }
    }

    function seedCategory(companyId, item, type) {
      const existing = findCategory(companyId, item.name, type)
      if (existing) return existing
      const rec = new Record(categoriesCol)
      rec.set('company_id', companyId)
      rec.set('name', item.name)
      rec.set('type', type)
      rec.set('color', item.color)
      rec.set('icon', item.icon)
      rec.set('is_default', true)
      app.save(rec)
      return rec
    }

    function seedCategoriesFor(companyId) {
      const map = {}
      DEFAULT_EXPENSE.forEach((item) => {
        map['despesa::' + item.name] = seedCategory(companyId, item, 'despesa')
      })
      DEFAULT_INCOME.forEach((item) => {
        map['receita::' + item.name] = seedCategory(companyId, item, 'receita')
      })
      return map
    }

    const nexusCats = seedCategoriesFor(nexusId)
    const auroraCats = seedCategoriesFor(auroraId)

    // ------------------------------------------------------------------
    // Transactions
    // ------------------------------------------------------------------
    const txCol = app.findCollectionByNameOrId('transactions')

    function txExists(companyId, description, date, amount) {
      try {
        const list = app.findRecordsByFilter(
          'transactions',
          "company_id = '" + companyId + "' && description = '" + description.replace(/'/g, "\\'") + "' && date = '" + date + "' && amount = " + amount,
          '',
          1,
          0,
        )
        return list.length > 0
      } catch (_) {
        return false
      }
    }

    function dateStr(daysAgo) {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      var y = d.getFullYear()
      var m = ('0' + (d.getMonth() + 1)).slice(-2)
      var day = ('0' + d.getDate()).slice(-2)
      return y + '-' + m + '-' + day
    }

    function addMonths(dateStr, months) {
      var parts = dateStr.split('-')
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      d.setMonth(d.getMonth() + months)
      var y = d.getFullYear()
      var m = ('0' + (d.getMonth() + 1)).slice(-2)
      var day = ('0' + d.getDate()).slice(-2)
      return y + '-' + m + '-' + day
    }

    function seedTx(companyId, data) {
      var catKey = data.type + '::' + data.cat
      var catMap = companyId === nexusId ? nexusCats : auroraCats
      var cat = catMap[catKey]
      if (!cat) return
      var date = data.dateStr || dateStr(data.days)
      if (txExists(companyId, data.desc, date, data.amt)) return
      var rec = new Record(txCol)
      rec.set('company_id', companyId)
      rec.set('user_id', data.user)
      rec.set('type', data.type)
      rec.set('amount', data.amt)
      rec.set('description', data.desc)
      rec.set('category_id', cat.id)
      rec.set('account_id', data.acc)
      rec.set('date', date)
      rec.set('paid', true)
      rec.set('is_recurring', !!data.recurring)
      if (data.recurring) rec.set('recurrence_type', 'mensal')
      if (data.installments_total && data.installments_total > 1) {
        rec.set('installment_total', data.installments_total)
        rec.set('installment_number', data.installment_number || 1)
      }
      if (data.notes) rec.set('notes', data.notes)
      app.save(rec)
    }

    // ---- Nexus transactions (3 months) ----
    var nexusTx = [
      { desc: 'Contrato Mensal - Fintech Alfa', amt: 32000, type: 'receita', cat: 'Serviços', acc: accNexusItau.id, days: 2, user: carlosId, recurring: true },
      { desc: 'Desenvolvimento App Mobile - Beta Corp', amt: 45000, type: 'receita', cat: 'Serviços', acc: accNexusNubank.id, days: 5, user: marianaId },
      { desc: 'Folha de Pagamento - Equipe Dev', amt: 28500, type: 'despesa', cat: 'Salários', acc: accNexusItau.id, days: 6, user: carlosId, recurring: true },
      { desc: 'Aluguel Escritório Coworking', amt: 5200, type: 'despesa', cat: 'Aluguel', acc: accNexusItau.id, days: 8, user: carlosId, recurring: true },
      { desc: 'Servidores AWS & Cloud Computing', amt: 4320.5, type: 'despesa', cat: 'Utilidades', acc: accNexusXP.id, days: 10, user: marianaId },
      { desc: 'Campanha Google Ads & LinkedIn Ads', amt: 6800, type: 'despesa', cat: 'Marketing', acc: accNexusXP.id, days: 12, user: lucasId },
      { desc: 'Consultoria de Arquitetura Cloud', amt: 18500, type: 'receita', cat: 'Serviços', acc: accNexusNubank.id, days: 14, user: carlosId },
      { desc: 'Licenças Software JetBrains & Figma', amt: 1890, type: 'despesa', cat: 'Material de escritório', acc: accNexusXP.id, days: 15, user: lucasId },
      { desc: 'Impostos Federais DAS / Simples Nacional', amt: 7900, type: 'despesa', cat: 'Impostos', acc: accNexusItau.id, days: 18, user: marianaId },
      { desc: 'Rendimentos Aplicação CDI', amt: 1650, type: 'receita', cat: 'Investimentos', acc: accNexusReserva.id, days: 20, user: carlosId },
      { desc: 'Viagem técnica visita cliente SP', amt: 1450, type: 'despesa', cat: 'Transporte', acc: accNexusXP.id, days: 22, user: lucasId },
      { desc: 'Contrato Manutenção de Sistemas', amt: 15000, type: 'receita', cat: 'Serviços', acc: accNexusItau.id, days: 25, user: marianaId },
      { desc: 'Honorários Contabilidade Externa', amt: 2100, type: 'despesa', cat: 'Fornecedores', acc: accNexusItau.id, days: 27, user: carlosId },
      // Month 2
      { desc: 'Contrato Mensal - Fintech Alfa', amt: 32000, type: 'receita', cat: 'Serviços', acc: accNexusItau.id, days: 32, user: carlosId, recurring: true },
      { desc: 'Entrega Projeto E-commerce Prime', amt: 38000, type: 'receita', cat: 'Serviços', acc: accNexusNubank.id, days: 35, user: marianaId },
      { desc: 'Folha de Pagamento - Equipe Dev', amt: 28500, type: 'despesa', cat: 'Salários', acc: accNexusItau.id, days: 36, user: carlosId, recurring: true },
      { desc: 'Aluguel Escritório Coworking', amt: 5200, type: 'despesa', cat: 'Aluguel', acc: accNexusItau.id, days: 38, user: carlosId, recurring: true },
      { desc: 'Servidores AWS & Cloud Computing', amt: 4100, type: 'despesa', cat: 'Utilidades', acc: accNexusXP.id, days: 40, user: marianaId },
      { desc: 'Campanha Tráfego Pago', amt: 5500, type: 'despesa', cat: 'Marketing', acc: accNexusXP.id, days: 43, user: lucasId },
      { desc: 'Impostos Federais DAS', amt: 6800, type: 'despesa', cat: 'Impostos', acc: accNexusItau.id, days: 48, user: marianaId },
      { desc: 'Rendimentos Aplicação CDI', amt: 1580, type: 'receita', cat: 'Investimentos', acc: accNexusReserva.id, days: 50, user: carlosId },
      // Month 3
      { desc: 'Contrato Mensal - Fintech Alfa', amt: 32000, type: 'receita', cat: 'Serviços', acc: accNexusItau.id, days: 62, user: carlosId, recurring: true },
      { desc: 'Auditoria de Segurança da Informação', amt: 22000, type: 'receita', cat: 'Serviços', acc: accNexusNubank.id, days: 65, user: marianaId },
      { desc: 'Folha de Pagamento - Equipe Dev', amt: 26000, type: 'despesa', cat: 'Salários', acc: accNexusItau.id, days: 66, user: carlosId, recurring: true },
      { desc: 'Aluguel Escritório Coworking', amt: 5200, type: 'despesa', cat: 'Aluguel', acc: accNexusItau.id, days: 68, user: carlosId, recurring: true },
      { desc: 'Servidores AWS & Cloud Computing', amt: 3950, type: 'despesa', cat: 'Utilidades', acc: accNexusXP.id, days: 70, user: marianaId },
      { desc: 'Rendimentos Aplicação CDI', amt: 1520, type: 'receita', cat: 'Investimentos', acc: accNexusReserva.id, days: 80, user: carlosId },
    ]
    nexusTx.forEach(function (item) {
      seedTx(nexusId, item)
    })

    // ---- Aurora transactions (3 months) ----
    var auroraTx = [
      { desc: 'Venda de Mobiliário Planejado Loja A', amt: 18400, type: 'receita', cat: 'Vendas', acc: accAuroraBradesco.id, days: 3, user: carlosId },
      { desc: 'Venda de Luminárias e Decoração', amt: 7300, type: 'receita', cat: 'Vendas', acc: accAuroraCaixa.id, days: 5, user: marianaId },
      { desc: 'Fornecedor de Madeiras e Acabamentos', amt: 9200, type: 'despesa', cat: 'Fornecedores', acc: accAuroraBradesco.id, days: 7, user: carlosId },
      { desc: 'Aluguel do Showroom Comercial', amt: 6500, type: 'despesa', cat: 'Aluguel', acc: accAuroraBradesco.id, days: 9, user: carlosId, recurring: true },
      { desc: 'Salários dos Vendedores e Montadores', amt: 14200, type: 'despesa', cat: 'Salários', acc: accAuroraBradesco.id, days: 11, user: carlosId, recurring: true },
      { desc: 'Consultoria de Ambientação e Design', amt: 8500, type: 'receita', cat: 'Serviços', acc: accAuroraBradesco.id, days: 15, user: marianaId },
      { desc: 'Taxas de Maquininha de Cartão e Fretes', amt: 1250, type: 'despesa', cat: 'Transporte', acc: accAuroraBradesco.id, days: 19, user: marianaId },
      { desc: 'Anúncios em Redes Sociais e Catálogo', amt: 3200, type: 'despesa', cat: 'Marketing', acc: accAuroraBradesco.id, days: 24, user: carlosId },
      // Month 2
      { desc: 'Venda de Mobiliário Planejado Loja A', amt: 16800, type: 'receita', cat: 'Vendas', acc: accAuroraBradesco.id, days: 33, user: carlosId },
      { desc: 'Projeto de Decoração Corporativo', amt: 12400, type: 'receita', cat: 'Serviços', acc: accAuroraBradesco.id, days: 36, user: lucasId },
      { desc: 'Fornecedor de Tecidos e Estofados', amt: 6800, type: 'despesa', cat: 'Fornecedores', acc: accAuroraBradesco.id, days: 38, user: carlosId },
      { desc: 'Aluguel do Showroom Comercial', amt: 6500, type: 'despesa', cat: 'Aluguel', acc: accAuroraBradesco.id, days: 39, user: carlosId, recurring: true },
      { desc: 'Salários dos Vendedores e Montadores', amt: 13200, type: 'despesa', cat: 'Salários', acc: accAuroraBradesco.id, days: 41, user: carlosId, recurring: true },
      { desc: 'Campanha de Marketing Digital', amt: 2800, type: 'despesa', cat: 'Marketing', acc: accAuroraBradesco.id, days: 45, user: lucasId },
      { desc: 'Material de Escritório e Embalagens', amt: 980, type: 'despesa', cat: 'Material de escritório', acc: accAuroraBradesco.id, days: 48, user: marianaId },
      // Month 3
      { desc: 'Venda de Mobiliário Planejado Loja A', amt: 15200, type: 'receita', cat: 'Vendas', acc: accAuroraBradesco.id, days: 63, user: carlosId },
      { desc: 'Venda de Luminárias e Decoração', amt: 6400, type: 'receita', cat: 'Vendas', acc: accAuroraCaixa.id, days: 66, user: marianaId },
      { desc: 'Aluguel do Showroom Comercial', amt: 6500, type: 'despesa', cat: 'Aluguel', acc: accAuroraBradesco.id, days: 69, user: carlosId, recurring: true },
      { desc: 'Salários dos Vendedores e Montadores', amt: 12800, type: 'despesa', cat: 'Salários', acc: accAuroraBradesco.id, days: 71, user: carlosId, recurring: true },
      { desc: 'Fornecedor de Madeiras e Acabamentos', amt: 7600, type: 'despesa', cat: 'Fornecedores', acc: accAuroraBradesco.id, days: 74, user: carlosId },
      { desc: 'Frete e Entrega Regional', amt: 1850, type: 'despesa', cat: 'Transporte', acc: accAuroraBradesco.id, days: 78, user: lucasId },
    ]
    auroraTx.forEach(function (item) {
      seedTx(auroraId, item)
    })

    // An example installment transaction (3x) for Aurora
    ;(function () {
      var baseDate = dateStr(10)
      var cat = auroraCats['despesa::Fornecedores']
      var total = 3600
      var base = Math.round((total / 3) * 100) / 100
      var remainder = Math.round((total - base * 3) * 100) / 100
      var i
      for (i = 1; i <= 3; i++) {
        var amt = i === 1 ? Math.round((base + remainder) * 100) / 100 : base
        var d = addMonths(baseDate, i - 1)
        if (txExists(auroraId, 'Notebook Dell Latitude (3x)', d, amt)) continue
        var rec = new Record(txCol)
        rec.set('company_id', auroraId)
        rec.set('user_id', lucasId)
        rec.set('type', 'despesa')
        rec.set('amount', amt)
        rec.set('description', 'Notebook Dell Latitude (' + i + '/3)')
        rec.set('category_id', cat.id)
        rec.set('account_id', accAuroraBradesco.id)
        rec.set('date', d)
        rec.set('paid', true)
        rec.set('installment_total', 3)
        rec.set('installment_number', i)
        app.save(rec)
      }
    })()
  },
  (app) => {
    // Down: remove seeded demo data only (keep schema)
    var names = ['transactions', 'categories', 'accounts', 'company_members', 'companies']
    names.forEach(function (n) {
      try {
        app.truncateCollection(app.findCollectionByNameOrId(n))
      } catch (_) {}
    })
    // Remove the three demo users
    ;['lucas@demo.com', 'mariana@demo.com', 'carlos@empresa.com.br'].forEach(function (email) {
      try {
        var rec = app.findAuthRecordByEmail('_pb_users_auth_', email)
        app.delete(rec)
      } catch (_) {}
    })
  },
)
