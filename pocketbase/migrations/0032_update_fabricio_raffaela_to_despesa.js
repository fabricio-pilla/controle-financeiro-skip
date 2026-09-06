// Migration 0032: Atualiza o type das categorias Fabrício e Raffaela para 'despesa' no controle Casa (fabricio.pilla@gmail.com)
migrate(
  (app) => {
    // 1. Identificar o controle "Casa" (id y9ewjfbhzoihnq0) ou por owner_email / name
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

    const controlId = casaControl ? casaControl.id : 'y9ewjfbhzoihnq0'

    function normalizeText(text) {
      if (!text) return ''
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    const targetNames = ['fabricio', 'raffaela']

    // Buscar categorias do controle
    const categories = app.findRecordsByFilter('categories', `control_id = "${controlId}"`, '', 100)

    categories.forEach((cat) => {
      const normName = normalizeText(cat.get('name'))
      if (targetNames.includes(normName)) {
        if (cat.get('type') !== 'despesa') {
          cat.set('type', 'despesa')
          app.save(cat)
          console.log(`Categoria "${cat.get('name')}" atualizada para type = 'despesa'.`)
        }
      }
    })
  },
  (app) => {
    // Rollback: reverter para receita se necessário
    const controlId = 'y9ewjfbhzoihnq0'
    function normalizeText(text) {
      if (!text) return ''
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }
    const targetNames = ['fabricio', 'raffaela']
    try {
      const categories = app.findRecordsByFilter(
        'categories',
        `control_id = "${controlId}"`,
        '',
        100,
      )
      categories.forEach((cat) => {
        const normName = normalizeText(cat.get('name'))
        if (targetNames.includes(normName)) {
          cat.set('type', 'receita')
          app.save(cat)
        }
      })
    } catch (e) {
      console.log('Erro no rollback da migration 0032:', e)
    }
  },
)
