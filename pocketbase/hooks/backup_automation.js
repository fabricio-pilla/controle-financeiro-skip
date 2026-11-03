// Hook de automação de backups e restauração de dados
// Todas as funções são declaradas internamente em cada callback para conformidade
// com o modelo de execução isolado do JSVM do PocketBase.

// -------------------------------------------------------------
// POST /backend/v1/custom/backup-generate
// Executa backup manual para o controle
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/custom/backup-generate', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Não autenticado.' })
  }

  const checkAdmin = (uid, cid) => {
    try {
      const callerMember = $app.findFirstRecordByFilter(
        'control_members',
        'control_id = {:cid} && user_id = {:uid} && status = "active"',
        { cid: cid, uid: uid },
      )
      if (callerMember) {
        const role = callerMember.getString('role')
        if (role === 'owner' || role === 'admin') return true
      }
    } catch (_) {}
    try {
      const ctrl = $app.findRecordById('financial_controls', cid)
      if (ctrl && ctrl.getString('owner_id') === uid) return true
    } catch (_) {}
    return false
  }

  const exportSnapshot = (cid) => {
    let controlData = null
    try {
      const ctrl = $app.findRecordById('financial_controls', cid)
      controlData = {
        id: ctrl.id,
        name: ctrl.getString('name'),
        description: ctrl.getString('description'),
        color: ctrl.getString('color'),
        owner_id: ctrl.getString('owner_id'),
        owner_email: ctrl.getString('owner_email'),
        created: ctrl.getString('created'),
        updated: ctrl.getString('updated'),
      }
    } catch (err) {
      throw new Error('Controle financeiro não encontrado: ' + err.message)
    }

    const rawMembers = $app.findRecordsByFilter(
      'control_members',
      'control_id = {:cid}',
      'created',
      5000,
      0,
      { cid: cid },
    )
    const members = []
    const userIdsSet = {}
    for (let i = 0; i < rawMembers.length; i++) {
      const m = rawMembers[i]
      const uId = m.getString('user_id')
      if (uId) userIdsSet[uId] = true
      members.push({
        id: m.id,
        control_id: m.getString('control_id'),
        user_id: uId,
        email: m.getString('email'),
        invited_email: m.getString('invited_email'),
        role: m.getString('role'),
        status: m.getString('status'),
        created: m.getString('created'),
        updated: m.getString('updated'),
      })
    }
    if (controlData.owner_id) userIdsSet[controlData.owner_id] = true

    const users = []
    const userIds = Object.keys(userIdsSet)
    for (let i = 0; i < userIds.length; i++) {
      try {
        const u = $app.findRecordById('users', userIds[i])
        users.push({
          id: u.id,
          name: u.getString('name'),
          email: u.getString('email'),
          avatar: u.getString('avatar'),
          created: u.getString('created'),
          updated: u.getString('updated'),
        })
      } catch (_) {}
    }

    const rawInvitations = $app.findRecordsByFilter(
      'control_invitations',
      'control_id = {:cid}',
      'created',
      5000,
      0,
      { cid: cid },
    )
    const control_invitations = []
    for (let i = 0; i < rawInvitations.length; i++) {
      const inv = rawInvitations[i]
      control_invitations.push({
        id: inv.id,
        control_id: inv.getString('control_id'),
        email: inv.getString('email'),
        role: inv.getString('role'),
        token: inv.getString('token'),
        status: inv.getString('status'),
        created: inv.getString('created'),
        updated: inv.getString('updated'),
      })
    }

    const rawAccounts = $app.findRecordsByFilter(
      'accounts',
      'control_id = {:cid}',
      'name',
      5000,
      0,
      { cid: cid },
    )
    const accounts = []
    for (let i = 0; i < rawAccounts.length; i++) {
      const a = rawAccounts[i]
      accounts.push({
        id: a.id,
        control_id: a.getString('control_id'),
        name: a.getString('name'),
        type: a.getString('type'),
        balance: a.getFloat('balance'),
        limit: a.getFloat('limit'),
        color: a.getString('color'),
        bank: a.getString('bank'),
        due_day: a.getInt('due_day'),
        closing_day: a.getInt('closing_day'),
        is_primary: a.getBool('is_primary'),
        created: a.getString('created'),
        updated: a.getString('updated'),
      })
    }

    const rawCreditCards = $app.findRecordsByFilter(
      'credit_cards',
      'control_id = {:cid}',
      'name',
      5000,
      0,
      { cid: cid },
    )
    const credit_cards = []
    for (let i = 0; i < rawCreditCards.length; i++) {
      const c = rawCreditCards[i]
      credit_cards.push({
        id: c.id,
        control_id: c.getString('control_id'),
        name: c.getString('name'),
        brand: c.getString('brand'),
        last_four: c.getString('last_four'),
        closing_day: c.getInt('closing_day'),
        due_day: c.getInt('due_day'),
        limit_amount: c.getFloat('limit_amount'),
        color: c.getString('color'),
        created: c.getString('created'),
        updated: c.getString('updated'),
      })
    }

    const rawCategories = $app.findRecordsByFilter(
      'categories',
      'control_id = {:cid}',
      'name',
      5000,
      0,
      { cid: cid },
    )
    const categories = []
    for (let i = 0; i < rawCategories.length; i++) {
      const cat = rawCategories[i]
      categories.push({
        id: cat.id,
        control_id: cat.getString('control_id'),
        name: cat.getString('name'),
        type: cat.getString('type'),
        color: cat.getString('color'),
        icon: cat.getString('icon'),
        is_default: cat.getBool('is_default'),
        created: cat.getString('created'),
        updated: cat.getString('updated'),
      })
    }

    const rawSubcategories = $app.findRecordsByFilter(
      'subcategories',
      'control_id = {:cid}',
      'name',
      5000,
      0,
      { cid: cid },
    )
    const subcategories = []
    for (let i = 0; i < rawSubcategories.length; i++) {
      const s = rawSubcategories[i]
      subcategories.push({
        id: s.id,
        control_id: s.getString('control_id'),
        category_id: s.getString('category_id'),
        name: s.getString('name'),
        color: s.getString('color'),
        icon: s.getString('icon'),
        created: s.getString('created'),
        updated: s.getString('updated'),
      })
    }

    const rawBudgets = $app.findRecordsByFilter(
      'budgets',
      'control_id = {:cid}',
      'created',
      10000,
      0,
      { cid: cid },
    )
    const budgets = []
    for (let i = 0; i < rawBudgets.length; i++) {
      const b = rawBudgets[i]
      budgets.push({
        id: b.id,
        control_id: b.getString('control_id'),
        category_id: b.getString('category_id'),
        month: b.getInt('month'),
        year: b.getInt('year'),
        amount: b.getFloat('amount'),
        created: b.getString('created'),
        updated: b.getString('updated'),
      })
    }

    const rawGoals = $app.findRecordsByFilter('goals', 'control_id = {:cid}', 'created', 5000, 0, {
      cid: cid,
    })
    const goals = []
    for (let i = 0; i < rawGoals.length; i++) {
      const g = rawGoals[i]
      goals.push({
        id: g.id,
        control_id: g.getString('control_id'),
        name: g.getString('name'),
        target_amount: g.getFloat('target_amount'),
        current_amount: g.getFloat('current_amount'),
        color: g.getString('color'),
        deadline: g.getString('deadline'),
        created: g.getString('created'),
        updated: g.getString('updated'),
      })
    }

    const rawTransactions = $app.findRecordsByFilter(
      'transactions',
      'control_id = {:cid}',
      'date',
      100000,
      0,
      { cid: cid },
    )
    const transactions = []
    for (let i = 0; i < rawTransactions.length; i++) {
      const t = rawTransactions[i]
      transactions.push({
        id: t.id,
        control_id: t.getString('control_id'),
        user_id: t.getString('user_id'),
        type: t.getString('type'),
        amount: t.getFloat('amount'),
        description: t.getString('description'),
        category_id: t.getString('category_id'),
        subcategory_id: t.getString('subcategory_id'),
        account_id: t.getString('account_id'),
        credit_card_id: t.getString('credit_card_id'),
        date: t.getString('date'),
        payment_date: t.getString('payment_date'),
        paid: t.getBool('paid'),
        recurring: t.getBool('recurring'),
        is_recurring: t.getBool('is_recurring'),
        recurrence_period: t.getString('recurrence_period'),
        recurrence_type: t.getString('recurrence_type'),
        installment_number: t.getInt('installment_number'),
        installment_total: t.getInt('installment_total'),
        parent_transaction_id: t.getString('parent_transaction_id'),
        notes: t.getString('notes'),
        created: t.getString('created'),
        updated: t.getString('updated'),
      })
    }

    const rawLearnings = $app.findRecordsByFilter(
      'ai_learnings',
      'control_id = {:cid}',
      'created',
      10000,
      0,
      { cid: cid },
    )
    const ai_learnings = []
    for (let i = 0; i < rawLearnings.length; i++) {
      const l = rawLearnings[i]
      ai_learnings.push({
        id: l.id,
        control_id: l.getString('control_id'),
        user_id: l.getString('user_id'),
        original_text: l.getString('original_text'),
        ai_category_id: l.getString('ai_category_id'),
        ai_subcategory_id: l.getString('ai_subcategory_id'),
        ai_type: l.getString('ai_type'),
        ai_description: l.getString('ai_description'),
        corrected_category_id: l.getString('corrected_category_id'),
        corrected_subcategory_id: l.getString('corrected_subcategory_id'),
        corrected_type: l.getString('corrected_type'),
        corrected_description: l.getString('corrected_description'),
        created: l.getString('created'),
        updated: l.getString('updated'),
      })
    }

    const exportedAt = new Date().toISOString()
    return {
      version: '1.0',
      app: 'Finanças do Casal - Controle Financeiro',
      exported_at: exportedAt,
      control: controlData,
      users: users,
      control_members: members,
      control_invitations: control_invitations,
      accounts: accounts,
      credit_cards: credit_cards,
      categories: categories,
      subcategories: subcategories,
      budgets: budgets,
      goals: goals,
      transactions: transactions,
      ai_learnings: ai_learnings,
      counts: {
        users: users.length,
        control_members: members.length,
        accounts: accounts.length,
        credit_cards: credit_cards.length,
        categories: categories.length,
        subcategories: subcategories.length,
        budgets: budgets.length,
        goals: goals.length,
        transactions: transactions.length,
        ai_learnings: ai_learnings.length,
      },
    }
  }

  const runBackup = (cid, callerId) => {
    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19)

    const snapshot = exportSnapshot(cid)
    const jsonString = JSON.stringify(snapshot, null, 2)
    const sizeBytes = jsonString.length
    const backupsCol = $app.findCollectionByNameOrId('data_backups')

    // 1. Arquiva backup anual (1 por ano) se ainda não existir
    let existingYearly = null
    try {
      existingYearly = $app.findFirstRecordByFilter(
        'data_backups',
        'control_id = {:cid} && backup_type = "yearly" && year = {:yr}',
        { cid: cid, yr: currentYear },
      )
    } catch (_) {}

    if (!existingYearly) {
      try {
        const yRecord = new Record(backupsCol)
        yRecord.set('control_id', cid)
        yRecord.set('name', 'Backup Anual ' + currentYear)
        yRecord.set('backup_type', 'yearly')
        yRecord.set('year', currentYear)
        yRecord.set('size_bytes', sizeBytes)
        yRecord.set('data_json', snapshot)
        yRecord.set('metadata', {
          counts: snapshot.counts,
          created_at: now.toISOString(),
        })
        if (callerId) yRecord.set('created_by', callerId)
        try {
          const yFile = $filesystem.fileFromBytes(jsonString, 'backup_' + currentYear + '.json')
          yRecord.set('file', yFile)
        } catch (_) {}
        $app.save(yRecord)
      } catch (yErr) {
        console.log('[backup] Falha ao criar anual: ' + yErr.message)
      }
    }

    // 2. Mantém apenas 1 backup corrente (o mais recente)
    const currentRecords = $app.findRecordsByFilter(
      'data_backups',
      'control_id = {:cid} && backup_type = "current"',
      '-created',
      50,
      0,
      { cid: cid },
    )

    let targetRecord
    if (currentRecords.length > 0) {
      targetRecord = currentRecords[0]
      for (let k = 1; k < currentRecords.length; k++) {
        try {
          $app.delete(currentRecords[k])
        } catch (_) {}
      }
    } else {
      targetRecord = new Record(backupsCol)
      targetRecord.set('control_id', cid)
    }

    const currentName = 'Backup Mais Recente (' + dateStr.slice(0, 10) + ')'
    targetRecord.set('name', currentName)
    targetRecord.set('backup_type', 'current')
    targetRecord.set('year', currentYear)
    targetRecord.set('size_bytes', sizeBytes)
    targetRecord.set('data_json', snapshot)
    targetRecord.set('metadata', {
      counts: snapshot.counts,
      generated_at: now.toISOString(),
      caller_id: callerId || 'cron',
    })
    if (callerId) targetRecord.set('created_by', callerId)

    try {
      const curFile = $filesystem.fileFromBytes(jsonString, 'backup_recente_' + dateStr + '.json')
      targetRecord.set('file', curFile)
    } catch (_) {}

    $app.save(targetRecord)

    return {
      id: targetRecord.id,
      name: targetRecord.getString('name'),
      backup_type: 'current',
      year: currentYear,
      size_bytes: sizeBytes,
      created: targetRecord.getString('created'),
      updated: targetRecord.getString('updated'),
      counts: snapshot.counts,
    }
  }

  const body = e.requestInfo().body || {}
  let controlId = body.controlId

  if (!controlId) {
    try {
      const member = $app.findFirstRecordByFilter(
        'control_members',
        'user_id = {:uid} && status = "active"',
        { uid: authRecord.id },
      )
      if (member) controlId = member.getString('control_id')
    } catch (_) {}
  }

  if (!controlId) {
    return e.json(400, { message: 'Parâmetro controlId não informado.' })
  }

  if (!checkAdmin(authRecord.id, controlId)) {
    return e.json(403, {
      message: 'Apenas administradores ou proprietários podem gerar backups.',
    })
  }

  try {
    const result = runBackup(controlId, authRecord.id)
    return e.json(200, {
      success: true,
      message: 'Backup gerado com sucesso.',
      backup: result,
    })
  } catch (err) {
    console.log('[backup] Erro ao gerar backup: ' + err.message)
    return e.json(500, {
      success: false,
      message: 'Falha ao gerar backup: ' + err.message,
    })
  }
})

// -------------------------------------------------------------
// POST /backend/v1/custom/backup-restore
// Restaura a partir de um backup existente (por id) OU snapshot enviado
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/custom/backup-restore', (e) => {
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Não autenticado.' })
  }

  const checkAdmin = (uid, cid) => {
    try {
      const callerMember = $app.findFirstRecordByFilter(
        'control_members',
        'control_id = {:cid} && user_id = {:uid} && status = "active"',
        { cid: cid, uid: uid },
      )
      if (callerMember) {
        const role = callerMember.getString('role')
        if (role === 'owner' || role === 'admin') return true
      }
    } catch (_) {}
    try {
      const ctrl = $app.findRecordById('financial_controls', cid)
      if (ctrl && ctrl.getString('owner_id') === uid) return true
    } catch (_) {}
    return false
  }

  const restoreSnapshot = (controlId, snapshot) => {
    const report = {
      accounts: 0,
      credit_cards: 0,
      categories: 0,
      subcategories: 0,
      budgets: 0,
      goals: 0,
      transactions: 0,
      ai_learnings: 0,
      errors: [],
    }

    // 1. Contas
    if (Array.isArray(snapshot.accounts)) {
      const col = $app.findCollectionByNameOrId('accounts')
      for (let i = 0; i < snapshot.accounts.length; i++) {
        const item = snapshot.accounts[i]
        try {
          let rec
          try {
            rec = $app.findRecordById('accounts', item.id)
          } catch (_) {
            rec = new Record(col)
            rec.set('id', item.id)
          }
          rec.set('control_id', controlId)
          if (item.name) rec.set('name', item.name)
          if (item.type) rec.set('type', item.type)
          if (typeof item.balance === 'number') rec.set('balance', item.balance)
          if (typeof item.limit === 'number') rec.set('limit', item.limit)
          if (item.color) rec.set('color', item.color)
          if (item.bank) rec.set('bank', item.bank)
          if (typeof item.due_day === 'number') rec.set('due_day', item.due_day)
          if (typeof item.closing_day === 'number') rec.set('closing_day', item.closing_day)
          if (typeof item.is_primary === 'boolean') rec.set('is_primary', item.is_primary)
          $app.save(rec)
          report.accounts++
        } catch (err) {
          report.errors.push('Conta ' + item.name + ' (' + item.id + '): ' + err.message)
        }
      }
    }

    // 2. Cartões de crédito
    if (Array.isArray(snapshot.credit_cards)) {
      const col = $app.findCollectionByNameOrId('credit_cards')
      for (let i = 0; i < snapshot.credit_cards.length; i++) {
        const item = snapshot.credit_cards[i]
        try {
          let rec
          try {
            rec = $app.findRecordById('credit_cards', item.id)
          } catch (_) {
            rec = new Record(col)
            rec.set('id', item.id)
          }
          rec.set('control_id', controlId)
          if (item.name) rec.set('name', item.name)
          if (item.brand) rec.set('brand', item.brand)
          if (item.last_four) rec.set('last_four', item.last_four)
          if (typeof item.closing_day === 'number') rec.set('closing_day', item.closing_day)
          if (typeof item.due_day === 'number') rec.set('due_day', item.due_day)
          if (typeof item.limit_amount === 'number') rec.set('limit_amount', item.limit_amount)
          if (item.color) rec.set('color', item.color)
          $app.save(rec)
          report.credit_cards++
        } catch (err) {
          report.errors.push('Cartão ' + item.name + ' (' + item.id + '): ' + err.message)
        }
      }
    }

    // 3. Categorias
    if (Array.isArray(snapshot.categories)) {
      const col = $app.findCollectionByNameOrId('categories')
      for (let i = 0; i < snapshot.categories.length; i++) {
        const item = snapshot.categories[i]
        try {
          let rec
          try {
            rec = $app.findRecordById('categories', item.id)
          } catch (_) {
            rec = new Record(col)
            rec.set('id', item.id)
          }
          rec.set('control_id', controlId)
          if (item.name) rec.set('name', item.name)
          if (item.type) rec.set('type', item.type)
          if (item.color) rec.set('color', item.color)
          if (item.icon) rec.set('icon', item.icon)
          if (typeof item.is_default === 'boolean') rec.set('is_default', item.is_default)
          $app.save(rec)
          report.categories++
        } catch (err) {
          report.errors.push('Categoria ' + item.name + ' (' + item.id + '): ' + err.message)
        }
      }
    }

    // 4. Subcategorias
    if (Array.isArray(snapshot.subcategories)) {
      const col = $app.findCollectionByNameOrId('subcategories')
      for (let i = 0; i < snapshot.subcategories.length; i++) {
        const item = snapshot.subcategories[i]
        try {
          let rec
          try {
            rec = $app.findRecordById('subcategories', item.id)
          } catch (_) {
            rec = new Record(col)
            rec.set('id', item.id)
          }
          rec.set('control_id', controlId)
          if (item.category_id) rec.set('category_id', item.category_id)
          if (item.name) rec.set('name', item.name)
          if (item.color) rec.set('color', item.color)
          if (item.icon) rec.set('icon', item.icon)
          $app.save(rec)
          report.subcategories++
        } catch (err) {
          report.errors.push('Subcategoria ' + item.name + ' (' + item.id + '): ' + err.message)
        }
      }
    }

    // 5. Orçamentos
    if (Array.isArray(snapshot.budgets)) {
      const col = $app.findCollectionByNameOrId('budgets')
      for (let i = 0; i < snapshot.budgets.length; i++) {
        const item = snapshot.budgets[i]
        try {
          let rec
          try {
            rec = $app.findRecordById('budgets', item.id)
          } catch (_) {
            rec = new Record(col)
            rec.set('id', item.id)
          }
          rec.set('control_id', controlId)
          if (item.category_id) rec.set('category_id', item.category_id)
          if (typeof item.month === 'number') rec.set('month', item.month)
          if (typeof item.year === 'number') rec.set('year', item.year)
          if (typeof item.amount === 'number') rec.set('amount', item.amount)
          $app.save(rec)
          report.budgets++
        } catch (err) {
          report.errors.push('Orçamento (' + item.id + '): ' + err.message)
        }
      }
    }

    // 6. Metas
    if (Array.isArray(snapshot.goals)) {
      const col = $app.findCollectionByNameOrId('goals')
      for (let i = 0; i < snapshot.goals.length; i++) {
        const item = snapshot.goals[i]
        try {
          let rec
          try {
            rec = $app.findRecordById('goals', item.id)
          } catch (_) {
            rec = new Record(col)
            rec.set('id', item.id)
          }
          rec.set('control_id', controlId)
          if (item.name) rec.set('name', item.name)
          if (typeof item.target_amount === 'number') rec.set('target_amount', item.target_amount)
          if (typeof item.current_amount === 'number')
            rec.set('current_amount', item.current_amount)
          if (item.color) rec.set('color', item.color)
          if (item.deadline) rec.set('deadline', item.deadline)
          $app.save(rec)
          report.goals++
        } catch (err) {
          report.errors.push('Meta ' + item.name + ' (' + item.id + '): ' + err.message)
        }
      }
    }

    // 7. Transações (upsert)
    if (Array.isArray(snapshot.transactions)) {
      const col = $app.findCollectionByNameOrId('transactions')
      for (let i = 0; i < snapshot.transactions.length; i++) {
        const item = snapshot.transactions[i]
        try {
          let rec
          try {
            rec = $app.findRecordById('transactions', item.id)
          } catch (_) {
            rec = new Record(col)
            rec.set('id', item.id)
          }
          rec.set('control_id', controlId)
          if (item.user_id) rec.set('user_id', item.user_id)
          if (item.type) rec.set('type', item.type)
          if (typeof item.amount === 'number') rec.set('amount', item.amount)
          if (item.description) rec.set('description', item.description)
          if (item.category_id) rec.set('category_id', item.category_id)
          if (item.subcategory_id) rec.set('subcategory_id', item.subcategory_id)
          if (item.account_id) rec.set('account_id', item.account_id)
          if (item.credit_card_id) rec.set('credit_card_id', item.credit_card_id)
          if (item.date) rec.set('date', item.date)
          if (item.payment_date) rec.set('payment_date', item.payment_date)
          if (typeof item.paid === 'boolean') rec.set('paid', item.paid)
          if (typeof item.recurring === 'boolean') rec.set('recurring', item.recurring)
          if (typeof item.is_recurring === 'boolean') rec.set('is_recurring', item.is_recurring)
          if (item.recurrence_period) rec.set('recurrence_period', item.recurrence_period)
          if (item.recurrence_type) rec.set('recurrence_type', item.recurrence_type)
          if (typeof item.installment_number === 'number')
            rec.set('installment_number', item.installment_number)
          if (typeof item.installment_total === 'number')
            rec.set('installment_total', item.installment_total)
          if (item.parent_transaction_id)
            rec.set('parent_transaction_id', item.parent_transaction_id)
          if (typeof item.notes === 'string') rec.set('notes', item.notes)
          $app.save(rec)
          report.transactions++
        } catch (err) {
          report.errors.push('Transação ' + item.description + ' (' + item.id + '): ' + err.message)
        }
      }
    }

    // 8. Aprendizados de IA
    if (Array.isArray(snapshot.ai_learnings)) {
      const col = $app.findCollectionByNameOrId('ai_learnings')
      for (let i = 0; i < snapshot.ai_learnings.length; i++) {
        const item = snapshot.ai_learnings[i]
        try {
          let rec
          try {
            rec = $app.findRecordById('ai_learnings', item.id)
          } catch (_) {
            rec = new Record(col)
            rec.set('id', item.id)
          }
          rec.set('control_id', controlId)
          if (item.user_id) rec.set('user_id', item.user_id)
          if (item.original_text) rec.set('original_text', item.original_text)
          if (item.ai_category_id) rec.set('ai_category_id', item.ai_category_id)
          if (item.ai_subcategory_id) rec.set('ai_subcategory_id', item.ai_subcategory_id)
          if (item.ai_type) rec.set('ai_type', item.ai_type)
          if (item.ai_description) rec.set('ai_description', item.ai_description)
          if (item.corrected_category_id)
            rec.set('corrected_category_id', item.corrected_category_id)
          if (item.corrected_subcategory_id)
            rec.set('corrected_subcategory_id', item.corrected_subcategory_id)
          if (item.corrected_type) rec.set('corrected_type', item.corrected_type)
          if (item.corrected_description)
            rec.set('corrected_description', item.corrected_description)
          $app.save(rec)
          report.ai_learnings++
        } catch (err) {
          report.errors.push('Aprendizado IA (' + item.id + '): ' + err.message)
        }
      }
    }

    // 9. Recalcular saldos de contas
    try {
      const accountsList = $app.findRecordsByFilter(
        'accounts',
        'control_id = {:cid}',
        'name',
        5000,
        0,
        { cid: controlId },
      )
      for (let i = 0; i < accountsList.length; i++) {
        const acc = accountsList[i]
        const accTxs = $app.findRecordsByFilter(
          'transactions',
          'account_id = {:accId} && paid = true',
          'date',
          100000,
          0,
          { accId: acc.id },
        )
        let calcBalance = 0
        for (let j = 0; j < accTxs.length; j++) {
          const tx = accTxs[j]
          const amt = tx.getFloat('amount')
          const tType = tx.getString('type')
          if (tType === 'receita') calcBalance += amt
          else if (tType === 'despesa') calcBalance -= amt
        }
        acc.set('balance', Math.round(calcBalance * 100) / 100)
        $app.save(acc)
      }
    } catch (balErr) {
      console.log('[backup] Aviso ao recalcular saldos pós-restauração: ' + balErr.message)
    }

    return report
  }

  const body = e.requestInfo().body || {}
  const controlId = body.controlId
  const backupId = body.backupId
  let snapshot = body.snapshot

  if (!controlId) {
    return e.json(400, { message: 'Parâmetro controlId obrigatório.' })
  }

  if (!checkAdmin(authRecord.id, controlId)) {
    return e.json(403, {
      message: 'Apenas administradores ou proprietários podem restaurar dados.',
    })
  }

  if (backupId) {
    try {
      const backupRec = $app.findRecordById('data_backups', backupId)
      if (backupRec.getString('control_id') !== controlId) {
        return e.json(403, { message: 'Backup não pertence a este controle.' })
      }
      const storedJson = backupRec.get('data_json')
      if (storedJson && typeof storedJson === 'object') {
        snapshot = storedJson
      } else if (typeof storedJson === 'string') {
        snapshot = JSON.parse(storedJson)
      }
    } catch (err) {
      return e.json(404, { message: 'Backup não encontrado: ' + err.message })
    }
  }

  if (!snapshot) {
    return e.json(400, { message: 'Nenhum dado ou snapshot fornecido para restauração.' })
  }

  try {
    const report = restoreSnapshot(controlId, snapshot)
    return e.json(200, {
      success: true,
      message: 'Restauração concluída com sucesso.',
      report: report,
    })
  } catch (err) {
    console.log('[backup] Erro na restauração: ' + err.message)
    return e.json(500, {
      success: false,
      message: 'Falha na restauração: ' + err.message,
    })
  }
})

// -------------------------------------------------------------
// GET /backend/v1/custom/backup-download/{id}
// Baixa diretamente o JSON do snapshot do backup
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/custom/backup-download/{id}', (e) => {
  const backupId = e.request.pathValue('id')
  const authRecord = e.auth
  if (!authRecord) {
    return e.json(401, { message: 'Não autenticado.' })
  }

  const checkAdmin = (uid, cid) => {
    try {
      const callerMember = $app.findFirstRecordByFilter(
        'control_members',
        'control_id = {:cid} && user_id = {:uid} && status = "active"',
        { cid: cid, uid: uid },
      )
      if (callerMember) {
        const role = callerMember.getString('role')
        if (role === 'owner' || role === 'admin') return true
      }
    } catch (_) {}
    try {
      const ctrl = $app.findRecordById('financial_controls', cid)
      if (ctrl && ctrl.getString('owner_id') === uid) return true
    } catch (_) {}
    return false
  }

  try {
    const backupRec = $app.findRecordById('data_backups', backupId)
    const controlId = backupRec.getString('control_id')
    if (!checkAdmin(authRecord.id, controlId)) {
      return e.json(403, { message: 'Acesso negado ao backup.' })
    }

    let dataJson = backupRec.get('data_json')
    if (!dataJson) {
      return e.json(404, { message: 'Dados do backup não encontrados.' })
    }

    let payloadStr
    if (typeof dataJson === 'string') {
      payloadStr = dataJson
    } else {
      payloadStr = JSON.stringify(dataJson, null, 2)
    }

    return e.blob(200, 'application/json', payloadStr)
  } catch (err) {
    return e.json(404, { message: 'Backup não encontrado: ' + err.message })
  }
})

// -------------------------------------------------------------
// CRON JOB: BACKUP DIÁRIO DE TODOS OS CONTROLES ATIVOS
// -------------------------------------------------------------
cronAdd('backup-daily-snapshot', '30 3 * * *', () => {
  console.log('[cron:backup] Iniciando rotina diária de backup...')
  try {
    const controls = $app.findRecordsByFilter('financial_controls', 'id != ""', 'created', 1000, 0)

    console.log('[cron:backup] Total de controles para backup: ' + controls.length)
    for (let i = 0; i < controls.length; i++) {
      const ctrl = controls[i]
      const cid = ctrl.id
      try {
        const now = new Date()
        const currentYear = now.getUTCFullYear()
        const dateStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').slice(0, 19)

        // Exportação simplificada inline
        let controlData = {
          id: ctrl.id,
          name: ctrl.getString('name'),
          description: ctrl.getString('description'),
          color: ctrl.getString('color'),
          owner_id: ctrl.getString('owner_id'),
          owner_email: ctrl.getString('owner_email'),
          created: ctrl.getString('created'),
          updated: ctrl.getString('updated'),
        }

        const rawMembers = $app.findRecordsByFilter(
          'control_members',
          'control_id = {:cid}',
          'created',
          5000,
          0,
          { cid: cid },
        )
        const members = []
        const userIdsSet = {}
        for (let mIdx = 0; mIdx < rawMembers.length; mIdx++) {
          const m = rawMembers[mIdx]
          const uId = m.getString('user_id')
          if (uId) userIdsSet[uId] = true
          members.push({
            id: m.id,
            control_id: m.getString('control_id'),
            user_id: uId,
            email: m.getString('email'),
            invited_email: m.getString('invited_email'),
            role: m.getString('role'),
            status: m.getString('status'),
            created: m.getString('created'),
            updated: m.getString('updated'),
          })
        }
        if (controlData.owner_id) userIdsSet[controlData.owner_id] = true

        const users = []
        const userIds = Object.keys(userIdsSet)
        for (let uIdx = 0; uIdx < userIds.length; uIdx++) {
          try {
            const u = $app.findRecordById('users', userIds[uIdx])
            users.push({
              id: u.id,
              name: u.getString('name'),
              email: u.getString('email'),
              avatar: u.getString('avatar'),
              created: u.getString('created'),
              updated: u.getString('updated'),
            })
          } catch (_) {}
        }

        const rawAccounts = $app.findRecordsByFilter(
          'accounts',
          'control_id = {:cid}',
          'name',
          5000,
          0,
          { cid: cid },
        )
        const accounts = []
        for (let aIdx = 0; aIdx < rawAccounts.length; aIdx++) {
          const a = rawAccounts[aIdx]
          accounts.push({
            id: a.id,
            control_id: a.getString('control_id'),
            name: a.getString('name'),
            type: a.getString('type'),
            balance: a.getFloat('balance'),
            limit: a.getFloat('limit'),
            color: a.getString('color'),
            bank: a.getString('bank'),
            due_day: a.getInt('due_day'),
            closing_day: a.getInt('closing_day'),
            is_primary: a.getBool('is_primary'),
            created: a.getString('created'),
            updated: a.getString('updated'),
          })
        }

        const rawCreditCards = $app.findRecordsByFilter(
          'credit_cards',
          'control_id = {:cid}',
          'name',
          5000,
          0,
          { cid: cid },
        )
        const credit_cards = []
        for (let cIdx = 0; cIdx < rawCreditCards.length; cIdx++) {
          const c = rawCreditCards[cIdx]
          credit_cards.push({
            id: c.id,
            control_id: c.getString('control_id'),
            name: c.getString('name'),
            brand: c.getString('brand'),
            last_four: c.getString('last_four'),
            closing_day: c.getInt('closing_day'),
            due_day: c.getInt('due_day'),
            limit_amount: c.getFloat('limit_amount'),
            color: c.getString('color'),
            created: c.getString('created'),
            updated: c.getString('updated'),
          })
        }

        const rawCategories = $app.findRecordsByFilter(
          'categories',
          'control_id = {:cid}',
          'name',
          5000,
          0,
          { cid: cid },
        )
        const categories = []
        for (let catIdx = 0; catIdx < rawCategories.length; catIdx++) {
          const cat = rawCategories[catIdx]
          categories.push({
            id: cat.id,
            control_id: cat.getString('control_id'),
            name: cat.getString('name'),
            type: cat.getString('type'),
            color: cat.getString('color'),
            icon: cat.getString('icon'),
            is_default: cat.getBool('is_default'),
            created: cat.getString('created'),
            updated: cat.getString('updated'),
          })
        }

        const rawSubcategories = $app.findRecordsByFilter(
          'subcategories',
          'control_id = {:cid}',
          'name',
          5000,
          0,
          { cid: cid },
        )
        const subcategories = []
        for (let sIdx = 0; sIdx < rawSubcategories.length; sIdx++) {
          const s = rawSubcategories[sIdx]
          subcategories.push({
            id: s.id,
            control_id: s.getString('control_id'),
            category_id: s.getString('category_id'),
            name: s.getString('name'),
            color: s.getString('color'),
            icon: s.getString('icon'),
            created: s.getString('created'),
            updated: s.getString('updated'),
          })
        }

        const rawBudgets = $app.findRecordsByFilter(
          'budgets',
          'control_id = {:cid}',
          'created',
          10000,
          0,
          { cid: cid },
        )
        const budgets = []
        for (let bIdx = 0; bIdx < rawBudgets.length; bIdx++) {
          const b = rawBudgets[bIdx]
          budgets.push({
            id: b.id,
            control_id: b.getString('control_id'),
            category_id: b.getString('category_id'),
            month: b.getInt('month'),
            year: b.getInt('year'),
            amount: b.getFloat('amount'),
            created: b.getString('created'),
            updated: b.getString('updated'),
          })
        }

        const rawGoals = $app.findRecordsByFilter(
          'goals',
          'control_id = {:cid}',
          'created',
          5000,
          0,
          { cid: cid },
        )
        const goals = []
        for (let gIdx = 0; gIdx < rawGoals.length; gIdx++) {
          const g = rawGoals[gIdx]
          goals.push({
            id: g.id,
            control_id: g.getString('control_id'),
            name: g.getString('name'),
            target_amount: g.getFloat('target_amount'),
            current_amount: g.getFloat('current_amount'),
            color: g.getString('color'),
            deadline: g.getString('deadline'),
            created: g.getString('created'),
            updated: g.getString('updated'),
          })
        }

        const rawTransactions = $app.findRecordsByFilter(
          'transactions',
          'control_id = {:cid}',
          'date',
          100000,
          0,
          { cid: cid },
        )
        const transactions = []
        for (let tIdx = 0; tIdx < rawTransactions.length; tIdx++) {
          const t = rawTransactions[tIdx]
          transactions.push({
            id: t.id,
            control_id: t.getString('control_id'),
            user_id: t.getString('user_id'),
            type: t.getString('type'),
            amount: t.getFloat('amount'),
            description: t.getString('description'),
            category_id: t.getString('category_id'),
            subcategory_id: t.getString('subcategory_id'),
            account_id: t.getString('account_id'),
            credit_card_id: t.getString('credit_card_id'),
            date: t.getString('date'),
            payment_date: t.getString('payment_date'),
            paid: t.getBool('paid'),
            recurring: t.getBool('recurring'),
            is_recurring: t.getBool('is_recurring'),
            recurrence_period: t.getString('recurrence_period'),
            recurrence_type: t.getString('recurrence_type'),
            installment_number: t.getInt('installment_number'),
            installment_total: t.getInt('installment_total'),
            parent_transaction_id: t.getString('parent_transaction_id'),
            notes: t.getString('notes'),
            created: t.getString('created'),
            updated: t.getString('updated'),
          })
        }

        const rawLearnings = $app.findRecordsByFilter(
          'ai_learnings',
          'control_id = {:cid}',
          'created',
          10000,
          0,
          { cid: cid },
        )
        const ai_learnings = []
        for (let lIdx = 0; lIdx < rawLearnings.length; lIdx++) {
          const l = rawLearnings[lIdx]
          ai_learnings.push({
            id: l.id,
            control_id: l.getString('control_id'),
            user_id: l.getString('user_id'),
            original_text: l.getString('original_text'),
            ai_category_id: l.getString('ai_category_id'),
            ai_subcategory_id: l.getString('ai_subcategory_id'),
            ai_type: l.getString('ai_type'),
            ai_description: l.getString('ai_description'),
            corrected_category_id: l.getString('corrected_category_id'),
            corrected_subcategory_id: l.getString('corrected_subcategory_id'),
            corrected_type: l.getString('corrected_type'),
            corrected_description: l.getString('corrected_description'),
            created: l.getString('created'),
            updated: l.getString('updated'),
          })
        }

        const snapshot = {
          version: '1.0',
          app: 'Finanças do Casal - Controle Financeiro',
          exported_at: now.toISOString(),
          control: controlData,
          users: users,
          control_members: members,
          accounts: accounts,
          credit_cards: credit_cards,
          categories: categories,
          subcategories: subcategories,
          budgets: budgets,
          goals: goals,
          transactions: transactions,
          ai_learnings: ai_learnings,
          counts: {
            users: users.length,
            control_members: members.length,
            accounts: accounts.length,
            credit_cards: credit_cards.length,
            categories: categories.length,
            subcategories: subcategories.length,
            budgets: budgets.length,
            goals: goals.length,
            transactions: transactions.length,
            ai_learnings: ai_learnings.length,
          },
        }

        const jsonString = JSON.stringify(snapshot, null, 2)
        const sizeBytes = jsonString.length
        const backupsCol = $app.findCollectionByNameOrId('data_backups')

        // Backup anual (se não houver para o ano)
        let existingYearly = null
        try {
          existingYearly = $app.findFirstRecordByFilter(
            'data_backups',
            'control_id = {:cid} && backup_type = "yearly" && year = {:yr}',
            { cid: cid, yr: currentYear },
          )
        } catch (_) {}

        if (!existingYearly) {
          try {
            const yRecord = new Record(backupsCol)
            yRecord.set('control_id', cid)
            yRecord.set('name', 'Backup Anual ' + currentYear)
            yRecord.set('backup_type', 'yearly')
            yRecord.set('year', currentYear)
            yRecord.set('size_bytes', sizeBytes)
            yRecord.set('data_json', snapshot)
            yRecord.set('metadata', {
              counts: snapshot.counts,
              created_at: now.toISOString(),
            })
            yRecord.set('created_by', 'cron')
            try {
              const yFile = $filesystem.fileFromBytes(jsonString, 'backup_' + currentYear + '.json')
              yRecord.set('file', yFile)
            } catch (_) {}
            $app.save(yRecord)
          } catch (yErr) {
            console.log('[cron:backup] Falha ao criar anual: ' + yErr.message)
          }
        }

        // Backup corrente (substitui/mantém apenas 1)
        const currentRecords = $app.findRecordsByFilter(
          'data_backups',
          'control_id = {:cid} && backup_type = "current"',
          '-created',
          50,
          0,
          { cid: cid },
        )

        let targetRecord
        if (currentRecords.length > 0) {
          targetRecord = currentRecords[0]
          for (let k = 1; k < currentRecords.length; k++) {
            try {
              $app.delete(currentRecords[k])
            } catch (_) {}
          }
        } else {
          targetRecord = new Record(backupsCol)
          targetRecord.set('control_id', cid)
        }

        const currentName = 'Backup Mais Recente (' + dateStr.slice(0, 10) + ')'
        targetRecord.set('name', currentName)
        targetRecord.set('backup_type', 'current')
        targetRecord.set('year', currentYear)
        targetRecord.set('size_bytes', sizeBytes)
        targetRecord.set('data_json', snapshot)
        targetRecord.set('metadata', {
          counts: snapshot.counts,
          generated_at: now.toISOString(),
          caller_id: 'cron',
        })
        targetRecord.set('created_by', 'cron')

        try {
          const curFile = $filesystem.fileFromBytes(
            jsonString,
            'backup_recente_' + dateStr + '.json',
          )
          targetRecord.set('file', curFile)
        } catch (_) {}

        $app.save(targetRecord)
        console.log('[cron:backup] Backup realizado com sucesso para controle: ' + cid)
      } catch (cErr) {
        console.log('[cron:backup] Erro no controle ' + cid + ': ' + cErr.message)
      }
    }
    console.log('[cron:backup] Rotina diária de backup finalizada.')
  } catch (err) {
    console.log('[cron:backup] Erro geral: ' + err.message)
  }
})
