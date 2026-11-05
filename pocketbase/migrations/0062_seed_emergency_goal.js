// pocketbase/migrations/0062_seed_emergency_goal.js
// Cria a meta de Reserva de Emergência baseada nas despesas médias reais e saldos de contas,
// e a meta de exemplo Férias em Família.
migrate(
  (app) => {
    const controls = app.findRecordsByFilter('financial_controls', 'id != ""', 'created', 100, 0)
    if (!controls || controls.length === 0) {
      console.log('[0062] Nenhum controle financeiro encontrado.')
      return
    }

    const goalsCollection = app.findCollectionByNameOrId('goals')

    for (let c = 0; c < controls.length; c++) {
      const control = controls[c]
      const controlId = control.id

      // Verificar se já existe a meta "Reserva de Emergência" neste controle
      const existingGoals = app.findRecordsByFilter(
        'goals',
        `control_id = '${controlId}' && name ~ 'Reserva de Emergência'`,
        'created',
        10,
        0,
      )

      if (existingGoals && existingGoals.length > 0) {
        console.log(`[0062] Reserva de Emergência já existe para o controle ${controlId}.`)
        continue
      }

      // 1. Calcular soma de saldos das contas ativas (banco, carteira, investimento, poupança)
      const accounts = app.findRecordsByFilter(
        'accounts',
        `control_id = '${controlId}' && active = true`,
        'name',
        500,
        0,
      )

      let totalCurrentBalance = 0
      for (let a = 0; a < accounts.length; a++) {
        const acc = accounts[a]
        const type = acc.getString('type')
        if (
          type === 'banco' ||
          type === 'poupanca' ||
          type === 'investimento' ||
          type === 'carteira' ||
          type === 'pix'
        ) {
          const bal = acc.getFloat('balance') || 0
          if (bal > 0) {
            totalCurrentBalance += bal
          }
        }
      }

      // 2. Calcular despesas dos últimos 3 meses fechados (agosto, setembro, outubro de 2026)
      const txs = app.findRecordsByFilter(
        'transactions',
        `control_id = '${controlId}' && type = 'despesa' && date >= '2026-08-01 00:00:00' && date <= '2026-10-31 23:59:59'`,
        'date',
        10000,
        0,
      )

      let totalExpenses = 0
      for (let t = 0; t < txs.length; t++) {
        const tx = txs[t]
        const instNum = tx.getInt('installment_number')
        const instTot = tx.getInt('installment_total')
        // Ignora pai consolidado
        if (instNum === 0 && instTot > 0) continue

        totalExpenses += tx.getFloat('amount') || 0
      }

      const monthlyAvgExpense = totalExpenses > 0 ? totalExpenses / 3 : 10000
      // 6x a despesa média mensal arredondada para cima em centenas/milhares
      let targetEmergency = Math.ceil((monthlyAvgExpense * 6) / 500) * 500
      if (targetEmergency <= 0) targetEmergency = 60000

      const currentEmergency = Math.round(totalCurrentBalance * 100) / 100

      // Prazo: 24 meses à frente (novembro de 2028)
      const deadlineDate = '2028-11-01 00:00:00.000Z'

      // Inserir meta Reserva de Emergência
      const emergencyRecord = new Record(goalsCollection)
      emergencyRecord.set('control_id', controlId)
      emergencyRecord.set('name', 'Reserva de Emergência')
      emergencyRecord.set('target_amount', targetEmergency)
      emergencyRecord.set('current_amount', currentEmergency)
      emergencyRecord.set('deadline', deadlineDate)
      emergencyRecord.set('color', '#10B981')
      emergencyRecord.set('icon', 'ShieldCheck')
      emergencyRecord.set('status', 'em_andamento')
      emergencyRecord.set(
        'description',
        `Meta de segurança equivalente a 6 meses do custo de vida familiar médio (aprox. R$ ` +
          Math.round(monthlyAvgExpense) +
          `/mês). Saldo atual baseado nas contas ativas.`,
      )
      emergencyRecord.set('active', true)
      app.save(emergencyRecord)

      console.log(
        `[0062] Criada Reserva de Emergência para controle ${controlId}: target=${targetEmergency}, current=${currentEmergency}`,
      )

      // Inserir meta exemplo: Férias em família
      const existingVacation = app.findRecordsByFilter(
        'goals',
        `control_id = '${controlId}' && name ~ 'Férias em família'`,
        'created',
        10,
        0,
      )

      if (!existingVacation || existingVacation.length === 0) {
        const vacationRecord = new Record(goalsCollection)
        vacationRecord.set('control_id', controlId)
        vacationRecord.set('name', 'Férias em família')
        vacationRecord.set('target_amount', 8000)
        vacationRecord.set('current_amount', 0)
        vacationRecord.set('deadline', '2027-07-01 00:00:00.000Z')
        vacationRecord.set('color', '#3B82F6')
        vacationRecord.set('icon', 'Plane')
        vacationRecord.set('status', 'em_andamento')
        vacationRecord.set('description', 'Economia planejada para viagem de férias com a família.')
        vacationRecord.set('active', true)
        app.save(vacationRecord)
        console.log(`[0062] Criada meta Férias em família para controle ${controlId}.`)
      }
    }
  },
  (app) => {
    // Rollback se necessário
  },
)
