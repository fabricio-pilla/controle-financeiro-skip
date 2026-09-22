migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"
    const controlsColId = app.findCollectionByNameOrId('financial_controls').id
    const categoriesColId = app.findCollectionByNameOrId('categories').id
    const subcategoriesColId = app.findCollectionByNameOrId('subcategories').id

    try {
      app.findCollectionByNameOrId('ai_learnings')
    } catch (_) {
      const aiLearnings = new Collection({
        name: 'ai_learnings',
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
          { name: 'user_id', type: 'text', required: true },
          { name: 'original_text', type: 'text', required: true },
          {
            name: 'ai_category_id',
            type: 'relation',
            collectionId: categoriesColId,
            maxSelect: 1,
          },
          {
            name: 'ai_subcategory_id',
            type: 'relation',
            collectionId: subcategoriesColId,
            maxSelect: 1,
          },
          {
            name: 'ai_type',
            type: 'select',
            values: ['receita', 'despesa'],
            maxSelect: 1,
          },
          { name: 'ai_description', type: 'text' },
          {
            name: 'corrected_category_id',
            type: 'relation',
            collectionId: categoriesColId,
            maxSelect: 1,
          },
          {
            name: 'corrected_subcategory_id',
            type: 'relation',
            collectionId: subcategoriesColId,
            maxSelect: 1,
          },
          {
            name: 'corrected_type',
            type: 'select',
            values: ['receita', 'despesa'],
            maxSelect: 1,
          },
          { name: 'corrected_description', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ai_learnings_control ON ai_learnings (control_id)',
          'CREATE INDEX idx_ai_learnings_user ON ai_learnings (user_id)',
          'CREATE INDEX idx_ai_learnings_control_user ON ai_learnings (control_id, user_id)',
        ],
      })
      app.save(aiLearnings)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('ai_learnings')
      app.delete(col)
    } catch (_) {}
  },
)
