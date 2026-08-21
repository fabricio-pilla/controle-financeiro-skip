migrate(
  (app) => {
    const FABRICIO_USER_ID = 'uc5jp6hewxu9yio'
    const FABRICIO_EMAIL = 'fabricio.pilla@gmail.com'

    // 1. Limpar todas as tabelas na ordem correta (respeitando foreign keys)
    const tablesToClear = [
      'transactions',
      'budgets',
      'goals',
      'accounts',
      'credit_cards',
      'categories',
      'control_members',
      'control_invitations',
      'financial_controls',
    ]

    for (let i = 0; i < tablesToClear.length; i++) {
      const tableName = tablesToClear[i]
      try {
        app.db().newQuery(`DELETE FROM ${tableName}`).execute()
      } catch (err) {
        console.log(`Erro ao limpar tabela ${tableName}:`, err)
      }
    }

    // 2. Manter apenas o usuário fabricio.pilla@gmail.com
    // Deletar todos os outros usuários
    try {
      app.db().newQuery("DELETE FROM users WHERE email != 'fabricio.pilla@gmail.com'").execute()
    } catch (err) {
      console.log('Erro ao remover outros usuários:', err)
    }

    // Garantir que fabricio.pilla@gmail.com existe e está verificado com emailVisibility: true
    let fabricioUser = null
    try {
      fabricioUser = app.findAuthRecordByEmail('_pb_users_auth_', FABRICIO_EMAIL)
    } catch (_) {
      // Se não existir por algum motivo, cria
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      fabricioUser = new Record(usersCol)
      fabricioUser.set('id', FABRICIO_USER_ID)
      fabricioUser.setEmail(FABRICIO_EMAIL)
      fabricioUser.setPassword('Skip@Pass')
      fabricioUser.set('name', 'Fabrício Pilla')
    }

    fabricioUser.setVerified(true)
    fabricioUser.set('emailVisibility', true)
    app.save(fabricioUser)

    // 3. Criar controle financeiro "Casa"
    const financialControlsCol = app.findCollectionByNameOrId('financial_controls')
    const casaControl = new Record(financialControlsCol)
    casaControl.set('name', 'Casa')
    casaControl.set('description', 'Controle financeiro da família')
    casaControl.set('color', '#3B82F6')
    casaControl.set('owner_id', fabricioUser.id || FABRICIO_USER_ID)
    casaControl.set('owner_email', FABRICIO_EMAIL)
    app.save(casaControl)

    const casaControlId = casaControl.id

    // 4. Criar membro owner
    const controlMembersCol = app.findCollectionByNameOrId('control_members')
    const ownerMember = new Record(controlMembersCol)
    ownerMember.set('control_id', casaControlId)
    ownerMember.set('user_id', fabricioUser.id || FABRICIO_USER_ID)
    ownerMember.set('email', FABRICIO_EMAIL)
    ownerMember.set('invited_email', FABRICIO_EMAIL)
    ownerMember.set('role', 'owner')
    ownerMember.set('status', 'active')
    app.save(ownerMember)

    // 5 & 6. Criar as categorias
    const categoriesCol = app.findCollectionByNameOrId('categories')

    // 9 categorias de despesa
    const expenseCategories = [
      { name: 'Moradia', color: '#EF4444', icon: 'Home' },
      { name: 'Alimentação', color: '#F97316', icon: 'Utensils' },
      { name: 'Transporte', color: '#F59E0B', icon: 'Car' },
      { name: 'Saúde', color: '#EC4899', icon: 'Heart' },
      { name: 'Filhos', color: '#8B5CF6', icon: 'Baby' },
      { name: 'Pets', color: '#10B981', icon: 'PawPrint' },
      { name: 'Lazer', color: '#06B6D4', icon: 'Gamepad2' },
      { name: 'Investimentos', color: '#6366F1', icon: 'TrendingUp' },
      { name: 'Pessoal', color: '#64748B', icon: 'User' },
    ]

    expenseCategories.forEach((cat) => {
      const rec = new Record(categoriesCol)
      rec.set('control_id', casaControlId)
      rec.set('name', cat.name)
      rec.set('type', 'despesa')
      rec.set('color', cat.color)
      rec.set('icon', cat.icon)
      rec.set('is_default', true)
      app.save(rec)
    })

    // Categorias de receita
    const incomeCategories = [
      { name: 'Salário', color: '#10B981', icon: 'Briefcase' },
      { name: 'Investimentos', color: '#8B5CF6', icon: 'TrendingUp' },
      { name: 'Outros', color: '#64748B', icon: 'PlusCircle' },
    ]

    incomeCategories.forEach((cat) => {
      const rec = new Record(categoriesCol)
      rec.set('control_id', casaControlId)
      rec.set('name', cat.name)
      rec.set('type', 'receita')
      rec.set('color', cat.color)
      rec.set('icon', cat.icon)
      rec.set('is_default', true)
      app.save(rec)
    })
  },
  (app) => {
    // Down migration
    try {
      const casaControls = app.findRecordsByFilter(
        'financial_controls',
        "owner_email = 'fabricio.pilla@gmail.com' && name = 'Casa'",
        '',
        100,
      )
      casaControls.forEach((c) => {
        try {
          app.db().newQuery(`DELETE FROM categories WHERE control_id = '${c.id}'`).execute()
          app.db().newQuery(`DELETE FROM control_members WHERE control_id = '${c.id}'`).execute()
          app.db().newQuery(`DELETE FROM financial_controls WHERE id = '${c.id}'`).execute()
        } catch (_) {}
      })
    } catch (_) {}
  },
)
