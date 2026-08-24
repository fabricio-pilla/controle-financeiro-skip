import PocketBase from 'pocketbase'
import * as XLSX from 'xlsx'

const PB_URL =
  process.env.VITE_POCKETBASE_URL ||
  process.env.PB_INSTANCE_URL ||
  process.env.POCKETBASE_URL ||
  'https://gestao-multiempresa-skip-b345f.shrd00.internal.goskip.dev'

const XLSX_URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/87a0dacd-54e6-4142-b13f-981b9d996158/financeiro-2026-89ba7.xlsx'

// Normalizador de texto para comparação (remove acentos, espaços extras e minúsculas)
function normalizeText(text) {
  if (!text) return ''
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// 1. Mapeamento de Categoria
function mapCategory(tipoStr, categoriaStr, categoriesMap) {
  const normTipo = normalizeText(tipoStr)
  const normCat = normalizeText(categoriaStr)

  // Se for Receita / Entrada
  if (normTipo === 'receita' || normTipo === 'entrada' || normCat === 'salario') {
    if (normCat.includes('salario')) {
      return (
        categoriesMap['receita:salario'] ||
        categoriesMap['receita:salário'] ||
        categoriesMap['receita:outros']
      )
    }
    if (normCat.includes('investimento')) {
      return (
        categoriesMap['receita:investimentos'] ||
        categoriesMap['receita:investimento'] ||
        categoriesMap['receita:outros']
      )
    }
    return categoriesMap['receita:outros'] || categoriesMap['receita:salario']
  }

  // Despesas por Categoria específica conforme especificação:
  // "Celular", "Roupas e Acessórios", "Cabelereiro", "Jogos", "Educação", "Presentes", "Impostos", "IF homem", "Compras diversas", "Outros", "Tarifas Bancárias" → Pessoal
  if (
    normCat.includes('celular') ||
    normCat.includes('roupas') ||
    normCat.includes('acessorios') ||
    normCat.includes('cabelereiro') ||
    normCat.includes('cabeleireiro') ||
    normCat.includes('salao') ||
    normCat.includes('jogos') ||
    normCat.includes('educacao') ||
    normCat.includes('curso') ||
    normCat.includes('presente') ||
    normCat.includes('imposto') ||
    normCat.includes('if homem') ||
    normCat.includes('compras diversas') ||
    normCat.includes('outros') ||
    normCat.includes('tarifa') ||
    normCat.includes('bancaria') ||
    normCat.includes('assinatura') ||
    normCat.includes('igreja') ||
    normCat.includes('doacao') ||
    normCat.includes('cuidados pessoais') ||
    normCat.includes('multa')
  ) {
    return categoriesMap['despesa:pessoal']
  }

  // "Transporte", "Estacionamento" → Transporte
  if (
    normCat.includes('transporte') ||
    normCat.includes('estacionamento') ||
    normCat.includes('pedagio') ||
    normCat.includes('combustivel') ||
    normCat.includes('gasolina') ||
    normCat.includes('uber') ||
    normCat.includes('99') ||
    normCat.includes('ipva')
  ) {
    return categoriesMap['despesa:transporte']
  }

  // "Supermercado", "Feira", "Açougue", "Padaria", "Delivery/Hamburgueria", "Restaurante", "Guloseimas" → Alimentação
  if (
    normCat.includes('supermercado') ||
    normCat.includes('feira') ||
    normCat.includes('acougue') ||
    normCat.includes('padaria') ||
    normCat.includes('delivery') ||
    normCat.includes('hamburgueria') ||
    normCat.includes('restaurante') ||
    normCat.includes('guloseima') ||
    normCat.includes('alimentacao') ||
    normCat.includes('suplemento') ||
    normCat.includes('ifood')
  ) {
    return categoriesMap['despesa:alimentacao'] || categoriesMap['despesa:alimentação']
  }

  // "Casa", "Aluguel", "Diarista", "Lavanderia", "Manutenção Casa" → Moradia
  if (
    normCat.includes('casa') ||
    normCat.includes('aluguel') ||
    normCat.includes('diarista') ||
    normCat.includes('lavanderia') ||
    normCat.includes('manutencao') ||
    normCat.includes('luz') ||
    normCat.includes('energia') ||
    normCat.includes('agua') ||
    normCat.includes('internet') ||
    normCat.includes('condominio') ||
    normCat.includes('decoracao') ||
    normCat.includes('utensilios') ||
    normCat.includes('moradia')
  ) {
    return categoriesMap['despesa:moradia']
  }

  // "Animais de Estimação" → Pets
  if (normCat.includes('animal') || normCat.includes('pet') || normCat.includes('animais')) {
    return categoriesMap['despesa:pets']
  }

  // "Médicos / Psicólogos", "Farmácia", "Plano de Saúde", "Exercícios", "Seguro de Vida" → Saúde
  if (
    normCat.includes('medico') ||
    normCat.includes('psicologo') ||
    normCat.includes('psicologa') ||
    normCat.includes('dentista') ||
    normCat.includes('farmacia') ||
    normCat.includes('medicamento') ||
    normCat.includes('plano de saude') ||
    normCat.includes('exercicio') ||
    normCat.includes('gympass') ||
    normCat.includes('academia') ||
    normCat.includes('seguro de vida') ||
    normCat.includes('saude')
  ) {
    return categoriesMap['despesa:saude'] || categoriesMap['despesa:saúde']
  }

  // "Emanuel", "Helena", "Matheus", "Escola / Material", "Psicologo", "Fono", "Pensão" → Filhos
  if (
    normCat.includes('emanuel') ||
    normCat.includes('helena') ||
    normCat.includes('matheus') ||
    normCat.includes('escola') ||
    normCat.includes('material') ||
    normCat.includes('fono') ||
    normCat.includes('pensao') ||
    normCat.includes('filho')
  ) {
    return categoriesMap['despesa:filhos']
  }

  // "Investimento" → Investimentos
  if (
    normCat.includes('investimento') ||
    normCat.includes('cdb') ||
    normCat.includes('financiamento')
  ) {
    return categoriesMap['despesa:investimentos'] || categoriesMap['despesa:investimento']
  }

  // "Lazer", "Ifood", "Clube", "Spotify", "Netflix", "Cinema" → Lazer
  if (
    normCat.includes('lazer') ||
    normCat.includes('clube') ||
    normCat.includes('spotify') ||
    normCat.includes('netflix') ||
    normCat.includes('cinema') ||
    normCat.includes('viagem') ||
    normCat.includes('viagens') ||
    normCat.includes('show') ||
    normCat.includes('passeio')
  ) {
    return categoriesMap['despesa:lazer']
  }

  // Fallback: Pessoal
  return categoriesMap['despesa:pessoal'] || Object.values(categoriesMap)[0] || ''
}

// 2. Mapeamento de Conta
function mapAccount(meioPagamentoStr, accountsMap) {
  if (!meioPagamentoStr) return ''
  const norm = normalizeText(meioPagamentoStr)

  if (accountsMap[norm]) return accountsMap[norm]

  // Regras de match flexível para as 7 contas:
  if (norm.includes('neon') && norm.includes('fabricio') && norm.includes('credito')) {
    return accountsMap['neon fabricio credito'] || accountsMap['neon fabricio credito']
  }
  if (norm.includes('neon') && norm.includes('raffaela') && norm.includes('credito')) {
    return accountsMap['neon raffaela credito']
  }
  if (norm.includes('santander') && norm.includes('fabricio') && norm.includes('credito')) {
    return accountsMap['santander fabricio credito']
  }
  if (norm.includes('neon') && norm.includes('fabricio')) {
    return accountsMap['neon fabricio']
  }
  if (norm.includes('neon') && (norm.includes('raffaela') || norm.includes('rafaela'))) {
    return accountsMap['neon raffaela']
  }
  if (norm.includes('santander') && norm.includes('fabricio')) {
    return accountsMap['santander fabricio']
  }
  if (norm.includes('flash')) {
    return accountsMap['flash']
  }

  // Match parcial caso alguma conta no banco tenha nome ligeiramente diferente
  for (const [accNormKey, accId] of Object.entries(accountsMap)) {
    if (norm.includes(accNormKey) || accNormKey.includes(norm)) {
      return accId
    }
  }

  return ''
}

// Parser de Moeda / Valor
function parseCurrency(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val)
  if (!val) return 0
  const clean = val
    .toString()
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : Math.abs(num)
}

// Parser de Data (Excel serial number, Date object ou string DD/MM/YYYY)
function parseExcelDate(dateVal) {
  if (!dateVal) return new Date().toISOString().split('T')[0] + ' 00:00:00.000Z'
  if (dateVal instanceof Date) {
    return dateVal.toISOString().split('T')[0] + ' 00:00:00.000Z'
  }
  if (typeof dateVal === 'number') {
    // Excel date serial number to JS Date
    const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000))
    return date.toISOString().split('T')[0] + ' 00:00:00.000Z'
  }
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim()
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/')
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0')
        const month = parts[1].padStart(2, '0')
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
        return `${year}-${month}-${day} 00:00:00.000Z`
      }
    }
    if (trimmed.includes('-')) {
      return trimmed.split('T')[0] + ' 00:00:00.000Z'
    }
  }
  return new Date().toISOString().split('T')[0] + ' 00:00:00.000Z'
}

// Heurística de Recorrência
function checkRecurring(tipoStr, descStr, catStr, pagStr) {
  const normTipo = normalizeText(tipoStr)
  const normDesc = normalizeText(descStr)
  const normCat = normalizeText(catStr)
  const normPag = normalizeText(pagStr)

  if (normPag.includes('recorrente') || normTipo.includes('recorrente')) {
    return true
  }

  const recurringKeywords = [
    'mensal',
    'recorrente',
    'spotify',
    'netflix',
    'plano de saude',
    'seguro',
    'aluguel',
    'condominio',
    'internet',
    'luz',
    'energia',
    'agua',
    'gympass',
    'celular',
    'pensao',
  ]

  for (const kw of recurringKeywords) {
    if (normDesc.includes(kw) || normCat.includes(kw)) {
      return true
    }
  }

  return false
}

// Download do arquivo XLSX
async function fetchXlsxBuffer() {
  console.log(`Downloading XLSX from: ${XLSX_URL}...`)
  const res = await fetch(XLSX_URL)
  if (!res.ok) {
    throw new Error(`Failed to download XLSX file: ${res.status} ${res.statusText}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// Função Principal de Importação
export async function runImport(clientPb) {
  const pb = clientPb || new PocketBase(PB_URL)
  pb.autoCancellation(false)

  // Autenticação / Superuser se credenciais estiverem no ambiente
  const adminEmail =
    process.env.PB_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'fabricio.pilla@gmail.com'
  const adminPassword = process.env.PB_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Skip@Pass'

  try {
    if (pb.admins && typeof pb.admins.authWithPassword === 'function') {
      await pb.admins.authWithPassword(adminEmail, adminPassword)
      console.log('Authenticated as admin')
    } else if (pb.collection) {
      await pb.collection('users').authWithPassword(adminEmail, adminPassword)
      console.log('Authenticated as user:', adminEmail)
    }
  } catch (authErr) {
    console.warn('Auth notice (proceeding with existing session/public):', authErr.message)
  }

  console.log(`\n==================================================`)
  console.log(`Starting January XLSX Reimport for control "Casa"`)
  console.log(`PocketBase URL: ${PB_URL}`)
  console.log(`==================================================\n`)

  // 1. Buscar o ID do controle "Casa"
  console.log('Searching for financial control "Casa"...')
  const controls = await pb.collection('financial_controls').getFullList({
    filter: 'name ~ "Casa" || name = "Casa"',
  })

  let control = controls.find((c) => normalizeText(c.name) === 'casa') || controls[0]

  if (!control) {
    // Tentar buscar todos os controles
    const allControls = await pb.collection('financial_controls').getFullList()
    control = allControls.find((c) => normalizeText(c.name) === 'casa') || allControls[0]
  }

  if (!control) {
    throw new Error('Financial control "Casa" not found!')
  }

  const controlId = control.id
  console.log(`Found Control "Casa" ID: ${controlId} (Name: ${control.name})`)

  // Obter userId do proprietário
  let userId = control.owner_id || ''
  try {
    const members = await pb.collection('control_members').getFullList({
      filter: `control_id = "${controlId}" && role = "owner"`,
    })
    if (members.length > 0 && members[0].user_id) {
      userId = members[0].user_id
    }
  } catch (_) {}

  // 2. Buscar as 7 contas existentes do controle
  console.log('Fetching accounts for control...')
  const accounts = await pb.collection('accounts').getFullList({
    filter: `control_id = "${controlId}"`,
  })
  console.log(`Found ${accounts.length} accounts:`, accounts.map((a) => a.name).join(', '))

  const accountsMap = {}
  for (const acc of accounts) {
    accountsMap[normalizeText(acc.name)] = acc.id
  }

  // 3. Buscar as categorias existentes do controle
  console.log('Fetching categories for control...')
  const categories = await pb.collection('categories').getFullList({
    filter: `control_id = "${controlId}"`,
  })
  console.log(
    `Found ${categories.length} categories:`,
    categories.map((c) => `${c.type}:${c.name}`).join(', '),
  )

  const categoriesMap = {}
  for (const cat of categories) {
    const key = `${normalizeText(cat.type)}:${normalizeText(cat.name)}`
    categoriesMap[key] = cat.id
  }

  // 4. Deletar TODAS as transações existentes desse controle
  console.log(`\nDeleting existing transactions for control ID: ${controlId}...`)
  const existingTxs = await pb.collection('transactions').getFullList({
    filter: `control_id = "${controlId}"`,
  })
  console.log(`Found ${existingTxs.length} transactions to delete.`)

  for (const tx of existingTxs) {
    await pb.collection('transactions').delete(tx.id)
  }
  console.log(`Deleted all ${existingTxs.length} transactions successfully.\n`)

  // 5. Baixar e Ler o arquivo XLSX
  const buffer = await fetchXlsxBuffer()
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  // Procurar aba "JAN"
  const targetSheetName =
    workbook.SheetNames.find((name) => normalizeText(name) === 'jan') || workbook.SheetNames[0]
  console.log(`Reading sheet "${targetSheetName}"...`)

  const worksheet = workbook.Sheets[targetSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' })

  console.log(`Total rows in sheet (including header): ${rows.length}`)

  let importedCount = 0
  let skippedCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    const colA_Data = (row[0] || '').toString().trim()
    const colB_MeioPagamento = (row[1] || '').toString().trim()
    const colC_Tipo = (row[2] || '').toString().trim()
    const colD_Orcamento = (row[3] || '').toString().trim()
    const colE_Categoria = (row[4] || '').toString().trim()
    const colF_Descricao = (row[5] || '').toString().trim()
    const colG_Parcelas = (row[6] || '').toString().trim()
    const colH_Valor = (row[7] || '').toString().trim()
    const colI_FormaPagamento = (row[8] || '').toString().trim()
    const colJ_Pago = (row[9] || '').toString().trim()

    // Pular linha de cabeçalho
    if (
      normalizeText(colA_Data) === 'data' ||
      normalizeText(colB_MeioPagamento) === 'meio de pagamento' ||
      normalizeText(colE_Categoria) === 'categoria' ||
      normalizeText(colH_Valor) === 'valor'
    ) {
      continue
    }

    // Pular linhas vazias
    if (!colA_Data && !colB_MeioPagamento && !colE_Categoria && !colH_Valor) {
      continue
    }

    const valor = parseCurrency(colH_Valor)
    if (valor <= 0) {
      skippedCount++
      continue
    }

    const dateIso = parseExcelDate(row[0] || colA_Data)
    const accountId = mapAccount(colB_MeioPagamento, accountsMap)

    const isReceita =
      normalizeText(colC_Tipo) === 'entrada' ||
      normalizeText(colC_Tipo) === 'receita' ||
      normalizeText(colE_Categoria) === 'salario'

    const txType = isReceita ? 'receita' : 'despesa'
    const categoryId = mapCategory(colC_Tipo, colE_Categoria || colD_Orcamento, categoriesMap)
    const isPaid = normalizeText(colJ_Pago) === 'nao' ? false : true

    // Montar descrição
    let description = colF_Descricao || colE_Categoria || 'Transação'
    if (
      colE_Categoria &&
      colF_Descricao &&
      normalizeText(colE_Categoria) !== normalizeText(colF_Descricao)
    ) {
      description = `${colE_Categoria} (${colF_Descricao})`
    }

    // Verificar parcelamento
    const parcelasMatch = colG_Parcelas.match(/(\d+)\s*\/\s*(\d+)/)

    // Verificar recorrência
    const isRecurring = checkRecurring(colC_Tipo, description, colE_Categoria, colI_FormaPagamento)
    const recurrencePeriod = isRecurring ? 'mensal' : ''
    const recurrenceType = isRecurring ? 'mensal' : ''

    if (parcelasMatch) {
      const currentInst = parseInt(parcelasMatch[1], 10)
      const totalInst = parseInt(parcelasMatch[2], 10)
      const totalAmount = valor * totalInst

      // 1. Criar registro pai (Parent transaction)
      const parentRecord = await pb.collection('transactions').create({
        control_id: controlId,
        user_id: userId,
        type: txType,
        amount: 0,
        description: `${description} (Total: R$ ${totalAmount.toFixed(2)})`,
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
        notes: `Importado de JAN .xlsx - Pai ${totalInst} parcelas`,
      })

      // 2. Criar parcela atual
      await pb.collection('transactions').create({
        control_id: controlId,
        user_id: userId,
        type: txType,
        amount: valor,
        description: description,
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
        notes: `Importado de JAN .xlsx - Parcela ${currentInst}/${totalInst}`,
      })

      importedCount += 2
      console.log(
        `[Row ${i + 1}] Parcelado: ${description} (Parcela ${currentInst}/${totalInst}) - R$ ${valor.toFixed(2)}`,
      )
    } else {
      // Transação regular
      await pb.collection('transactions').create({
        control_id: controlId,
        user_id: userId,
        type: txType,
        amount: valor,
        description: description,
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
        notes: `Importado de JAN .xlsx`,
      })

      importedCount++
      console.log(
        `[Row ${i + 1}] ${txType.toUpperCase()}: ${description} - R$ ${valor.toFixed(2)} (${colB_MeioPagamento})`,
      )
    }
  }

  console.log(`\n==================================================`)
  console.log(`Import completed successfully!`)
  console.log(`Total transactions created: ${importedCount}`)
  console.log(`Skipped rows (empty or zero value): ${skippedCount}`)
  console.log(`==================================================\n`)

  return { importedCount, skippedCount }
}

// Execução direta via `node scripts/import-january.mjs`
if (process.argv[1] && process.argv[1].endsWith('import-january.mjs')) {
  runImport()
    .then((res) => {
      console.log('Result:', res)
      process.exit(0)
    })
    .catch((err) => {
      console.error('Fatal error during import:', err)
      process.exit(1)
    })
}
