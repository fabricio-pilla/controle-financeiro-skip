migrate(
  (app) => {
    // Busca todas as transações que contenham '[IA:' no campo notes
    const records = app.findRecordsByFilter('transactions', "notes ~ '[IA:'", '', 0, 0)

    // Obter mapa de categorias e subcategorias para saber o nome delas caso a descrição seja o nome exato da categoria
    let categories = []
    let subcategories = []
    try {
      categories = app.findRecordsByFilter('categories', '', '', 0, 0)
    } catch (_) {}
    try {
      subcategories = app.findRecordsByFilter('subcategories', '', '', 0, 0)
    } catch (_) {}

    const catNameSet = new Set()
    for (const c of categories) {
      if (c.get('name')) catNameSet.add(c.get('name').trim().toLowerCase())
    }
    for (const s of subcategories) {
      if (s.get('name')) catNameSet.add(s.get('name').trim().toLowerCase())
    }

    for (const record of records) {
      const notes = record.get('notes') || ''
      let currentDesc = record.get('description') || ''
      let needsSave = false

      // Extrai os dados do JSON dentro de [IA:{...}]
      const match = notes.match(/\[IA:(\{.*?\})\]/)
      let orig = ''
      let jsonDesc = ''
      if (match) {
        try {
          const parsed = JSON.parse(match[1])
          orig = parsed.orig || ''
          jsonDesc = parsed.desc || ''
        } catch (_) {}
      }

      // Verifica se a descrição atual está corrompida:
      // - termina com " 0" (ex: "Alimentação Viagem 0", "Combustivel Viagens 0")
      // - ou é idêntica ao nome da categoria/subcategoria vinculada enquanto 'orig' traz a descrição original real
      // - ou a descrição atual é igual a jsonDesc que termina com " 0"
      const endsWithZero = currentDesc.endsWith(' 0')
      const isCategoryName = catNameSet.has(currentDesc.trim().toLowerCase())

      let candidateCleanDesc = ''
      if (orig) {
        // Se orig tem algo como "Alimentação Viagem 57,70" ou "Escova Raffaela 109" ou "Combustivel\nViagens \n134,37"
        // Normaliza quebras de linha e remove valor numérico final se existir
        let cleanOrig = orig
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        // Remove menções de valor numérico no final como " 57,70" ou " 109" ou " 40" ou " de 3.827,11"
        cleanOrig = cleanOrig.replace(/\b(receita|despesa)\s+de\s+[\d.,]+/i, '').trim()
        cleanOrig = cleanOrig.replace(/\s+[\d.,]+$/, '').trim()

        if (cleanOrig) {
          candidateCleanDesc = cleanOrig
        }
      }

      // Se a descrição atual termina com ' 0' e não puder recuperar pelo orig, apenas remove o ' 0'
      if (endsWithZero) {
        if (candidateCleanDesc && !candidateCleanDesc.endsWith(' 0')) {
          record.set('description', candidateCleanDesc)
        } else {
          record.set('description', currentDesc.replace(/\s+0$/, '').trim())
        }
        needsSave = true
      } else if (
        isCategoryName &&
        candidateCleanDesc &&
        candidateCleanDesc.toLowerCase() !== currentDesc.trim().toLowerCase()
      ) {
        // Exemplo: Descrição estava "Alimentação" mas orig era "Agua Viagem 11" ou "Alimentação Viagem 57,70"
        record.set('description', candidateCleanDesc)
        needsSave = true
      } else if (currentDesc === 'Escova' && candidateCleanDesc === 'Escova Raffaela') {
        record.set('description', candidateCleanDesc)
        needsSave = true
      }

      // Limpa as notes removendo qualquer tag [IA:{...}]
      const cleanedNotes = notes.replace(/\[IA:\{.*?\}\]/g, '').trim()
      if (cleanedNotes !== notes) {
        record.set('notes', cleanedNotes)
        needsSave = true
      }

      if (needsSave) {
        app.save(record)
      }
    }

    // Também verifica transações gerais sem notes com [IA:], mas cuja descrição termina com ' 0'
    const recordsWithZero = app.findRecordsByFilter('transactions', "description ~ ' 0'", '', 0, 0)
    for (const record of recordsWithZero) {
      const desc = record.get('description') || ''
      if (desc.endsWith(' 0')) {
        record.set('description', desc.replace(/\s+0$/, '').trim())
        app.save(record)
      }
    }
  },
  () => {
    // Operação irreversível de limpeza/recuperação de dados
  },
)
