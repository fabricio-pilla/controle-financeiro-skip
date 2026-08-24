import PocketBase from 'pocketbase'

const CONTROL_ID = 'y9ewjfbhzoihnq0'
const PB_URL =
  process.env.VITE_POCKETBASE_URL ||
  process.env.PB_INSTANCE_URL ||
  'https://gestao-multiempresa-skip-b345f.shrd00.internal.goskip.dev'

// Fontes de dados
const CSV_URL =
  'https://docs.google.com/spreadsheets/d/1sL0g0mw5uVhqhdZX7KMDSK_jgSg4tHrQc5AmAnB-13c/export?format=csv&gid=1277960163'
const XLSX_URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/87a0dacd-54e6-4142-b13f-981b9d996158/financeiro-2026-89ba7.xlsx'

// Regras de mapeamento Orçamento + Categoria -> Categoria do sistema
function mapCategory(tipo, orcamento, categoria, categoriesMap) {
  const normTipo = (tipo || '').trim().toLowerCase()
  const normOrcamento = (orcamento || '').trim().toLowerCase()
  const normCategoria = (categoria || '').trim().toLowerCase()

  // Receitas
  if (normTipo === 'entrada' || normTipo === 'receita') {
    if (normCategoria === 'salário' || normCategoria === 'salario') {
      return categoriesMap['receita:salário'] || categoriesMap['receita:salario']
    }
    if (normOrcamento === 'investimento') {
      return categoriesMap['receita:investimentos'] || categoriesMap['receita:investimento']
    }
    return categoriesMap['receita:outros']
  }

  // Despesas
  // Orçamento "Casa" -> Moradia (tudo)
  if (normOrcamento === 'casa') {
    return categoriesMap['despesa:moradia']
  }

  // Orçamento "Família"
  if (normOrcamento === 'família' || normOrcamento === 'familia') {
    if (
      normCategoria.includes('supermercado') ||
      normCategoria.includes('restaurante') ||
      normCategoria.includes('suplemento') ||
      normCategoria.includes('alimentação') ||
      normCategoria.includes('alimentacao')
    ) {
      return categoriesMap['despesa:alimentação'] || categoriesMap['despesa:alimentacao']
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
      return categoriesMap['despesa:saúde'] || categoriesMap['despesa:saude']
    }
    if (
      normCategoria.includes('lazer') ||
      normCategoria.includes('viagen') ||
      normCategoria.includes('comemoraç') ||
      normCategoria.includes('comemorac')
    ) {
      return categoriesMap['despesa:lazer']
    }
    if (
      normCategoria.includes('assinatura') ||
      normCategoria.includes('presente') ||
      normCategoria.includes('lavanderia') ||
      normCategoria.includes('igreja') ||
      normCategoria.includes('diversos')
    ) {
      return categoriesMap['despesa:pessoal']
    }
    return categoriesMap['despesa:pessoal']
  }

  // Orçamento "Automóvel" -> Transporte (tudo)
  if (
    normOrcamento === 'automóvel' ||
    normOrcamento === 'automovel' ||
    normOrcamento === 'transporte'
  ) {
    return categoriesMap['despesa:transporte']
  }

  // Orçamento "Investimento" -> Investimentos (despesa)
  if (normOrcamento === 'investimento' || normOrcamento === 'investimentos') {
    return categoriesMap['despesa:investimentos'] || categoriesMap['despesa:investimento']
  }

  // Orçamento "Fabrício" ou "Raffaela"
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
      return categoriesMap['despesa:saúde'] || categoriesMap['despesa:saude']
    }
    if (normCategoria.includes('lazer')) {
      return categoriesMap['despesa:lazer']
    }
    if (
      normCategoria.includes('transporte') ||
      normCategoria.includes('combustível') ||
      normCategoria.includes('combustivel')
    ) {
      return categoriesMap['despesa:transporte']
    }
    // Celular, Cuidados Pessoais, Diversos, Doações, Educação, Roupas e Acessórios, Salão, Seguros Individuais, Trabalho, Alimentação -> Pessoal
    return categoriesMap['despesa:pessoal']
  }

  // Orçamento "Emanuel", "Helena", "Matheus" -> Filhos
  if (normOrcamento === 'emanuel' || normOrcamento === 'helena' || normOrcamento === 'matheus') {
    return categoriesMap['despesa:filhos']
  }

  // Orçamento "Animais de Estimação" -> Pets
  if (normOrcamento.includes('animais') || normOrcamento.includes('pet')) {
    return categoriesMap['despesa:pets']
  }

  // Orçamento "Fast Escova" -> Pessoal
  if (normOrcamento.includes('fast escova')) {
    return categoriesMap['despesa:pessoal']
  }

  return categoriesMap['despesa:pessoal'] || categoriesMap['despesa:outros']
}

function parseCurrency(str) {
  if (typeof str === 'number') return str
  if (!str) return 0
  let clean = str
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return parseFloat(clean) || 0
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString()
  if (dateStr instanceof Date) return dateStr.toISOString()
  // Formatos: DD/MM/YYYY ou YYYY-MM-DD
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.trim().split('/')
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0')
      const month = parts[1].padStart(2, '0')
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
      return `${year}-${month}-${day} 00:00:00.000Z`
    }
  }
  return new Date(dateStr).toISOString()
}

// Parser simples para CSV considerando aspas
function parseCsvRows(csvText) {
  const rows = []
  const lines = csvText.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = []
    let insideQuotes = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          insideQuotes = !insideQuotes
        }
      } else if (char === ',' && !insideQuotes) {
        cols.push(current)
        current = ''
      } else {
        current += char
      }
    }
    cols.push(current)
    rows.push(cols)
  }
  return rows
}

async function loadRows() {
  console.log('Downloading spreadsheet data from Google Sheets CSV...')
  try {
    const res = await fetch(CSV_URL)
    if (res.ok) {
      const csvText = await res.text()
      const rawRows = parseCsvRows(csvText)
      console.log(`Parsed ${rawRows.length} rows from CSV`)
      return rawRows
    }
    console.warn(`CSV fetch returned ${res.status}, trying Supabase XLSX...`)
  } catch (err) {
    console.warn('Failed to fetch CSV, trying XLSX...', err.message)
  }

  // Tentar XLSX se CSV falhar
  const xlsxRes = await fetch(XLSX_URL)
  if (!xlsxRes.ok) {
    throw new Error(`Failed to download spreadsheet from both sources. Status: ${xlsxRes.status}`)
  }
  const arrayBuffer = await xlsxRes.arrayBuffer()
  // Se a biblioteca xlsx estiver disponível
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' })
    const sheetName =
      workbook.SheetNames.find((s) => s.toUpperCase() === 'JAN') || workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    console.log(`Parsed ${rows.length} rows from XLSX sheet ${sheetName}`)
    return rows
  } catch (xlsxErr) {
    throw new Error('xlsx module error: ' + xlsxErr.message)
  }
}

export async function runImport(clientPb) {
  const pb = clientPb || new PocketBase(PB_URL)
  pb.autoCancellation(false)

  console.log(`\n========================================`)
  console.log(`Starting January Import for Control: ${CONTROL_ID}`)
  console.log(`Backend URL: ${PB_URL}`)
  console.log(`========================================\n`)

  // 1. Obter owner do controle
  let userId = ''
  try {
    const members = await pb.collection('control_members').getFullList({
      filter: `control_id = "${CONTROL_ID}" && role = "owner"`,
    })
    if (members.length > 0) {
      userId = members[0].user_id
      console.log(`Found owner user_id: ${userId} (${members[0].email})`)
    }
  } catch (err) {
    console.warn('Could not fetch owner from control_members:', err.message)
  }

  if (!userId) {
    try {
      const control = await pb.collection('financial_controls').getOne(CONTROL_ID)
      userId = control.owner_id
      console.log(`Found owner_id from control: ${userId}`)
    } catch (e) {
      userId = 'uc5jp6hewxu9yio' // fallback
      console.log(`Using fallback userId: ${userId}`)
    }
  }

  // 2. Buscar contas existentes
  const accounts = await pb.collection('accounts').getFullList({
    filter: `control_id = "${CONTROL_ID}"`,
  })
  console.log(`Found ${accounts.length} existing accounts`)

  const accountsMap = {}
  for (const acc of accounts) {
    const norm = acc.name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    accountsMap[norm] = acc.id
  }

  // Mapeador de conta flexível
  const getAccountId = (accName) => {
    if (!accName) return ''
    const norm = accName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (accountsMap[norm]) return accountsMap[norm]

    // matches parciais
    if (norm.includes('neon') && norm.includes('fabricio') && norm.includes('credito'))
      return accountsMap['neon fabricio credito']
    if (norm.includes('neon') && norm.includes('raffaela') && norm.includes('credito'))
      return accountsMap['neon raffaela credito']
    if (norm.includes('santander') && norm.includes('fabricio') && norm.includes('credito'))
      return accountsMap['santander fabricio credito']
    if (norm.includes('neon') && norm.includes('fabricio')) return accountsMap['neon fabricio']
    if (norm.includes('neon') && norm.includes('raffaela')) return accountsMap['neon raffaela']
    if (norm.includes('santander') && norm.includes('fabricio'))
      return accountsMap['santander fabricio']
    if (norm.includes('flash')) return accountsMap['flash']

    return ''
  }

  // 3. Buscar categorias existentes
  const categories = await pb.collection('categories').getFullList({
    filter: `control_id = "${CONTROL_ID}"`,
  })
  console.log(`Found ${categories.length} existing categories`)

  const categoriesMap = {}
  for (const cat of categories) {
    const key = `${cat.type}:${cat.name.trim().toLowerCase()}`
    categoriesMap[key] = cat.id
  }

  // 4. Deletar TODAS as transações do controle
  console.log(`\nStep 1: Deleting existing transactions for control ${CONTROL_ID}...`)
  const existingTxs = await pb.collection('transactions').getFullList({
    filter: `control_id = "${CONTROL_ID}"`,
  })
  console.log(`Found ${existingTxs.length} transactions to delete.`)

  for (const tx of existingTxs) {
    await pb.collection('transactions').delete(tx.id)
  }
  console.log(`Successfully deleted ${existingTxs.length} transactions.\n`)

  // 5. Ler e importar planilha
  console.log(`Step 2: Parsing rows and importing...`)
  const rawRows = await loadRows()

  let importedCount = 0
  let skippedCount = 0

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row || row.length < 5) continue

    const dataCol = (row[0] || '').toString().trim()
    const meioPagamento = (row[1] || '').toString().trim()
    const tipo = (row[2] || '').toString().trim()
    const orcamento = (row[3] || '').toString().trim()
    const categoria = (row[4] || '').toString().trim()
    const descricao = (row[5] || '').toString().trim()
    const parcelas = (row[6] || '').toString().trim()
    const valorRaw = (row[7] || '').toString().trim()
    const pagamento = (row[8] || '').toString().trim()
    const pagoRaw = (row[9] || '').toString().trim()

    // Pular cabeçalhos ou linhas sem data válida
    if (dataCol.toLowerCase() === 'data' || !dataCol.match(/\d/)) {
      continue
    }

    // Pular linhas vazias
    if (!meioPagamento && !orcamento && !categoria && !valorRaw) {
      continue
    }

    const valor = parseCurrency(valorRaw)
    if (valor <= 0) {
      skippedCount++
      continue
    }

    const dateIso = parseDate(dataCol)
    const accountId = getAccountId(meioPagamento)
    const isReceita = tipo.toLowerCase() === 'entrada' || tipo.toLowerCase() === 'receita'
    const txType = isReceita ? 'receita' : 'despesa'
    const categoryId = mapCategory(tipo, orcamento, categoria, categoriesMap) || ''
    const isPaid = pagoRaw.toLowerCase() === 'sim' || pagoRaw === '' || pagoRaw === 'true'

    // Montar descrição final: se tiver descricao específica, usa "Categoria (Descricao)" ou "Descricao"
    let finalDescription = categoria
    if (descricao) {
      finalDescription = `${categoria} (${descricao})`
    }

    // Regra de parcelas: G = "23/36"
    const installmentMatch = parcelas.match(/(\d+)\s*\/\s*(\d+)/)

    // Regra de recorrência
    const isRecurring = pagamento.toLowerCase().includes('recorrente')
    const recurrencePeriod = isRecurring ? 'mensal' : ''
    const recurrenceType = isRecurring ? 'mensal' : ''

    if (installmentMatch) {
      const currentInst = parseInt(installmentMatch[1], 10)
      const totalInst = parseInt(installmentMatch[2], 10)
      const totalAmount = valor * totalInst

      // 1. Criar registro pai
      const parentRecord = await pb.collection('transactions').create({
        control_id: CONTROL_ID,
        user_id: userId,
        type: txType,
        amount: 0,
        description: `${finalDescription} (Total: R$ ${totalAmount.toFixed(2)})`,
        category_id: categoryId,
        account_id: accountId,
        date: dateIso,
        paid: true,
        recurring: false,
        is_recurring: false,
        recurrence_period: '',
        recurrence_type: '',
        installment_number: 0,
        installment_total: totalInst,
        parent_transaction_id: '',
        notes: '',
      })

      // 2. Criar registro filho da parcela
      await pb.collection('transactions').create({
        control_id: CONTROL_ID,
        user_id: userId,
        type: txType,
        amount: valor,
        description: finalDescription,
        category_id: categoryId,
        account_id: accountId,
        date: dateIso,
        paid: isPaid,
        recurring: false,
        is_recurring: false,
        recurrence_period: '',
        recurrence_type: '',
        installment_number: currentInst,
        installment_total: totalInst,
        parent_transaction_id: parentRecord.id,
        notes: '',
      })

      importedCount += 2
      console.log(
        `[Row ${i + 1}] Created installment parent + parcel: ${finalDescription} (Parc ${currentInst}/${totalInst}) - R$ ${valor}`,
      )
    } else {
      // Transação normal
      await pb.collection('transactions').create({
        control_id: CONTROL_ID,
        user_id: userId,
        type: txType,
        amount: valor,
        description: finalDescription,
        category_id: categoryId,
        account_id: accountId,
        date: dateIso,
        paid: isPaid,
        recurring: isRecurring,
        is_recurring: isRecurring,
        recurrence_period: recurrencePeriod,
        recurrence_type: recurrenceType,
        installment_number: 0,
        installment_total: 0,
        parent_transaction_id: '',
        notes: '',
      })

      importedCount++
      console.log(
        `[Row ${i + 1}] Created transaction: ${finalDescription} - R$ ${valor} (${txType})`,
      )
    }
  }

  console.log(`\n========================================`)
  console.log(`Import finished successfully!`)
  console.log(`Imported transactions: ${importedCount}`)
  console.log(`Skipped rows: ${skippedCount}`)
  console.log(`========================================\n`)

  return { importedCount, skippedCount }
}

// Execução direta via node
if (process.argv[1] && process.argv[1].endsWith('import-january.mjs')) {
  runImport().catch((err) => {
    console.error('Fatal error during import:', err)
    process.exit(1)
  })
}
