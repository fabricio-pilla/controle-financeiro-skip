migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"
    const controlsColId = app.findCollectionByNameOrId('financial_controls').id
    const categoriesColId = app.findCollectionByNameOrId('categories').id

    // 1. Criar collection subcategories se não existir
    try {
      app.findCollectionByNameOrId('subcategories')
    } catch (_) {
      const subcategories = new Collection({
        name: 'subcategories',
        type: 'base',
        listRule: AUTH,
        viewRule: AUTH,
        createRule: AUTH,
        updateRule: AUTH,
        deleteRule: AUTH,
        fields: [
          {
            name: 'control_id',
            type: 'relation',
            required: true,
            collectionId: controlsColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'category_id',
            type: 'relation',
            required: true,
            collectionId: categoriesColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'color', type: 'text' },
          { name: 'icon', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_subcategories_control ON subcategories (control_id)',
          'CREATE INDEX idx_subcategories_category ON subcategories (category_id)',
          'CREATE INDEX idx_subcategories_control_cat ON subcategories (control_id, category_id)',
        ],
      })
      app.save(subcategories)
    }

    // 2. Adicionar subcategory_id em transactions se não existir
    const subcategoriesCol = app.findCollectionByNameOrId('subcategories')
    const transactionsCol = app.findCollectionByNameOrId('transactions')

    if (!transactionsCol.fields.getByName('subcategory_id')) {
      transactionsCol.fields.add(
        new RelationField({
          name: 'subcategory_id',
          collectionId: subcategoriesCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      transactionsCol.addIndex('idx_transactions_subcategory', false, 'subcategory_id', '')
      app.save(transactionsCol)
    }
  },
  (app) => {
    try {
      const transactionsCol = app.findCollectionByNameOrId('transactions')
      if (transactionsCol.fields.getByName('subcategory_id')) {
        transactionsCol.fields.removeByName('subcategory_id')
        transactionsCol.removeIndex('idx_transactions_subcategory')
        app.save(transactionsCol)
      }
    } catch (_) {}

    try {
      const subcategoriesCol = app.findCollectionByNameOrId('subcategories')
      app.delete(subcategoriesCol)
    } catch (_) {}
  },
)
