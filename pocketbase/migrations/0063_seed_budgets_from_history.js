// pocketbase/migrations/0063_seed_budgets_from_history.js
// Cria orçamentos mensais para cada categoria de despesa relevante baseado na média dos últimos 3 meses fechados.
migrate(
  (app) => {
    const controls = app.findRecordsByFilter('financial_controls', 'id != ""', 'created', 100, 0)
    if (!controls || controls.length === 0) {
      console.log('[0063] Nenhum controle encontrado.')
      return
    }

    const budgetsCollection = app.findCollectionByNameOrId('budgets')
    const currentMonth = 11 // Novembro
    const currentYear = 2026

    for (let c = 0; c < controls.length; c++) {
      const control = controls[c]
      const controlId = control.id

      // 1. Obter categorias de despesa ativas do controle
      const categories = app.findRecordsByFilter(
        'categories',
        `control_id = '${controlId}' && type = 'despesa' && active = true`,
        'name',
        500,
        0,
      )

      if (!categories || categories.length === 0) continue

      // 2. Buscar transações dos últimos 3 meses fechados (agosto, setembro, outubro de 2026)
      const txs = app.findRecordsByFilter(
        'transactions',
        `control_id = '${controlId}' && type = 'despesa' && date >= '2026-08-01 00:00:00' && date <= '2026-10-31 23:59:59'`,
        'date',
        10000,
        0,
      )

      // Somar por category_id
      const catTotals = {}
      for (let t = 0; t < txs.length; t++) {
        const tx = txs[t]
        const instNum = tx.getInt('installment_number')
        const instTot = tx.getInt('installment_total')
        // Ignorar pai consolidado
        if (instNum === 0 && instTot > 0) continue

        const catId = tx.getString('category_id')
        if (!catId) continue

        const amt = tx.getFloat('amount') || 0
        catTotals[catId] = (catTotals[catId] || 0) + amt
      }

      console.log(`[0063] Controle ${controlId} - Totais por categoria:`, JSON.stringify(catTotals))

      for (let k = 0; k < categories.length; k++) {
        const cat = categories[k]
        const catId = cat.id
        const catName = cat.getString('name')

        // Verificar se já existe orçamento para esta categoria no mês/ano atual
        const existing = app.findRecordsByFilter(
          'budgets',
          `control_id = '${controlId}' && category_id = '${catId}' && month = ${currentMonth} && year = ${currentYear}`,
          'created',
          1,
          0,
        )

        if (existing && existing.length > 0) {
          console.log(
            `[0063] Orçamento já existe para ${catName} em ${currentMonth}/${currentYear}.`,
          )
          continue
        }

        const totalSpent3m = catTotals[catId] || 0
        const avgMonthly = totalSpent3m / 3

        // Se média for irrelevante ou zero, atribuir um padrão razoável ou arredondar
        let budgetAmount = 0
        if (avgMonthly >= 50) {
          // Arredondar para cima para valor redondo (múltiplos de 50 ou 100)
          if (avgMonthly < 500) {
            budgetAmount = Math.ceil(avgMonthly / 50) * 50
          } else if (avgMonthly < 2000) {
            budgetAmount = Math.ceil(avgMonthly / 100) * 100
          } else {
            budgetAmount = Math.ceil(avgMonthly / 250) * 250
          }
        } else {
          // Valor mínimo padrão para categorias cadastradas
          budgetAmount = 200
        }

        const budgetRecord = new Record(budgetsCollection)
        budgetRecord.set('control_id', controlId)
        budgetRecord.set('category_id', catId)
        budgetRecord.set('amount', budgetAmount)
        budgetRecord.set('month', currentMonth)
        budgetRecord.set('year', currentYear)
        budgetRecord.set('is_recurring', true)
        budgetRecord.set('alert_threshold', 80)
        budgetRecord.set('active', true)
        app.save(budgetRecord)

        console.log(
          `[0063] Orçamento criado para ${catName} (${catId}): R$ ${budgetAmount} (média 3m: R$ ${avgMonthly.toFixed(2)})`,
        )
      }
    }
  },
  (app) => {
    // Rollback se necessário
  },
)
