// Migration 0031: Garante as categorias Fabrício e Raffaela e adiciona as 17 subcategorias solicitadas para cada uma
migrate(
  (app) => {
    // 1. Identificar o controle "Casa" do usuário fabricio.pilla@gmail.com
    let casaControl = null
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
        console.log('Controle Casa não encontrado por email ou nome:', e)
      }
    }

    if (!casaControl) {
      // Tentar pegar o primeiro controle existente
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
      console.log('Nenhum controle financeiro encontrado para aplicar as categorias.')
      return
    }

    const controlId = casaControl.id

    // Função auxiliar para normalizar texto (sem acentos e minúsculo) para dedupe
    function normalizeText(text) {
      if (!text) return ''
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    // 17 subcategorias solicitadas
    const SUBCATEGORIES_LIST = [
      'Alimentação',
      'Celular',
      'Cuidados Pessoais',
      'Diversos',
      'Doações',
      'Educação',
      'Exercícios',
      'Lazer',
      'Medicamentos',
      'Médicos / Psicólogos',
      'Plano de Saúde',
      'Presentes',
      'Roupas e Acessórios',
      'Salão',
      'Seguros Individuais',
      'Trabalho',
      'Transporte',
    ]

    const TARGET_CATEGORIES = [
      {
        name: 'Fabrício',
        color: '#6366F1',
        icon: 'User',
      },
      {
        name: 'Raffaela',
        color: '#EC4899',
        icon: 'User',
      },
    ]

    const categoriesCol = app.findCollectionByNameOrId('categories')
    const subcategoriesCol = app.findCollectionByNameOrId('subcategories')

    // Buscar categorias existentes no controle
    const existingCats = app.findRecordsByFilter(
      'categories',
      `control_id = "${controlId}"`,
      '',
      100,
    )

    TARGET_CATEGORIES.forEach((catSpec) => {
      const specNorm = normalizeText(catSpec.name)
      // Procurar se categoria já existe (dedupe case/accent-insensitive)
      let catRec = existingCats.find((c) => normalizeText(c.get('name')) === specNorm)

      if (!catRec) {
        // Criar categoria se não existir
        catRec = new Record(categoriesCol)
        catRec.set('control_id', controlId)
        catRec.set('name', catSpec.name)
        catRec.set('type', 'receita') // híbrida no nlp-parser e TransactionModal
        catRec.set('color', catSpec.color)
        catRec.set('icon', catSpec.icon)
        catRec.set('is_default', true)
        app.save(catRec)
      } else {
        // Garantir nome exato com acento esperado pelo parser e interface
        if (catRec.get('name') !== catSpec.name) {
          catRec.set('name', catSpec.name)
          app.save(catRec)
        }
      }

      // Buscar subcategorias existentes desta categoria
      const existingSubs = app.findRecordsByFilter(
        'subcategories',
        `control_id = "${controlId}" && category_id = "${catRec.id}"`,
        '',
        200,
      )

      const existingSubMap = new Map()
      existingSubs.forEach((s) => {
        existingSubMap.set(normalizeText(s.get('name')), s)
      })

      // Criar as subcategorias que ainda não existirem
      SUBCATEGORIES_LIST.forEach((subName) => {
        const subNorm = normalizeText(subName)
        if (!existingSubMap.has(subNorm)) {
          const subRec = new Record(subcategoriesCol)
          subRec.set('control_id', controlId)
          subRec.set('category_id', catRec.id)
          subRec.set('name', subName)
          subRec.set('color', '')
          subRec.set('icon', '')
          app.save(subRec)
          existingSubMap.set(subNorm, subRec)
        }
      })
    })
  },
  (app) => {
    // Rollback: se necessário
  },
)
