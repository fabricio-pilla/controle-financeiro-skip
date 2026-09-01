migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('transactions')
    if (col.fields.getByName('responsible')) {
      col.fields.removeByName('responsible')
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('transactions')
    if (!col.fields.getByName('responsible')) {
      col.fields.add(
        new TextField({
          name: 'responsible',
          required: false,
        }),
      )
      app.save(col)
    }
  },
)
