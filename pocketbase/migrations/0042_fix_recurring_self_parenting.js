migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    const nowIso = new Date().toISOString()

    // 1. Identificar transações recorrentes com self-parenting ou coerência quebrada
    // Transações com recurrence_type='mensal' (ou recurrence_period='mensal')
    // mas com recurring=false / is_recurring=false e installment_total <= 1
    const brokenRecurringTxs = app.findRecordsByFilter(
      'transactions',
      `(recurrence_type = 'mensal' || recurrence_period = 'mensal') && (recurring = false || is_recurring = false) && installment_total <= 1`,
      'date',
      1000,
      0,
    )

    console.log(
      `[0042] Total de transações recorrentes inconsistentes encontradas: ${brokenRecurringTxs.length}`,
    )

    // Função auxiliar para calcular data alvo adicionando meses
    const computeTargetDate = (baseYear, baseMonth, origDay, monthOffset) => {
      const totalMonths = baseMonth - 1 + monthOffset
      const targetYear = baseYear + Math.floor(totalMonths / 12)
      const targetMonth = ((totalMonths % 12) + 12) % 12 // 0-11
      const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
      const targetDay = Math.min(Math.max(1, origDay), lastDay)

      const yyyy = String(targetYear).padStart(4, '0')
      const mm = String(targetMonth + 1).padStart(2, '0')
      const dd = String(targetDay).padStart(2, '0')
      return `${yyyy}-${mm}-${dd} 00:00:00.000Z`
    }

    const cleanDesc = (desc) => {
      if (!desc) return 'Sem descrição'
      let res = desc.replace(/\s*\(Total:\s*R\$[^)]+\)\s*$/i, '').trim()
      res = res.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/i, '').trim()
      return res || 'Sem descrição'
    }

    const affectedAccountIds = new Set()

    for (let i = 0; i < brokenRecurringTxs.length; i++) {
      const tx = brokenRecurringTxs[i]
      const txId = tx.id
      const accountId = tx.getString('account_id')
      if (accountId) affectedAccountIds.add(accountId)

      const parentId = tx.getString('parent_transaction_id')
      const isSelfParent = parentId === txId
      const newParentId = isSelfParent ? '' : parentId

      console.log(
        `[0042] Corrigindo campos da transação recorrente raiz: ${txId} (${tx.getString('description')}, data: ${tx.getString('date')}, selfParent: ${isSelfParent})`,
      )

      tx.set('recurring', true)
      tx.set('is_recurring', true)
      tx.set('installment_total', 0)
      tx.set('installment_number', 1)
      tx.set('parent_transaction_id', newParentId)
      tx.set('recurrence_type', 'mensal')
      tx.set('recurrence_period', 'mensal')
      app.save(tx)

      // 2. Criar as 12 ocorrências futuras faltantes a partir do mês seguinte ao date da série
      const dateStr = tx.getString('date') || ''
      if (!dateStr) continue

      const cleanDate = dateStr.split(/[T\s]/)[0]
      const parts = cleanDate.split('-')
      const baseYear = parseInt(parts[0], 10)
      const baseMonth = parseInt(parts[1], 10)
      const origDay = parseInt(parts[2], 10)

      const payDateStr = tx.getString('payment_date') || dateStr
      const cleanPayDate = payDateStr.split(/[T\s]/)[0]
      const payParts = cleanPayDate.split('-')
      const payOrigDay = parseInt(payParts[2], 10) || origDay

      const type = tx.getString('type')
      const desc = cleanDesc(tx.getString('description'))
      const amount = tx.getFloat('amount')
      const categoryId = tx.getString('category_id')
      const subcategoryId = tx.getString('subcategory_id')
      const controlId = tx.getString('control_id') || CONTROL_ID
      const userId = tx.getString('user_id')

      // Buscar transações existentes da mesma conta e tipo para verificar se já existem ocorrências futuras no mesmo mês
      const existingTxs = app.findRecordsByFilter(
        'transactions',
        `account_id = '${accountId}' && type = '${type}'`,
        'date',
        5000,
        0,
      )

      const existingMonths = new Set()
      for (let j = 0; j < existingTxs.length; j++) {
        const et = existingTxs[j]
        const eDesc = cleanDesc(et.getString('description'))
        if (eDesc.toLowerCase() === desc.toLowerCase()) {
          const eDate = et.getString('date') || ''
          if (eDate) existingMonths.add(eDate.substring(0, 7))
        }
      }

      // Adicionar o próprio mês da raiz
      existingMonths.add(
        `${String(baseYear).padStart(4, '0')}-${String(baseMonth).padStart(2, '0')}`,
      )

      const transactionsCollection = app.findCollectionByNameOrId('transactions')
      let createdFutureCount = 0

      for (let m = 1; m <= 12; m++) {
        const targetDate = computeTargetDate(baseYear, baseMonth, origDay, m)
        const targetYM = targetDate.substring(0, 7)

        if (existingMonths.has(targetYM)) {
          console.log(
            `[0042] Mês ${targetYM} já possui ocorrência para a série "${desc}". Pulando.`,
          )
          continue
        }

        existingMonths.add(targetYM)

        const targetPayDate = computeTargetDate(baseYear, baseMonth, payOrigDay, m)

        const futureRec = new Record(transactionsCollection)
        futureRec.set('control_id', controlId)
        futureRec.set('user_id', userId)
        futureRec.set('type', type)
        futureRec.set('amount', amount)
        futureRec.set('description', desc)
        futureRec.set('category_id', categoryId)
        futureRec.set('subcategory_id', subcategoryId)
        futureRec.set('account_id', accountId)
        futureRec.set('date', targetDate)
        futureRec.set('payment_date', targetPayDate)
        futureRec.set('paid', false)
        futureRec.set('is_recurring', true)
        futureRec.set('recurring', true)
        futureRec.set('recurrence_type', 'mensal')
        futureRec.set('recurrence_period', 'mensal')
        futureRec.set('installment_number', 1)
        futureRec.set('installment_total', 0)
        futureRec.set('parent_transaction_id', '')
        futureRec.set('notes', 'Gerado automaticamente: recorrência mensal')

        app.save(futureRec)
        createdFutureCount++
      }

      console.log(
        `[0042] Foram criadas ${createdFutureCount} ocorrências futuras para a série ${txId} (${desc}).`,
      )
    }

    // 3. Recalcular saldo de todas as contas do controle
    const accounts = app.findRecordsByFilter(
      'accounts',
      `control_id = '${CONTROL_ID}'`,
      'created',
      100,
      0,
    )

    console.log(`[0042] Recalculando saldo de ${accounts.length} contas do controle...`)

    for (let a = 0; a < accounts.length; a++) {
      const acc = accounts[a]
      const accId = acc.id
      const accType = acc.getString('type')

      const accTxs = app.findRecordsByFilter(
        'transactions',
        `account_id = '${accId}'`,
        'date',
        10000,
        0,
      )

      let calcBalance = 0
      for (let r = 0; r < accTxs.length; r++) {
        const tx = accTxs[r]
        const instNum = tx.getInt('installment_number')
        const instTot = tx.getInt('installment_total')

        // Ignorar registros pai consolidados
        if (instNum === 0 && instTot > 0) {
          continue
        }

        const tType = tx.getString('type')
        const amt = tx.getFloat('amount') || 0
        if (accType === 'credito') {
          calcBalance += tType === 'despesa' ? amt : -amt
        } else {
          calcBalance += tType === 'receita' ? amt : -amt
        }
      }

      calcBalance = Math.round(calcBalance * 100) / 100

      app
        .db()
        .newQuery(`UPDATE accounts SET balance = {:balance}, updated = {:updated} WHERE id = {:id}`)
        .bind({
          id: accId,
          balance: calcBalance,
          updated: nowIso,
        })
        .execute()

      console.log(
        `[0042] Conta ${accId} (${acc.getString('name')}) - saldo recalculado: ${calcBalance}`,
      )
    }
  },
  (app) => {
    // Reversão no-op
  },
)
