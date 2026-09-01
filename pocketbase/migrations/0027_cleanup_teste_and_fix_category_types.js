migrate(
  (app) => {
    // 1. Excluir o controle lixo "Teste" (uunzyzwhd00t7on) e todos os registros a ele vinculados
    const TEST_CONTROL_ID = 'uunzyzwhd00t7on'

    try {
      app
        .db()
        .newQuery('DELETE FROM transactions WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir transactions do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM subcategories WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir subcategories do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM categories WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir categories do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM accounts WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir accounts do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM credit_cards WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir credit_cards do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM budgets WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir budgets do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM goals WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir goals do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM control_members WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir control_members do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM control_invitations WHERE control_id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir control_invitations do Teste:', e)
    }

    try {
      app
        .db()
        .newQuery('DELETE FROM financial_controls WHERE id = {:controlId}')
        .bind({ controlId: TEST_CONTROL_ID })
        .execute()
    } catch (e) {
      console.log('Aviso ao excluir financial_controls Teste:', e)
    }

    // 2. Garantir que no controle "Casa" (y9ewjfbhzoihnq0) existam EXATAMENTE as 11 categorias
    // e suas subcategorias, sem duplicatas e com os tipos corretos:
    // receita: Fabrício, Investimento, Raffaela
    // despesa: Pets, Transporte, Moradia, Emanuel, Família, Fast Escova, Helena, Matheus
    const CASA_CONTROL_ID = 'y9ewjfbhzoihnq0'

    const CATEGORIES_SPEC = [
      {
        name: 'Fabrício',
        type: 'receita',
        color: '#6366F1',
        icon: 'User',
        subcategories: [
          // Entradas
          'IRPF',
          'Outros',
          'PLR',
          'Salário',
          'Vendas',
          // Saídas
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
        ],
      },
      {
        name: 'Investimento',
        type: 'receita',
        color: '#8B5CF6',
        icon: 'TrendingUp',
        subcategories: [
          // Entradas
          'Emanuel',
          'Fabricio',
          'Helena',
          'Matheus',
          'Raffaela',
          'Viagens',
          // Saídas
          'Empréstimo Franquia',
          'Empréstimo Ibi Marmore',
          'Financiamento Casa',
        ],
      },
      {
        name: 'Raffaela',
        type: 'receita',
        color: '#EC4899',
        icon: 'User',
        subcategories: [
          // Entradas
          'Outros',
          'Salário',
          // Saídas
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
        ],
      },
      {
        name: 'Pets',
        type: 'despesa',
        color: '#10B981',
        icon: 'PawPrint',
        subcategories: ['Banho', 'Medicamentos', 'Outros', 'Ração', 'Veterinário'],
      },
      {
        name: 'Transporte',
        type: 'despesa',
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
        name: 'Moradia',
        type: 'despesa',
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
        name: 'Emanuel',
        type: 'despesa',
        color: '#3B82F6',
        icon: 'Baby',
        subcategories: [
          'Brinquedos / Livros',
          'Cuidados Pessoais',
          'Diversos',
          'Educação',
          'Exercícios',
          'Lazer',
          'Medicamentos',
          'Médicos / Psicólogos',
          'Pensão',
          'Plano de Saúde',
          'Roupas e Acessórios',
          'Salão',
          'Transporte',
        ],
      },
      {
        name: 'Família',
        type: 'despesa',
        color: '#06B6D4',
        icon: 'Users',
        subcategories: [
          'Assinaturas',
          'Comemorações',
          'Farmácia',
          'Igreja',
          'Lavanderia',
          'Lazer',
          'Plano de Saúde',
          'Presentes',
          'Restaurantes / Delivery',
          'Supermercado',
          'Suplementos',
          'Viagens',
        ],
      },
      {
        name: 'Fast Escova',
        type: 'despesa',
        color: '#F43F5E',
        icon: 'Scissors',
        subcategories: ['Alimentação', 'Implantação', 'Imposto', 'Pagamento de Contas', 'Viagens'],
      },
      {
        name: 'Helena',
        type: 'despesa',
        color: '#A855F7',
        icon: 'Baby',
        subcategories: [
          'Alimentação',
          'Brinquedos / Livros',
          'Celular',
          'Cuidados Pessoais',
          'Diversos',
          'Educação',
          'Exercícios',
          'Lazer',
          'Medicamentos',
          'Médicos / Psicólogos',
          'Pensão',
          'Plano de Saúde',
          'Presentes',
          'Roupas e Acessórios',
          'Salão',
          'Seguros Individuais',
          'Transporte',
        ],
      },
      {
        name: 'Matheus',
        type: 'despesa',
        color: '#14B8A6',
        icon: 'Baby',
        subcategories: [
          'Alimentação',
          'Brinquedos / Livros',
          'Celular',
          'Cuidados Pessoais',
          'Diversos',
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
          'Transporte',
        ],
      },
    ]

    const categoriesCol = app.findCollectionByNameOrId('categories')
    const subcategoriesCol = app.findCollectionByNameOrId('subcategories')

    // Atualizar categorias existentes no controle Casa ou criar se não existirem
    const existingCats = app.findRecordsByFilter(
      'categories',
      `control_id = "${CASA_CONTROL_ID}"`,
      '',
      100,
    )

    // Mapa de categorias por nome
    const catMapByName = {}
    existingCats.forEach((cat) => {
      catMapByName[cat.get('name')] = cat
    })

    CATEGORIES_SPEC.forEach((spec) => {
      let catRecord = catMapByName[spec.name]
      if (catRecord) {
        catRecord.set('type', spec.type)
        catRecord.set('color', spec.color)
        catRecord.set('icon', spec.icon)
        catRecord.set('is_default', true)
        app.save(catRecord)
      } else {
        catRecord = new Record(categoriesCol)
        catRecord.set('control_id', CASA_CONTROL_ID)
        catRecord.set('name', spec.name)
        catRecord.set('type', spec.type)
        catRecord.set('color', spec.color)
        catRecord.set('icon', spec.icon)
        catRecord.set('is_default', true)
        app.save(catRecord)
        catMapByName[spec.name] = catRecord
      }

      // Buscar subcategorias existentes desta categoria
      const existingSubs = app.findRecordsByFilter(
        'subcategories',
        `control_id = "${CASA_CONTROL_ID}" && category_id = "${catRecord.id}"`,
        '',
        200,
      )
      const existingSubNames = new Set(existingSubs.map((s) => s.get('name')))

      spec.subcategories.forEach((subName) => {
        if (!existingSubNames.has(subName)) {
          const subRec = new Record(subcategoriesCol)
          subRec.set('control_id', CASA_CONTROL_ID)
          subRec.set('category_id', catRecord.id)
          subRec.set('name', subName)
          subRec.set('color', '')
          subRec.set('icon', '')
          app.save(subRec)
          existingSubNames.add(subName)
        }
      })
    })

    // Remover categorias do Casa que não estejam no spec de 11 categorias
    const validCategoryNames = new Set(CATEGORIES_SPEC.map((s) => s.name))
    existingCats.forEach((cat) => {
      if (!validCategoryNames.has(cat.get('name'))) {
        try {
          app
            .db()
            .newQuery('DELETE FROM subcategories WHERE category_id = {:catId}')
            .bind({ catId: cat.id })
            .execute()
          app.delete(cat)
        } catch (e) {
          console.log('Aviso ao remover categoria sobressalente:', e)
        }
      }
    })
  },
  (app) => {
    // Rollback
  },
)
