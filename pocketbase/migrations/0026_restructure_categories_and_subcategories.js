migrate(
  (app) => {
    // 1. Desvincular com segurança transações antigas de categorias e subcategorias existentes
    // para evitar que a exclusão falhe por integridade referencial ou foreign key
    try {
      app.db().newQuery('UPDATE transactions SET category_id = "", subcategory_id = ""').execute()
    } catch (e) {
      console.log('Aviso ao desvincular transações:', e)
    }

    try {
      app.db().newQuery('UPDATE budgets SET category_id = ""').execute()
    } catch (_) {}

    // 2. Excluir todas as subcategorias existentes
    try {
      const subcategoriesCol = app.findCollectionByNameOrId('subcategories')
      app.truncateCollection(subcategoriesCol)
    } catch (e) {
      console.log('Erro ao truncar subcategories:', e)
      try {
        app.db().newQuery('DELETE FROM subcategories').execute()
      } catch (_) {}
    }

    // 3. Excluir todas as categorias existentes
    try {
      const categoriesCol = app.findCollectionByNameOrId('categories')
      app.truncateCollection(categoriesCol)
    } catch (e) {
      console.log('Erro ao truncar categories:', e)
      try {
        app.db().newQuery('DELETE FROM categories').execute()
      } catch (_) {}
    }

    // 4. Definição das 11 Categorias e suas Subcategorias conforme aba DataBase:
    // Categorias:
    // - Fabrício (Entradas: IRPF, Outros, PLR, Salário, Vendas | Saídas: Alimentação, Celular, Cuidados Pessoais, Diversos, Doações, Educação, Exercícios, Lazer, Medicamentos, Médicos / Psicólogos, Plano de Saúde, Presentes, Roupas e Acessórios, Salão, Seguros Individuais, Trabalho, Transporte)
    // - Investimento (Entradas: Emanuel, Fabricio, Helena, Matheus, Raffaela, Viagens | Saídas: Empréstimo Franquia, Empréstimo Ibi Marmore, Financiamento Casa)
    // - Raffaela (Entradas: Outros, Salário | Saídas: Alimentação, Celular, Cuidados Pessoais, Diversos, Doações, Educação, Exercícios, Lazer, Medicamentos, Médicos / Psicólogos, Plano de Saúde, Presentes, Roupas e Acessórios, Salão, Seguros Individuais, Trabalho, Transporte)
    // - Pets (Saídas: Banho, Medicamentos, Outros, Ração, Veterinário)
    // - Transporte (Saídas: Combustível, Consorcio, Diversos, Estacionamento/Pedágio, Impostos, Lavagem, Multas, Revisão / Manutenção, Seguro)
    // - Moradia (Saídas: Água, Decoração / Utensílios, Diarista, Diversos, Gás, Internet, Iptu, Luz, Manutenção, Seguro)
    // - Emanuel (Saídas: Brinquedos / Livros, Cuidados Pessoais, Diversos, Educação, Exercícios, Lazer, Medicamentos, Médicos / Psicólogos, Pensão, Plano de Saúde, Roupas e Acessórios, Salão, Transporte)
    // - Família (Saídas: Assinaturas, Comemorações, Farmácia, Igreja, Lavanderia, Lazer, Plano de Saúde, Presentes, Restaurantes / Delivery, Supermercado, Suplementos, Viagens)
    // - Fast Escova (Saídas: Alimentação, Implantação, Imposto, Pagamento de Contas, Viagens)
    // - Helena (Saídas: Alimentação, Brinquedos / Livros, Celular, Cuidados Pessoais, Diversos, Educação, Exercícios, Lazer, Medicamentos, Médicos / Psicólogos, Pensão, Plano de Saúde, Presentes, Roupas e Acessórios, Salão, Seguros Individuais, Transporte)
    // - Matheus (Saídas: Alimentação, Brinquedos / Livros, Celular, Cuidados Pessoais, Diversos, Educação, Exercícios, Lazer, Medicamentos, Médicos / Psicólogos, Plano de Saúde, Presentes, Roupas e Acessórios, Salão, Seguros Individuais, Transporte)

    const CATEGORIES_DATA = [
      {
        name: 'Fabrício',
        type: 'despesa', // categoria mista / híbrida
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
        type: 'despesa', // categoria mista / híbrida
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
        type: 'despesa', // categoria mista / híbrida
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

    const controls = app.findRecordsByFilter('financial_controls', '', '', 100)
    const categoriesCol = app.findCollectionByNameOrId('categories')
    const subcategoriesCol = app.findCollectionByNameOrId('subcategories')

    controls.forEach((control) => {
      const controlId = control.id

      CATEGORIES_DATA.forEach((catData) => {
        const catRec = new Record(categoriesCol)
        catRec.set('control_id', controlId)
        catRec.set('name', catData.name)
        catRec.set('type', catData.type)
        catRec.set('color', catData.color)
        catRec.set('icon', catData.icon)
        catRec.set('is_default', true)
        app.save(catRec)

        // Criar subcategorias únicas vinculadas a esta categoria
        catData.subcategories.forEach((subName) => {
          const subRec = new Record(subcategoriesCol)
          subRec.set('control_id', controlId)
          subRec.set('category_id', catRec.id)
          subRec.set('name', subName)
          subRec.set('color', '')
          subRec.set('icon', '')
          app.save(subRec)
        })
      })
    })
  },
  (app) => {
    // Rollback
    try {
      const subcategoriesCol = app.findCollectionByNameOrId('subcategories')
      app.truncateCollection(subcategoriesCol)
      const categoriesCol = app.findCollectionByNameOrId('categories')
      app.truncateCollection(categoriesCol)
    } catch (_) {}
  },
)
