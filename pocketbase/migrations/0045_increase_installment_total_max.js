migrate((app) => {
  const collection = app.findCollectionByNameOrId('transactions')
  const field = collection.fields.getByName('installment_total')
  if (field) {
    // Set max to 999
    field.max = 999
    app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('transactions')
  const field = collection.fields.getByName('installment_total')
  if (field) {
    field.max = 60
    app.save(collection)
  }
})
