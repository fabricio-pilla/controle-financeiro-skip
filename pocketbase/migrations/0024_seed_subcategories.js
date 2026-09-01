migrate(
  (app) => {
    const controls = app.findRecordsByFilter('financial_controls', '', '', 100)
    const categoriesCol = app.findCollectionByNameOrId('categories')
    const subcategoriesCol = app.findCollectionByNameOrId('subcategories')

    // Mapeamento padrão de categorias e subcategorias por tipo
    const defaultExpenseCategoriesWithSubs = [
      {
        name: 'Moradia',
        color: '#EF4444',
        icon: 'Home',
        subcategories: [
          'Água',
          'Decoração / Utensílios',
          'Diarista',
          'Diversos',
          'Gás',
          'Internet',
          'Iptu',
          'Luz',
          'Manutenção',
          'Seguro',
        ],
      },
      {
        name: 'Transporte',
        color: '#F59E0B',
        icon: 'Car',
        subcategories: [
          'Combustível',
          'Consorcio',
          'Diversos',
          'Estacionamento/Pedágio',
          'Impostos',
          'Lavagem',
          'Multas',
          'Revisão / Manutenção',
          'Seguro',
        ],
      },
      {
        name: 'Pets',
        color: '#10B981',
        icon: 'PawPrint',
        subcategories: ['Banho', 'Medicamentos', 'Outros', 'Ração', 'Veterinário'],
      },
      {
        name: 'Alimentação',
        color: '#F97316',
        icon: 'Utensils',
        subcategories: ['Alimentação', 'Restaurantes / Delivery', 'Supermercado', 'Suplementos'],
      },
      {
        name: 'Saúde',
        color: '#EC4899',
        icon: 'Heart',
        subcategories: [
          'Cuidados Pessoais',
          'Exercícios',
          'Farmácia',
          'Medicamentos',
          'Médicos / Psicólogos',
          'Plano de Saúde',
          'Salão',
        ],
      },
      {
        name: 'Lazer',
        color: '#06B6D4',
        icon: 'Gamepad2',
        subcategories: [
          'Assinaturas',
          'Comemorações',
          'Igreja',
          'Lavanderia',
          'Lazer',
          'Presentes',
          'Viagens',
        ],
      },
      {
        name: 'Filhos',
        color: '#8B5CF6',
        icon: 'Baby',
        subcategories: ['Brinquedos / Livros', 'Educação', 'Pensão'],
      },
      {
        name: 'Pessoal',
        color: '#64748B',
        icon: 'User',
        subcategories: [
          'Celular',
          'Doações',
          'Roupas e Acessórios',
          'Seguros Individuais',
          'Trabalho',
          'Diversos',
        ],
      },
      {
        name: 'Investimentos',
        color: '#6366F1',
        icon: 'TrendingUp',
        subcategories: [
          'Empréstimo Franquia',
          'Empréstimo Ibi Marmore',
          'Financiamento Casa',
          'Implantação',
        ],
      },
      {
        name: 'Fast Escova',
        color: '#EC4899',
        icon: 'Scissors',
        subcategories: ['Alimentação', 'Implantação', 'Imposto', 'Pagamento de Contas', 'Viagens'],
      },
    ]

    const defaultIncomeCategoriesWithSubs = [
      {
        name: 'Salário',
        color: '#10B981',
        icon: 'Briefcase',
        subcategories: ['Salário', 'PLR', 'IRPF', 'Vendas', 'Outros'],
      },
      {
        name: 'Investimentos',
        color: '#8B5CF6',
        icon: 'TrendingUp',
        subcategories: [
          'Fabricio',
          'Raffaela',
          'Emanuel',
          'Helena',
          'Matheus',
          'Viagens',
          'Rendimentos',
        ],
      },
      {
        name: 'Outros',
        color: '#64748B',
        icon: 'PlusCircle',
        subcategories: ['Reembolsos', 'Outros', 'Vendas Ocasionais'],
      },
    ]

    controls.forEach((control) => {
      const controlId = control.id

      // 1. Processar despesas
      defaultExpenseCategoriesWithSubs.forEach((catDef) => {
        // Encontrar ou criar categoria
        let categoryRecord = null
        try {
          const existing = app.findRecordsByFilter(
            'categories',
            `control_id = '${controlId}' && type = 'despesa' && name = '${catDef.name}'`,
            '',
            1,
          )
          if (existing && existing.length > 0) {
            categoryRecord = existing[0]
          }
        } catch (_) {}

        if (!categoryRecord) {
          categoryRecord = new Record(categoriesCol)
          categoryRecord.set('control_id', controlId)
          categoryRecord.set('name', catDef.name)
          categoryRecord.set('type', 'despesa')
          categoryRecord.set('color', catDef.color)
          categoryRecord.set('icon', catDef.icon)
          categoryRecord.set('is_default', true)
          app.save(categoryRecord)
        }

        // Subcategorias da categoria
        catDef.subcategories.forEach((subName) => {
          let subRecord = null
          try {
            const existingSub = app.findRecordsByFilter(
              'subcategories',
              `control_id = '${controlId}' && category_id = '${categoryRecord.id}' && name = '${subName}'`,
              '',
              1,
            )
            if (existingSub && existingSub.length > 0) {
              subRecord = existingSub[0]
            }
          } catch (_) {}

          if (!subRecord) {
            subRecord = new Record(subcategoriesCol)
            subRecord.set('control_id', controlId)
            subRecord.set('category_id', categoryRecord.id)
            subRecord.set('name', subName)
            subRecord.set('color', '')
            subRecord.set('icon', '')
            app.save(subRecord)
          }
        })
      })

      // 2. Processar receitas
      defaultIncomeCategoriesWithSubs.forEach((catDef) => {
        let categoryRecord = null
        try {
          const existing = app.findRecordsByFilter(
            'categories',
            `control_id = '${controlId}' && type = 'receita' && name = '${catDef.name}'`,
            '',
            1,
          )
          if (existing && existing.length > 0) {
            categoryRecord = existing[0]
          }
        } catch (_) {}

        if (!categoryRecord) {
          categoryRecord = new Record(categoriesCol)
          categoryRecord.set('control_id', controlId)
          categoryRecord.set('name', catDef.name)
          categoryRecord.set('type', 'receita')
          categoryRecord.set('color', catDef.color)
          categoryRecord.set('icon', catDef.icon)
          categoryRecord.set('is_default', true)
          app.save(categoryRecord)
        }

        catDef.subcategories.forEach((subName) => {
          let subRecord = null
          try {
            const existingSub = app.findRecordsByFilter(
              'subcategories',
              `control_id = '${controlId}' && category_id = '${categoryRecord.id}' && name = '${subName}'`,
              '',
              1,
            )
            if (existingSub && existingSub.length > 0) {
              subRecord = existingSub[0]
            }
          } catch (_) {}

          if (!subRecord) {
            subRecord = new Record(subcategoriesCol)
            subRecord.set('control_id', controlId)
            subRecord.set('category_id', categoryRecord.id)
            subRecord.set('name', subName)
            subRecord.set('color', '')
            subRecord.set('icon', '')
            app.save(subRecord)
          }
        })
      })
    })
  },
  (app) => {
    // Rollback: truncar subcategories se necessário
    try {
      const subcategoriesCol = app.findCollectionByNameOrId('subcategories')
      app.truncateCollection(subcategoriesCol)
    } catch (_) {}
  },
)
