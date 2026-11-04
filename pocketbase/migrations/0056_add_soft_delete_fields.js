// pocketbase/migrations/0056_add_soft_delete_fields.js
// Adiciona campo 'active' (booleano) nas coleções 'accounts', 'categories' e 'subcategories'
// para suporte a soft delete / inativação / restauração mantendo integridade com transações históricas.

migrate(
  (app) => {
    // 1. accounts
    const accountsCol = app.findCollectionByNameOrId('accounts')
    if (!accountsCol.fields.getByName('active')) {
      accountsCol.fields.add(
        new BoolField({
          name: 'active',
        }),
      )
      app.save(accountsCol)
    }

    // 2. categories
    const categoriesCol = app.findCollectionByNameOrId('categories')
    if (!categoriesCol.fields.getByName('active')) {
      categoriesCol.fields.add(
        new BoolField({
          name: 'active',
        }),
      )
      app.save(categoriesCol)
    }

    // 3. subcategories
    const subcategoriesCol = app.findCollectionByNameOrId('subcategories')
    if (!subcategoriesCol.fields.getByName('active')) {
      subcategoriesCol.fields.add(
        new BoolField({
          name: 'active',
        }),
      )
      app.save(subcategoriesCol)
    }

    // Backfill: define active = true para todos os registros existentes que estiverem nulos ou falsos
    try {
      app
        .db()
        .newQuery('UPDATE accounts SET active = true WHERE active IS NULL OR active = false')
        .execute()
      app
        .db()
        .newQuery('UPDATE categories SET active = true WHERE active IS NULL OR active = false')
        .execute()
      app
        .db()
        .newQuery('UPDATE subcategories SET active = true WHERE active IS NULL OR active = false')
        .execute()
    } catch (e) {
      console.log('[0056] Aviso no backfill de active:', e)
    }
  },
  (app) => {
    const accountsCol = app.findCollectionByNameOrId('accounts')
    if (accountsCol.fields.getByName('active')) {
      accountsCol.fields.removeByName('active')
      app.save(accountsCol)
    }

    const categoriesCol = app.findCollectionByNameOrId('categories')
    if (categoriesCol.fields.getByName('active')) {
      categoriesCol.fields.removeByName('active')
      app.save(categoriesCol)
    }

    const subcategoriesCol = app.findCollectionByNameOrId('subcategories')
    if (subcategoriesCol.fields.getByName('active')) {
      subcategoriesCol.fields.removeByName('active')
      app.save(subcategoriesCol)
    }
  },
)
