// Adiciona campo `closing_day` (dia do fechamento da fatura, 1-31) na coleção `accounts`
// e campo `payment_date` (data de pagamento / saída do bolso, date) na coleção `transactions`.
migrate(
  (app) => {
    // 1. Atualiza coleção accounts com closing_day
    const accountsCol = app.findCollectionByNameOrId('accounts')
    if (!accountsCol.fields.getByName('closing_day')) {
      accountsCol.fields.add(
        new NumberField({
          name: 'closing_day',
          min: 1,
          max: 31,
          onlyInt: true,
        }),
      )
      app.save(accountsCol)
    }

    // 2. Atualiza coleção transactions com payment_date
    const txCol = app.findCollectionByNameOrId('transactions')
    if (!txCol.fields.getByName('payment_date')) {
      txCol.fields.add(
        new DateField({
          name: 'payment_date',
        }),
      )
      app.save(txCol)
    }
  },
  (app) => {
    try {
      const accountsCol = app.findCollectionByNameOrId('accounts')
      if (accountsCol.fields.getByName('closing_day')) {
        accountsCol.fields.removeByName('closing_day')
        app.save(accountsCol)
      }
    } catch (_) {}

    try {
      const txCol = app.findCollectionByNameOrId('transactions')
      if (txCol.fields.getByName('payment_date')) {
        txCol.fields.removeByName('payment_date')
        app.save(txCol)
      }
    } catch (_) {}
  },
)
