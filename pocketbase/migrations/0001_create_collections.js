migrate(
  (app) => {
    // All collections allow authenticated users to list/view; the app enforces
    // tenant isolation by always filtering on the user's company memberships.
    const AUTH = "@request.auth.id != ''"

    // ---- companies ----
    const companies = new Collection({
      name: 'companies',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'segment',
          type: 'select',
          required: true,
          values: ['Serviços', 'Comércio', 'Indústria', 'Tecnologia', 'Varejo', 'Outro'],
          maxSelect: 1,
        },
        { name: 'color', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'owner_id', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_companies_owner ON companies (owner_id)'],
    })
    app.save(companies)

    const companiesColId = app.findCollectionByNameOrId('companies').id

    // ---- company_members ----
    const members = new Collection({
      name: 'company_members',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          required: true,
          collectionId: companiesColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'user_id', type: 'text' },
        { name: 'email', type: 'email' },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['owner', 'admin', 'member'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['active', 'pending'],
          maxSelect: 1,
        },
        { name: 'invited_email', type: 'email' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_company_members_company_email ON company_members (company_id, email) WHERE email != ''",
        'CREATE INDEX idx_company_members_user ON company_members (user_id)',
      ],
    })
    app.save(members)

    // ---- accounts ----
    const accounts = new Collection({
      name: 'accounts',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          required: true,
          collectionId: companiesColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['carteira', 'banco', 'pix', 'credito', 'investimento'],
          maxSelect: 1,
        },
        { name: 'balance', type: 'number' },
        { name: 'limit', type: 'number' },
        { name: 'color', type: 'text' },
        { name: 'bank', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_accounts_company ON accounts (company_id)'],
    })
    app.save(accounts)

    // ---- credit_cards ----
    const creditCards = new Collection({
      name: 'credit_cards',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          required: true,
          collectionId: companiesColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'brand', type: 'text' },
        { name: 'last_four', type: 'text' },
        { name: 'closing_day', type: 'number' },
        { name: 'due_day', type: 'number' },
        { name: 'limit_amount', type: 'number' },
        { name: 'color', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_credit_cards_company ON credit_cards (company_id)'],
    })
    app.save(creditCards)

    // ---- categories ----
    const categories = new Collection({
      name: 'categories',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          required: true,
          collectionId: companiesColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['receita', 'despesa'],
          maxSelect: 1,
        },
        { name: 'color', type: 'text' },
        { name: 'icon', type: 'text' },
        { name: 'is_default', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_categories_company ON categories (company_id)',
        'CREATE INDEX idx_categories_company_type ON categories (company_id, type)',
      ],
    })
    app.save(categories)

    const categoriesColId = app.findCollectionByNameOrId('categories').id
    const accountsColId = app.findCollectionByNameOrId('accounts').id
    const creditCardsColId = app.findCollectionByNameOrId('credit_cards').id

    // ---- budgets ----
    const budgets = new Collection({
      name: 'budgets',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          required: true,
          collectionId: companiesColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'category_id', type: 'relation', collectionId: categoriesColId, maxSelect: 1 },
        { name: 'month', type: 'number' },
        { name: 'year', type: 'number' },
        { name: 'amount', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_budgets_company ON budgets (company_id)'],
    })
    app.save(budgets)

    // ---- goals ----
    const goals = new Collection({
      name: 'goals',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          required: true,
          collectionId: companiesColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'target_amount', type: 'number' },
        { name: 'current_amount', type: 'number' },
        { name: 'color', type: 'text' },
        { name: 'deadline', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_goals_company ON goals (company_id)'],
    })
    app.save(goals)

    // ---- transactions ----
    const transactions = new Collection({
      name: 'transactions',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'company_id',
          type: 'relation',
          required: true,
          collectionId: companiesColId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'user_id', type: 'text' },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['receita', 'despesa'],
          maxSelect: 1,
        },
        { name: 'amount', type: 'number', required: true },
        { name: 'description', type: 'text', required: true },
        { name: 'category_id', type: 'relation', collectionId: categoriesColId, maxSelect: 1 },
        { name: 'account_id', type: 'relation', collectionId: accountsColId, maxSelect: 1 },
        { name: 'credit_card_id', type: 'relation', collectionId: creditCardsColId, maxSelect: 1 },
        { name: 'date', type: 'date', required: true },
        { name: 'paid', type: 'bool' },
        { name: 'recurring', type: 'bool' },
        {
          name: 'recurrence_period',
          type: 'select',
          values: ['mensal', 'semanal', 'anual'],
          maxSelect: 1,
        },
        { name: 'installment_number', type: 'number' },
        { name: 'installment_total', type: 'number' },
        { name: 'parent_transaction_id', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'is_recurring', type: 'bool' },
        {
          name: 'recurrence_type',
          type: 'select',
          values: ['mensal', 'semanal', 'anual'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_transactions_company ON transactions (company_id)',
        'CREATE INDEX idx_transactions_company_date ON transactions (company_id, date)',
        'CREATE INDEX idx_transactions_account ON transactions (account_id)',
        'CREATE INDEX idx_transactions_category ON transactions (category_id)',
      ],
    })
    app.save(transactions)
  },
  (app) => {
    const names = [
      'transactions',
      'goals',
      'budgets',
      'categories',
      'credit_cards',
      'accounts',
      'company_members',
      'companies',
    ]
    names.forEach((n) => {
      try {
        const col = app.findCollectionByNameOrId(n)
        app.delete(col)
      } catch (_) {}
    })
  },
)
