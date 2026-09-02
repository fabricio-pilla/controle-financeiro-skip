// Adiciona campos `due_day` (dia do mês de vencimento da fatura, 1-31) e
// `is_primary` (flag de conta principal/padrão) na coleção `accounts`.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('accounts')

    if (!col.fields.getByName('due_day')) {
      col.fields.add(
        new NumberField({
          name: 'due_day',
          min: 1,
          max: 31,
          onlyInt: true,
        }),
      )
    }

    if (!col.fields.getByName('is_primary')) {
      col.fields.add(
        new BoolField({
          name: 'is_primary',
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('accounts')

    if (col.fields.getByName('due_day')) {
      col.fields.removeByName('due_day')
    }
    if (col.fields.getByName('is_primary')) {
      col.fields.removeByName('is_primary')
    }

    app.save(col)
  },
)
