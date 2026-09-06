// Migration 0033: Separação de categorias de Receita e Despesa para Fabrício e Raffaela
// 1. Renomeia "Fabrício" -> "Despesa Fabrício" e "Raffaela" -> "Despesa Raffaela" (type = "despesa")
// 2. Cria "Receita Fabrício" e "Receita Raffaela" (type = "receita")
// 3. Move as subcategorias de receita (Salário, IRPF, PLR, Vendas, Outros para Fabrício; Salário, Outros, Corretagem para Raffaela)
// 4. Religa lançamentos (transactions) de receita para as novas categorias de receita correspondentes
migrate(
  (app) => {
    // 1. Identificar o controle "Casa"
    let casaControl = null
    try {
      casaControl = app.findFirstRecordByData('financial_controls', 'id', 'y9ewjfbhzoihnq0')
    } catch (_) {
      try {
        casaControl = app.findFirstRecordByData(
          'financial_controls',
          'owner_email',
          'fabricio.pilla@gmail.com',
        )
      } catch (_) {
        try {
          casaControl = app.findFirstRecordByData('financial_controls', 'name', 'Casa')
        } catch (e) {
          console.log('Controle Casa não encontrado:', e)
        }
      }
    }

    if (!casaControl) {
      try {
        const controls = app.findRecordsByFilter('financial_controls', '', '', 1)
        if (controls && controls.length > 0) {
          casaControl = controls[0]
        }
      } catch (e) {
        console.log('Erro ao buscar controles:', e)
      }
    }

    if (!casaControl) {
      console.log('Nenhum controle financeiro encontrado.')
      return
    }

    const controlId = casaControl.id

    function normalizeText(text) {
      if (!text) return ''
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    const categoriesCol = app.findCollectionByNameOrId('categories')

    // Buscar categorias do controle
    const categories = app.findRecordsByFilter('categories', `control_id = "${controlId}"`, '', 100)

    // Encontrar ou renomear categorias antigas
    // Fabrício antiga pode ter nome "Fabrício", "Fabricio" ou já "Despesa Fabrício"
    let catDespesaFabricio = categories.find((c) => {
      const n = normalizeText(c.get('name'))
      return n === 'fabricio' || n === 'despesa fabricio'
    })

    let catDespesaRaffaela = categories.find((c) => {
      const n = normalizeText(c.get('name'))
      return (
        n === 'raffaela' || n === 'rafaela' || n === 'despesa raffaela' || n === 'despesa rafaela'
      )
    })

    if (catDespesaFabricio) {
      catDespesaFabricio.set('name', 'Despesa Fabrício')
      catDespesaFabricio.set('type', 'despesa')
      app.save(catDespesaFabricio)
      console.log('Categoria Despesa Fabrício configurada com sucesso. ID:', catDespesaFabricio.id)
    }

    if (catDespesaRaffaela) {
      catDespesaRaffaela.set('name', 'Despesa Raffaela')
      catDespesaRaffaela.set('type', 'despesa')
      app.save(catDespesaRaffaela)
      console.log('Categoria Despesa Raffaela configurada com sucesso. ID:', catDespesaRaffaela.id)
    }

    // Buscar ou criar "Receita Fabrício"
    let catReceitaFabricio = categories.find((c) => {
      const n = normalizeText(c.get('name'))
      return n === 'receita fabricio'
    })

    if (!catReceitaFabricio) {
      catReceitaFabricio = new Record(categoriesCol)
      catReceitaFabricio.set('control_id', controlId)
      catReceitaFabricio.set('name', 'Receita Fabrício')
      catReceitaFabricio.set('type', 'receita')
      catReceitaFabricio.set('color', '#6366F1')
      catReceitaFabricio.set('icon', 'TrendingUp')
      catReceitaFabricio.set('is_default', true)
      app.save(catReceitaFabricio)
      console.log('Criada nova categoria Receita Fabrício. ID:', catReceitaFabricio.id)
    } else {
      if (catReceitaFabricio.get('type') !== 'receita') {
        catReceitaFabricio.set('type', 'receita')
        app.save(catReceitaFabricio)
      }
    }

    // Buscar ou criar "Receita Raffaela"
    let catReceitaRaffaela = categories.find((c) => {
      const n = normalizeText(c.get('name'))
      return n === 'receita raffaela' || n === 'receita rafaela'
    })

    if (!catReceitaRaffaela) {
      catReceitaRaffaela = new Record(categoriesCol)
      catReceitaRaffaela.set('control_id', controlId)
      catReceitaRaffaela.set('name', 'Receita Raffaela')
      catReceitaRaffaela.set('type', 'receita')
      catReceitaRaffaela.set('color', '#EC4899')
      catReceitaRaffaela.set('icon', 'TrendingUp')
      catReceitaRaffaela.set('is_default', true)
      app.save(catReceitaRaffaela)
      console.log('Criada nova categoria Receita Raffaela. ID:', catReceitaRaffaela.id)
    } else {
      if (catReceitaRaffaela.get('type') !== 'receita') {
        catReceitaRaffaela.set('type', 'receita')
        app.save(catReceitaRaffaela)
      }
    }

    // Subcategorias de receita a mover
    const FABRICIO_INCOME_SUBS = ['salario', 'irpf', 'plr', 'vendas', 'outros']
    const RAFFAELA_INCOME_SUBS = ['salario', 'outros', 'corretagem']

    // Mover subcategorias de Fabrício
    if (catDespesaFabricio && catReceitaFabricio) {
      const subcategoriesFab = app.findRecordsByFilter(
        'subcategories',
        `control_id = "${controlId}" && category_id = "${catDespesaFabricio.id}"`,
        '',
        100,
      )

      subcategoriesFab.forEach((sub) => {
        const normSub = normalizeText(sub.get('name'))
        if (FABRICIO_INCOME_SUBS.includes(normSub)) {
          // Atualiza category_id para catReceitaFabricio.id
          sub.set('category_id', catReceitaFabricio.id)
          app.save(sub)
          console.log(`Subcategoria "${sub.get('name')}" movida para Receita Fabrício.`)
        }
      })
    }

    // Mover subcategorias de Raffaela
    if (catDespesaRaffaela && catReceitaRaffaela) {
      const subcategoriesRaffa = app.findRecordsByFilter(
        'subcategories',
        `control_id = "${controlId}" && category_id = "${catDespesaRaffaela.id}"`,
        '',
        100,
      )

      subcategoriesRaffa.forEach((sub) => {
        const normSub = normalizeText(sub.get('name'))
        if (RAFFAELA_INCOME_SUBS.includes(normSub)) {
          // Atualiza category_id para catReceitaRaffaela.id
          sub.set('category_id', catReceitaRaffaela.id)
          app.save(sub)
          console.log(`Subcategoria "${sub.get('name')}" movida para Receita Raffaela.`)
        }
      })
    }

    // Religar transações existentes do tipo 'receita'
    if (catDespesaFabricio && catReceitaFabricio) {
      try {
        const txsFab = app.findRecordsByFilter(
          'transactions',
          `control_id = "${controlId}" && category_id = "${catDespesaFabricio.id}" && type = "receita"`,
          '',
          500,
        )
        txsFab.forEach((tx) => {
          tx.set('category_id', catReceitaFabricio.id)
          app.save(tx)
          console.log(`Transação ID ${tx.id} de receita religada para Receita Fabrício.`)
        })
      } catch (e) {
        console.log('Erro ao religar transações de Fabrício:', e)
      }
    }

    if (catDespesaRaffaela && catReceitaRaffaela) {
      try {
        const txsRaffa = app.findRecordsByFilter(
          'transactions',
          `control_id = "${controlId}" && category_id = "${catDespesaRaffaela.id}" && type = "receita"`,
          '',
          500,
        )
        txsRaffa.forEach((tx) => {
          tx.set('category_id', catReceitaRaffaela.id)
          app.save(tx)
          console.log(`Transação ID ${tx.id} de receita religada para Receita Raffaela.`)
        })
      } catch (e) {
        console.log('Erro ao religar transações de Raffaela:', e)
      }
    }
  },
  (app) => {
    // Rollback se necessário
  },
)
