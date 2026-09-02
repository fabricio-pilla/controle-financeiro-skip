migrate(
  (app) => {
    // Fix transactions with installment_total = 0 or NULL that have installment suffixes in description (e.g. "Emprestimo (1/10)")
    const records = app.findRecordsByFilter(
      'transactions',
      'installment_number > 0 && (installment_total = 0 || installment_total = null)',
      '',
      500,
      0,
    )
    for (const r of records) {
      const desc = r.getString('description')
      const match = desc.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/)
      if (match) {
        const current = parseInt(match[1], 10)
        const total = parseInt(match[2], 10)
        if (total > 0) {
          r.set('installment_total', total)
          if (current > 0) {
            r.set('installment_number', current)
          }
          app.save(r)
        }
      }
    }
  },
  (app) => {},
)
