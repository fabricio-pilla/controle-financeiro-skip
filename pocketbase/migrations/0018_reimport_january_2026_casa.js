migrate(
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'

    // 1. Obter owner do controle
    let userId = 'uc5jp6hewxu9yio'
    try {
      const members = app.findRecordsByFilter(
        'control_members',
        "control_id = '" + CONTROL_ID + "' && role = 'owner'",
        '',
        1,
        0,
      )
      if (members && members.length > 0) {
        userId = members[0].getString('user_id')
      }
    } catch (_) {}

    // 2. Mapeamento de contas existentes
    const accounts = app.findRecordsByFilter(
      'accounts',
      "control_id = '" + CONTROL_ID + "'",
      '',
      100,
      0,
    )
    const accountsMap = {}
    for (let i = 0; i < accounts.length; i++) {
      const name = accounts[i].getString('name').trim().toLowerCase()
      accountsMap[name] = accounts[i].id
    }

    const getAccountId = (name) => {
      if (!name) return ''
      const norm = name.trim().toLowerCase()
      if (accountsMap[norm]) return accountsMap[norm]
      if (norm.includes('neon') && norm.includes('fabricio') && norm.includes('crédito'))
        return accountsMap['neon fabrício crédito'] || accountsMap['neon fabricio credito'] || ''
      if (norm.includes('neon') && norm.includes('fabricio') && norm.includes('credito'))
        return accountsMap['neon fabrício crédito'] || accountsMap['neon fabricio credito'] || ''
      if (norm.includes('neon') && norm.includes('raffaela') && norm.includes('crédito'))
        return accountsMap['neon raffaela crédito'] || accountsMap['neon raffaela credito'] || ''
      if (norm.includes('neon') && norm.includes('raffaela') && norm.includes('credito'))
        return accountsMap['neon raffaela crédito'] || accountsMap['neon raffaela credito'] || ''
      if (norm.includes('santander') && norm.includes('fabricio') && norm.includes('crédito'))
        return (
          accountsMap['santander fabrício crédito'] ||
          accountsMap['santander fabricio credito'] ||
          ''
        )
      if (norm.includes('santander') && norm.includes('fabricio') && norm.includes('credito'))
        return (
          accountsMap['santander fabrício crédito'] ||
          accountsMap['santander fabricio credito'] ||
          ''
        )
      if (norm.includes('neon') && (norm.includes('fabrício') || norm.includes('fabricio')))
        return accountsMap['neon fabrício'] || accountsMap['neon fabricio'] || ''
      if (norm.includes('neon') && (norm.includes('raffaela') || norm.includes('rafaela')))
        return accountsMap['neon raffaela'] || ''
      if (norm.includes('santander') && (norm.includes('fabrício') || norm.includes('fabricio')))
        return accountsMap['santander fabrício'] || accountsMap['santander fabricio'] || ''
      if (norm.includes('flash')) return accountsMap['flash'] || ''
      return ''
    }

    // 3. Mapeamento de categorias existentes
    const categories = app.findRecordsByFilter(
      'categories',
      "control_id = '" + CONTROL_ID + "'",
      '',
      100,
      0,
    )
    const categoriesMap = {}
    for (let i = 0; i < categories.length; i++) {
      const key =
        categories[i].getString('type') + ':' + categories[i].getString('name').trim().toLowerCase()
      categoriesMap[key] = categories[i].id
    }

    const mapCategory = (tipo, orcamento, categoria) => {
      const normTipo = (tipo || '').trim().toLowerCase()
      const normOrcamento = (orcamento || '').trim().toLowerCase()
      const normCategoria = (categoria || '').trim().toLowerCase()

      if (normTipo === 'entrada' || normTipo === 'receita') {
        if (normCategoria === 'salário' || normCategoria === 'salario') {
          return categoriesMap['receita:salário'] || categoriesMap['receita:salario'] || ''
        }
        if (normOrcamento === 'investimento') {
          return (
            categoriesMap['receita:investimentos'] || categoriesMap['receita:investimento'] || ''
          )
        }
        return categoriesMap['receita:outros'] || ''
      }

      if (normOrcamento === 'casa') {
        return categoriesMap['despesa:moradia'] || ''
      }

      if (normOrcamento === 'família' || normOrcamento === 'familia') {
        if (
          normCategoria.includes('supermercado') ||
          normCategoria.includes('restaurante') ||
          normCategoria.includes('suplemento') ||
          normCategoria.includes('alimentação') ||
          normCategoria.includes('alimentacao')
        ) {
          return categoriesMap['despesa:alimentação'] || categoriesMap['despesa:alimentacao'] || ''
        }
        if (
          normCategoria.includes('plano de saúde') ||
          normCategoria.includes('plano de saude') ||
          normCategoria.includes('farmácia') ||
          normCategoria.includes('farmacia') ||
          normCategoria.includes('médic') ||
          normCategoria.includes('saúde') ||
          normCategoria.includes('saude')
        ) {
          return categoriesMap['despesa:saúde'] || categoriesMap['despesa:saude'] || ''
        }
        if (
          normCategoria.includes('lazer') ||
          normCategoria.includes('viagen') ||
          normCategoria.includes('comemoraç') ||
          normCategoria.includes('comemorac')
        ) {
          return categoriesMap['despesa:lazer'] || ''
        }
        if (
          normCategoria.includes('assinatura') ||
          normCategoria.includes('presente') ||
          normCategoria.includes('lavanderia') ||
          normCategoria.includes('igreja') ||
          normCategoria.includes('diversos')
        ) {
          return categoriesMap['despesa:pessoal'] || ''
        }
        return categoriesMap['despesa:pessoal'] || ''
      }

      if (
        normOrcamento === 'automóvel' ||
        normOrcamento === 'automovel' ||
        normOrcamento === 'transporte'
      ) {
        return categoriesMap['despesa:transporte'] || ''
      }

      if (normOrcamento === 'investimento' || normOrcamento === 'investimentos') {
        return categoriesMap['despesa:investimentos'] || categoriesMap['despesa:investimento'] || ''
      }

      if (
        normOrcamento === 'fabrício' ||
        normOrcamento === 'fabricio' ||
        normOrcamento === 'raffaela' ||
        normOrcamento === 'rafaela'
      ) {
        if (
          normCategoria.includes('exercício') ||
          normCategoria.includes('exercicio') ||
          normCategoria.includes('medicamento') ||
          normCategoria.includes('médico') ||
          normCategoria.includes('medico') ||
          normCategoria.includes('psicólogo') ||
          normCategoria.includes('psicologo') ||
          normCategoria.includes('plano de saúde') ||
          normCategoria.includes('saúde')
        ) {
          return categoriesMap['despesa:saúde'] || categoriesMap['despesa:saude'] || ''
        }
        if (normCategoria.includes('lazer')) {
          return categoriesMap['despesa:lazer'] || ''
        }
        if (
          normCategoria.includes('transporte') ||
          normCategoria.includes('combustível') ||
          normCategoria.includes('combustivel')
        ) {
          return categoriesMap['despesa:transporte'] || ''
        }
        return categoriesMap['despesa:pessoal'] || ''
      }

      if (
        normOrcamento === 'emanuel' ||
        normOrcamento === 'helena' ||
        normOrcamento === 'matheus'
      ) {
        return categoriesMap['despesa:filhos'] || ''
      }

      if (normOrcamento.includes('animais') || normOrcamento.includes('pet')) {
        return categoriesMap['despesa:pets'] || ''
      }

      if (normOrcamento.includes('fast escova')) {
        return categoriesMap['despesa:pessoal'] || ''
      }

      return categoriesMap['despesa:pessoal'] || ''
    }

    // 4. Limpar TODAS as transações do controle
    app
      .db()
      .newQuery('DELETE FROM transactions WHERE control_id = {:controlId}')
      .bind({ controlId: CONTROL_ID })
      .execute()

    // Helper para gerar ID
    const generateId = () => {
      try {
        if (typeof $security !== 'undefined' && $security.randomString) {
          return $security.randomString(15).toLowerCase()
        }
      } catch (_) {}
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let res = ''
      for (let i = 0; i < 15; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return res
    }

    const nowIso = new Date().toISOString()

    // Helper para salvar transação via SQL direto (ultra-rápido e sem bypass de schemas)
    const insertTransaction = (tx) => {
      const txId = tx.id || generateId()
      app
        .db()
        .newQuery(`
      INSERT INTO transactions (
        id, control_id, user_id, type, amount, description,
        category_id, account_id, date, paid, recurring,
        is_recurring, recurrence_type, recurrence_period,
        installment_number, installment_total, parent_transaction_id,
        created, updated
      ) VALUES (
        {:id}, {:control_id}, {:user_id}, {:type}, {:amount}, {:description},
        {:category_id}, {:account_id}, {:date}, {:paid}, {:recurring},
        {:is_recurring}, {:recurrence_type}, {:recurrence_period},
        {:installment_number}, {:installment_total}, {:parent_transaction_id},
        {:created}, {:updated}
      )
    `)
        .bind({
          id: txId,
          control_id: CONTROL_ID,
          user_id: userId,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          category_id: tx.category_id || '',
          account_id: tx.account_id || '',
          date: tx.date,
          paid: tx.paid ? 1 : 0,
          recurring: tx.is_recurring ? 1 : 0,
          is_recurring: tx.is_recurring ? 1 : 0,
          recurrence_type: tx.is_recurring ? 'mensal' : '',
          recurrence_period: tx.is_recurring ? 'mensal' : '',
          installment_number: tx.installment_number || 0,
          installment_total: tx.installment_total || 0,
          parent_transaction_id: tx.parent_transaction_id || '',
          created: nowIso,
          updated: nowIso,
        })
        .execute()
      return txId
    }

    const parseCurrency = (str) => {
      if (typeof str === 'number') return str
      if (!str) return 0
      let clean = str
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
      return parseFloat(clean) || 0
    }

    const parseDate = (dateStr) => {
      if (!dateStr) return new Date().toISOString()
      if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const parts = dateStr.trim().split('/')
        if (parts.length === 3) {
          const day = parts[0].length === 1 ? '0' + parts[0] : parts[0]
          const month = parts[1].length === 1 ? '0' + parts[1] : parts[1]
          const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
          return year + '-' + month + '-' + day + ' 00:00:00.000Z'
        }
      }
      return new Date(dateStr).toISOString()
    }

    // Lista com as 57 linhas completas da planilha Jan/2026
    const rowsData = [
      // 1. Financiamento Casa
      {
        d: '01/01/2026',
        acc: 'Santander Fabricio',
        tipo: 'Saida',
        orc: 'Investimento',
        cat: 'Financiamento Casa',
        desc: '',
        parc: '23/36',
        val: 'R$ 2.501,31',
        pag: 'Parcelado',
        pago: 'Sim',
      },
      // 2. Salário Flash
      {
        d: '01/01/2026',
        acc: 'Flash',
        tipo: 'Entrada',
        orc: 'Fabrício',
        cat: 'Salário',
        desc: '',
        parc: '',
        val: 'R$ 1.400,91',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 3. Supermercado Flash
      {
        d: '01/01/2026',
        acc: 'Flash',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Supermercado',
        desc: '',
        parc: '',
        val: 'R$ 1.400,91',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 4. Plano de Saúde Cooparticipação
      {
        d: '01/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Plano de Saúde',
        desc: 'Cooparticipação',
        parc: '',
        val: 'R$ 25,62',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 5. Pensão Helena
      {
        d: '01/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Helena',
        cat: 'Pensão',
        desc: '',
        parc: '',
        val: 'R$ 550,00',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 6. Pensão Emanuel
      {
        d: '01/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Emanuel',
        cat: 'Pensão',
        desc: '',
        parc: '',
        val: 'R$ 550,00',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 7. Salário Neon Fabricio
      {
        d: '01/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Entrada',
        orc: 'Fabrício',
        cat: 'Salário',
        desc: '',
        parc: '',
        val: 'R$ 5.308,47',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 8. Diversos CDB Helena
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Helena',
        cat: 'Diversos',
        desc: 'CDB',
        parc: '',
        val: 'R$ 160,00',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 9. Diversos CDB Emanuel
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Emanuel',
        cat: 'Diversos',
        desc: 'CDB',
        parc: '',
        val: 'R$ 160,00',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 10. Spotify
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Assinaturas',
        desc: 'Spotify',
        parc: '',
        val: 'R$ 31,90',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 11. Luz Casa
      {
        d: '05/01/2026',
        acc: 'Santander Fabricio',
        tipo: 'Saida',
        orc: 'Casa',
        cat: 'Luz',
        desc: '',
        parc: '',
        val: 'R$ 204,81',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 12. Celular Helena
      {
        d: '05/01/2026',
        acc: 'Santander Fabricio',
        tipo: 'Saida',
        orc: 'Helena',
        cat: 'Celular',
        desc: '',
        parc: '',
        val: 'R$ 67,53',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 13. Certidão Clube
      {
        d: '05/01/2026',
        acc: 'Santander Fabricio',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Lazer',
        desc: 'Certidão Clube',
        parc: '',
        val: 'R$ 135,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 14. Combustível
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Automóvel',
        cat: 'Combustível',
        desc: '',
        parc: '',
        val: 'R$ 149,18',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 15. Restaurantes / Delivery
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: '',
        parc: '',
        val: 'R$ 18,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 16. Restaurantes / Delivery
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: '',
        parc: '',
        val: 'R$ 97,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 17. Presentes
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Presentes',
        desc: '',
        parc: '',
        val: 'R$ 289,80',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 18. Presentes
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Presentes',
        desc: '',
        parc: '',
        val: 'R$ 296,60',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 19. Presentes
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Presentes',
        desc: '',
        parc: '',
        val: 'R$ 458,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 20. Supermercado
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Supermercado',
        desc: '',
        parc: '',
        val: 'R$ 20,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 21. Supermercado
      {
        d: '05/01/2026',
        acc: 'Neon Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Supermercado',
        desc: '',
        parc: '',
        val: 'R$ 20,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 22. Água Casa
      {
        d: '08/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Casa',
        cat: 'Água',
        desc: '',
        parc: '',
        val: 'R$ 145,01',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 23. Celular Fabricio
      {
        d: '10/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Fabrício',
        cat: 'Celular',
        desc: '',
        parc: '',
        val: 'R$ 64,25',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 24. Celular Raffaela
      {
        d: '10/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Raffaela',
        cat: 'Celular',
        desc: '',
        parc: '',
        val: 'R$ 64,25',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 25. Internet Casa
      {
        d: '10/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Casa',
        cat: 'Internet',
        desc: '',
        parc: '',
        val: 'R$ 133,40',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 26. Celular Matheus
      {
        d: '10/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Matheus',
        cat: 'Celular',
        desc: '',
        parc: '',
        val: 'R$ 64,25',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 27. Salário Raffaela
      {
        d: '10/01/2026',
        acc: 'Neon Raffaela',
        tipo: 'Entrada',
        orc: 'Raffaela',
        cat: 'Salário',
        desc: '',
        parc: '',
        val: 'R$ 4.600,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 28. Transporte Raffaela
      {
        d: '11/01/2026',
        acc: 'Neon Raffaela Crédito',
        tipo: 'Saida',
        orc: 'Raffaela',
        cat: 'Transporte',
        desc: '',
        parc: '',
        val: 'R$ 25,43',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 29. IPVA
      {
        d: '12/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Automóvel',
        cat: 'Impostos',
        desc: 'IPVA',
        parc: '01/05',
        val: 'R$ 154,97',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 30. Multas
      {
        d: '13/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Automóvel',
        cat: 'Multas',
        desc: '',
        parc: '',
        val: 'R$ 299,98',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 31. Impostos
      {
        d: '13/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Automóvel',
        cat: 'Impostos',
        desc: '',
        parc: '',
        val: 'R$ 94,61',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 32. Impostos
      {
        d: '13/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Saida',
        orc: 'Automóvel',
        cat: 'Impostos',
        desc: '',
        parc: '',
        val: 'R$ 94,61',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 33. Salário Fabricio
      {
        d: '15/01/2026',
        acc: 'Neon Fabricio',
        tipo: 'Entrada',
        orc: 'Fabrício',
        cat: 'Salário',
        desc: '',
        parc: '',
        val: 'R$ 6.194,61',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 34. IOF GitHub
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Fabrício',
        cat: 'Educação',
        desc: 'IOF GitHub',
        parc: '',
        val: 'R$ 1,97',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 35. Restaurantes / Delivery
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: '',
        parc: '',
        val: 'R$ 4,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 36. Restaurantes / Delivery
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: '',
        parc: '',
        val: 'R$ 5,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 37. Restaurantes / Delivery
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: '',
        parc: '',
        val: 'R$ 5,59',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 38. Apple
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Fabrício',
        cat: 'Celular',
        desc: 'Apple',
        parc: '',
        val: 'R$ 5,90',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 39. Clube Ifood
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: 'Clube Ifood',
        parc: '',
        val: 'R$ 5,95',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 40. Restaurantes / Delivery
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: '',
        parc: '',
        val: 'R$ 9,98',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 41. Estacionamento/Pedágio
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Automóvel',
        cat: 'Estacionamento/Pedágio',
        desc: '',
        parc: '',
        val: 'R$ 10,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 42. Restaurantes / Delivery
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: '',
        parc: '',
        val: 'R$ 11,98',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 43. Combustível
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Automóvel',
        cat: 'Combustível',
        desc: '',
        parc: '',
        val: 'R$ 17,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 44. Manutenção
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Casa',
        cat: 'Manutenção',
        desc: '',
        parc: '',
        val: 'R$ 17,55',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 45. Decoração / Utensílios
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Casa',
        cat: 'Decoração / Utensílios',
        desc: '',
        parc: '',
        val: 'R$ 18,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 46. Apple Raffaela
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Raffaela',
        cat: 'Celular',
        desc: 'Apple',
        parc: '',
        val: 'R$ 19,90',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 47. Restaurantes / Delivery
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Restaurantes / Delivery',
        desc: '',
        parc: '',
        val: 'R$ 21,50',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 48. Farmácia
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Farmácia',
        desc: '',
        parc: '',
        val: 'R$ 23,49',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 49. Manutenção
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Casa',
        cat: 'Manutenção',
        desc: '',
        parc: '',
        val: 'R$ 26,60',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 50. Farmácia
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Família',
        cat: 'Farmácia',
        desc: '',
        parc: '',
        val: 'R$ 27,89',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 51. Combustível
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Automóvel',
        cat: 'Combustível',
        desc: '',
        parc: '',
        val: 'R$ 30,00',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 52. Alimentação Matheus
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Matheus',
        cat: 'Alimentação',
        desc: '',
        parc: '',
        val: 'R$ 33,49',
        pag: 'Á Vista',
        pago: 'Sim',
      },
      // 53. Gympass
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Raffaela',
        cat: 'Exercícios',
        desc: 'Gympass',
        parc: '',
        val: 'R$ 89,90',
        pag: 'Recorrente',
        pago: 'Sim',
      },
      // 54. Uza
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Raffaela',
        cat: 'Roupas e Acessórios',
        desc: 'Uza',
        parc: '08/10',
        val: 'R$ 203,96',
        pag: 'Parcelado',
        pago: 'Sim',
      },
      // 55. Curso Terapeuta
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Raffaela',
        cat: 'Educação',
        desc: 'Curso Terapeuta',
        parc: '04/12',
        val: 'R$ 498,72',
        pag: 'Parcelado',
        pago: 'Sim',
      },
      // 56. Coluna Alinhada
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Raffaela',
        cat: 'Médicos / Psicólogos',
        desc: 'Coluna Alinhada',
        parc: '03/03',
        val: 'R$ 500,00',
        pag: 'Parcelado',
        pago: 'Sim',
      },
      // 57. Dentista Placa
      {
        d: '18/01/2026',
        acc: 'Santander Fabricio Crédito',
        tipo: 'Saida',
        orc: 'Raffaela',
        cat: 'Médicos / Psicólogos',
        desc: 'Dentista Placa',
        parc: '03/03',
        val: 'R$ 1.053,33',
        pag: 'Parcelado',
        pago: 'Sim',
      },
    ]

    for (let i = 0; i < rowsData.length; i++) {
      const row = rowsData[i]
      const valor = parseCurrency(row.val)
      if (valor <= 0) continue

      const dateIso = parseDate(row.d)
      const accountId = getAccountId(row.acc)
      const isReceita = row.tipo.toLowerCase() === 'entrada' || row.tipo.toLowerCase() === 'receita'
      const txType = isReceita ? 'receita' : 'despesa'
      const categoryId = mapCategory(row.tipo, row.orc, row.cat)
      const isPaid = row.pago.toLowerCase() === 'sim' || row.pago === '' || row.pago === 'true'

      let finalDesc = row.cat
      if (row.desc) {
        finalDesc = row.cat + ' (' + row.desc + ')'
      }

      const isRecurring = row.pag.toLowerCase().indexOf('recorrente') >= 0
      const parcMatch = row.parc ? row.parc.match(/(\d+)\s*\/\s*(\d+)/) : null

      if (parcMatch) {
        const currentInst = parseInt(parcMatch[1], 10)
        const totalInst = parseInt(parcMatch[2], 10)
        const totalAmount = valor * totalInst

        const parentId = generateId()
        // Registro Pai
        insertTransaction({
          id: parentId,
          date: dateIso,
          account_id: accountId,
          description: finalDesc + ' (Total: R$ ' + totalAmount.toFixed(2) + ')',
          amount: 0,
          type: txType,
          category_id: categoryId,
          paid: true,
          is_recurring: false,
          installment_number: 0,
          installment_total: totalInst,
          parent_transaction_id: '',
        })

        // Parcela
        insertTransaction({
          date: dateIso,
          account_id: accountId,
          description: finalDesc,
          amount: valor,
          type: txType,
          category_id: categoryId,
          paid: isPaid,
          is_recurring: false,
          installment_number: currentInst,
          installment_total: totalInst,
          parent_transaction_id: parentId,
        })
      } else {
        insertTransaction({
          date: dateIso,
          account_id: accountId,
          description: finalDesc,
          amount: valor,
          type: txType,
          category_id: categoryId,
          paid: isPaid,
          is_recurring: isRecurring,
          installment_number: 0,
          installment_total: 0,
          parent_transaction_id: '',
        })
      }
    }
  },
  (app) => {
    const CONTROL_ID = 'y9ewjfbhzoihnq0'
    try {
      app
        .db()
        .newQuery('DELETE FROM transactions WHERE control_id = {:controlId}')
        .bind({ controlId: CONTROL_ID })
        .execute()
    } catch (_) {}
  },
)
