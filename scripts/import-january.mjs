import PocketBase from 'pocketbase'
import * as XLSX from 'xlsx'

const PB_URL =
  process.env.VITE_POCKETBASE_URL ||
  process.env.PB_INSTANCE_URL ||
  process.env.POCKETBASE_URL ||
  'https://gestao-multiempresa-skip-b345f.shrd00.internal.goskip.dev'

const XLSX_URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/87a0dacd-54e6-4142-b13f-981b9d996158/financeiro-2026-89ba7.xlsx'

function normalizeText(text) {
  if (!text) return ''
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function mapCategoryWithOrcamento(tipoStr, orcamentoStr, categoriaStr, categoriesMap) {
  const normTipo = normalizeText(tipoStr)
  const normOrc = normalizeText(orcamentoStr)
  const normCat = normalizeText(categoriaStr)

  if (normTipo === 'entrada' || normTipo === 'receita') {
    if (normCat.includes('salario')) {
      return (
        categoriesMap['receita:salario'] ||
        categoriesMap['receita:salário'] ||
        categoriesMap['receita:outros']
      )
    }
    if (normOrc.includes('investimento') || normCat.includes('investimento')) {
      return (
        categoriesMap['receita:investimentos'] ||
        categoriesMap['receita:investimento'] ||
        categoriesMap['receita:outros']
      )
    }
    return categoriesMap['receita:outros'] || categoriesMap['receita:salario']
  }

  if (normOrc === 'casa') {
    return categoriesMap['despesa:moradia']
  }

  if (normOrc === 'familia') {
    if (
      normCat.includes('supermercado') ||
      normCat.includes('restaurante') ||
      normCat.includes('suplemento') ||
      normCat.includes('alimentacao') ||
      normCat.includes('delivery')
    ) {
      return categoriesMap['despesa:alimentacao'] || categoriesMap['despesa:alimentação']
    }
    if (
      normCat.includes('plano de saude') ||
      normCat.includes('farmacia') ||
      normCat.includes('medic') ||
      normCat.includes('saude')
    ) {
      return categoriesMap['despesa:saude'] || categoriesMap['despesa:saúde']
    }
    if (normCat.includes('lazer') || normCat.includes('viagen') || normCat.includes('comemorac')) {
      return categoriesMap['despesa:lazer']
    }
    return categoriesMap['despesa:pessoal']
  }

  if (normOrc === 'automovel' || normOrc === 'transporte') {
    return categoriesMap['despesa:transporte']
  }

  if (normOrc === 'investimento' || normOrc === 'investimentos') {
    return categoriesMap['despesa:investimentos'] || categoriesMap['despesa:investimento']
  }

  if (normOrc === 'fabricio' || normOrc === 'raffaela' || normOrc === 'rafaela') {
    if (
      normCat.includes('exercicio') ||
      normCat.includes('medicamento') ||
      normCat.includes('medico') ||
      normCat.includes('psicologo') ||
      normCat.includes('saude')
    ) {
      return categoriesMap['despesa:saude'] || categoriesMap['despesa:saúde']
    }
    if (normCat.includes('lazer')) {
      return categoriesMap['despesa:lazer']
    }
    if (normCat.includes('transporte') || normCat.includes('combustivel')) {
      return categoriesMap['despesa:transporte']
    }
    return categoriesMap['despesa:pessoal']
  }

  if (normOrc === 'emanuel' || normOrc === 'helena' || normOrc === 'matheus') {
    return categoriesMap['despesa:filhos']
  }

  if (normOrc.includes('animais') || normOrc.includes('pet')) {
    return categoriesMap['despesa:pets']
  }

  return mapCategory(tipoStr, categoriaStr, categoriesMap)
}

function mapCategory(tipoStr, categoriaStr, categoriesMap) {
  const normTipo = normalizeText(tipoStr)
  const normCat = normalizeText(categoriaStr)

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

  if (normCat.includes('animal') || normCat.includes('pet') || normCat.includes('animais')) {
    return categoriesMap['despesa:pets']
  }

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

  if (
    normCat.includes('investimento') ||
    normCat.includes('cdb') ||
    normCat.includes('financiamento')
  ) {
    return categoriesMap['despesa:investimentos'] || categoriesMap['despesa:investimento']
  }

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

  return categoriesMap['despesa:pessoal'] || Object.values(categoriesMap)[0] || ''
}

function mapAccount(meioPagamentoStr, accountsMap) {
  if (!meioPagamentoStr) return ''
  const norm = normalizeText(meioPagamentoStr)

  if (accountsMap[norm]) return accountsMap[norm]

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

  for (const [accNormKey, accId] of Object.entries(accountsMap)) {
    if (norm.includes(accNormKey) || accNormKey.includes(norm)) {
      return accId
    }
  }

  return ''
}

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

function parseExcelDate(dateVal) {
  if (!dateVal) return '2026-01-01 00:00:00.000Z'
  if (dateVal instanceof Date) {
    return dateVal.toISOString().split('T')[0] + ' 00:00:00.000Z'
  }
  if (typeof dateVal === 'number') {
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
  return '2026-01-01 00:00:00.000Z'
}

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

async function fetchXlsxBuffer() {
  console.log(`Downloading XLSX from: ${XLSX_URL}...`)
  const res = await fetch(XLSX_URL)
  if (!res.ok) {
    throw new Error(`Failed to download XLSX file: ${res.status} ${res.statusText}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function parseXlsxJanRows() {
  const buffer = await fetchXlsxBuffer()
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  console.log('Available sheets in workbook:', workbook.SheetNames)
  const targetSheetName =
    workbook.SheetNames.find((name) => normalizeText(name) === 'jan') || workbook.SheetNames[0]
  console.log(`Reading sheet "${targetSheetName}"...`)

  const worksheet = workbook.Sheets[targetSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' })

  const parsedRows = []
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

    if (
      normalizeText(colA_Data) === 'data' ||
      normalizeText(colB_MeioPagamento) === 'meio de pagamento' ||
      normalizeText(colE_Categoria) === 'categoria' ||
      normalizeText(colH_Valor) === 'valor'
    ) {
      continue
    }

    if (!colA_Data && !colB_MeioPagamento && !colE_Categoria && !colH_Valor) {
      continue
    }

    const valor = parseCurrency(colH_Valor)
    if (valor <= 0) continue

    parsedRows.push({
      d: colA_Data,
      rawDate: row[0],
      acc: colB_MeioPagamento,
      tipo: colC_Tipo,
      orc: colD_Orcamento,
      cat: colE_Categoria,
      desc: colF_Descricao,
      parc: colG_Parcelas,
      val: valor,
      pag: colI_FormaPagamento,
      pago: colJ_Pago,
    })
  }
  return parsedRows
}

export async function runImport(clientPb) {
  const pb = clientPb || new PocketBase(PB_URL)
  pb.autoCancellation(false)

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

  const controls = await pb.collection('financial_controls').getFullList({
    filter: 'name ~ "Casa" || name = "Casa"',
  })

  let control = controls.find((c) => normalizeText(c.name) === 'casa') || controls[0]

  if (!control) {
    const allControls = await pb.collection('financial_controls').getFullList()
    control = allControls.find((c) => normalizeText(c.name) === 'casa') || allControls[0]
  }

  if (!control) {
    throw new Error('Financial control "Casa" not found!')
  }

  const controlId = control.id
  console.log(`Found Control "Casa" ID: ${controlId} (Name: ${control.name})`)

  let userId = control.owner_id || ''
  try {
    const members = await pb.collection('control_members').getFullList({
      filter: `control_id = "${controlId}" && role = "owner"`,
    })
    if (members.length > 0 && members[0].user_id) {
      userId = members[0].user_id
    }
  } catch (_) {}

  const accounts = await pb.collection('accounts').getFullList({
    filter: `control_id = "${controlId}"`,
  })
  console.log(`Found ${accounts.length} accounts:`, accounts.map((a) => a.name).join(', '))

  const accountsMap = {}
  for (const acc of accounts) {
    accountsMap[normalizeText(acc.name)] = acc.id
  }

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

  console.log(`\nDeleting existing transactions for control ID: ${controlId}...`)
  const existingTxs = await pb.collection('transactions').getFullList({
    filter: `control_id = "${controlId}"`,
  })
  console.log(`Found ${existingTxs.length} transactions to delete.`)

  for (const tx of existingTxs) {
    await pb.collection('transactions').delete(tx.id)
  }
  console.log(`Deleted all ${existingTxs.length} transactions successfully.\n`)

  const parsedRows = await parseXlsxJanRows()
  console.log(`Total valid data rows extracted from JAN sheet: ${parsedRows.length}`)

  let importedCount = 0

  for (let i = 0; i < parsedRows.length; i++) {
    const item = parsedRows[i]
    const valor = item.val
    const dateIso = parseExcelDate(item.rawDate || item.d)
    const accountId = mapAccount(item.acc, accountsMap)

    const isReceita =
      normalizeText(item.tipo) === 'entrada' ||
      normalizeText(item.tipo) === 'receita' ||
      normalizeText(item.cat) === 'salario'

    const txType = isReceita ? 'receita' : 'despesa'
    const categoryId = mapCategoryWithOrcamento(item.tipo, item.orc, item.cat, categoriesMap)
    const isPaid = normalizeText(item.pago) === 'nao' ? false : true

    let description = item.desc || item.cat || 'Transação'
    if (item.cat && item.desc && normalizeText(item.cat) !== normalizeText(item.desc)) {
      description = `${item.cat} (${item.desc})`
    }

    const parcelasMatch = (item.parc || '').match(/(\d+)\s*\/\s*(\d+)/)

    const isRecurring = checkRecurring(item.tipo, description, item.cat, item.pag)
    const recurrencePeriod = isRecurring ? 'mensal' : ''
    const recurrenceType = isRecurring ? 'mensal' : ''

    if (parcelasMatch) {
      const currentInst = parseInt(parcelasMatch[1], 10)
      const totalInst = parseInt(parcelasMatch[2], 10)
      const totalAmount = valor * totalInst

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
        `[Row ${i + 1}] ${txType.toUpperCase()}: ${description} - R$ ${valor.toFixed(2)} (${item.acc})`,
      )
    }
  }

  console.log(`\n==================================================`)
  console.log(`Import completed successfully!`)
  console.log(`Total transactions created: ${importedCount}`)
  console.log(`==================================================\n`)

  return { importedCount, totalXlsxRows: parsedRows.length }
}

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
