import * as XLSX from 'xlsx'
import { Account, Category, Subcategory } from '@/types/database'

export interface TemplateRow {
  Data: string
  Descrição: string
  Valor: number | string
  'Meio de Pagamento': string
  Categoria: string
  Orçamento?: string
  Tipo?: string
  Parcelas?: string
  Recorrência?: string
}

/**
 * Monta as linhas de exemplo com base nas contas e categorias disponíveis ou defaults inteligentes.
 */
export function generateSampleData(
  accounts: Account[] = [],
  _categories: Category[] = [],
  _subcategories: Subcategory[] = [],
): TemplateRow[] {
  // Encontrar nomes reais de contas caso existam
  const bankAccount =
    accounts.find((a) => a.type === 'banco' || a.type === 'carteira' || a.type === 'pix')?.name ||
    'Neon Fabrício'

  const creditAccount =
    accounts.find((a) => a.type === 'credito')?.name || 'Santander Fabrício Crédito'

  const secondAccount =
    accounts.find((a) => a.name !== bankAccount && a.type !== 'credito')?.name ||
    accounts.find((a) => a.name !== bankAccount)?.name ||
    'Neon Raffaela'

  return [
    {
      Data: '05/01/2026',
      Descrição: 'Salário Fabrício',
      Valor: '6.500,00',
      'Meio de Pagamento': bankAccount,
      Categoria: 'Salário',
      Orçamento: 'Fabrício',
      Tipo: 'Receita',
      Parcelas: '',
      Recorrência: 'Mensal',
    },
    {
      Data: '10/01/2026',
      Descrição: 'Supermercado Mensal Pão de Açúcar',
      Valor: '850,40',
      'Meio de Pagamento': bankAccount,
      Categoria: 'Supermercado',
      Orçamento: 'Família',
      Tipo: 'Despesa',
      Parcelas: '',
      Recorrência: '',
    },
    {
      Data: '12/01/2026',
      Descrição: 'Conta de Luz Enel',
      Valor: '215,90',
      'Meio de Pagamento': secondAccount,
      Categoria: 'Luz',
      Orçamento: 'Moradia',
      Tipo: 'Despesa',
      Parcelas: '',
      Recorrência: 'Mensal',
    },
    {
      Data: '15/01/2026',
      Descrição: 'Posto Ipiranga Combustível',
      Valor: '180,00',
      'Meio de Pagamento': creditAccount,
      Categoria: 'Combustível',
      Orçamento: 'Transporte',
      Tipo: 'Despesa',
      Parcelas: '',
      Recorrência: '',
    },
    {
      Data: '18/01/2026',
      Descrição: 'Notebook Dell Trabalho',
      Valor: '450,00',
      'Meio de Pagamento': creditAccount,
      Categoria: 'Diversos',
      Orçamento: 'Fabrício',
      Tipo: 'Despesa',
      Parcelas: '02/10',
      Recorrência: '',
    },
  ]
}

/**
 * Cria o workbook com as abas "JAN" (dados de exemplo) e "Instruções" (guia detalhado).
 */
export function createTemplateWorkbook(
  accounts: Account[] = [],
  categories: Category[] = [],
  subcategories: Subcategory[] = [],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  // --- Aba 1: Modelo "JAN" ---
  const sampleData = generateSampleData(accounts, categories, subcategories)
  const wsData = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'Data',
      'Descrição',
      'Valor',
      'Meio de Pagamento',
      'Categoria',
      'Orçamento',
      'Tipo',
      'Parcelas',
      'Recorrência',
    ],
  })

  // Largura visual das colunas
  wsData['!cols'] = [
    { wch: 14 }, // Data
    { wch: 38 }, // Descrição
    { wch: 16 }, // Valor
    { wch: 28 }, // Meio de Pagamento
    { wch: 20 }, // Categoria
    { wch: 18 }, // Orçamento
    { wch: 14 }, // Tipo
    { wch: 14 }, // Parcelas
    { wch: 16 }, // Recorrência
  ]

  XLSX.utils.book_append_sheet(wb, wsData, 'JAN')

  // --- Aba 2: Instruções ---
  const instructions = [
    {
      Coluna: 'Data',
      'Obrigatória?': 'SIM',
      'Formatos Aceitos':
        'DD/MM/AAAA (ex: 18/01/2026) ou AAAA-MM-DD (2026-01-18) ou data nativa Excel',
      'Descrição e Dicas': 'Data em que o lançamento ocorreu ou foi lançado na fatura/extrato.',
    },
    {
      Coluna: 'Descrição',
      'Obrigatória?': 'Recomendada',
      'Formatos Aceitos': 'Texto livre (ex: "Supermercado Pão de Açúcar")',
      'Descrição e Dicas':
        'Identificação da compra ou receita. Se vazio, o sistema preencherá como "Sem descrição".',
    },
    {
      Coluna: 'Valor',
      'Obrigatória?': 'SIM',
      'Formatos Aceitos': '1.234,56 ou 1234.56 ou R$ 1.234,56 ou valor numérico nativo',
      'Descrição e Dicas':
        'Valor da transação. Sempre use valor positivo maior que zero. Para despesas parceladas, informe o valor de cada parcela individual.',
    },
    {
      Coluna: 'Meio de Pagamento',
      'Obrigatória?': 'SIM',
      'Formatos Aceitos': 'Nome exato ou aproximado de uma conta cadastrada no controle',
      'Descrição e Dicas': `Exemplos cadastrados: ${
        accounts.length > 0
          ? accounts
              .map((a) => `"${a.name}"`)
              .slice(0, 5)
              .join(', ')
          : '"Neon Fabrício", "Santander Fabrício Crédito"'
      }. O sistema reconhece cartões e bancos automaticamente.`,
    },
    {
      Coluna: 'Categoria',
      'Obrigatória?': 'Opcional',
      'Formatos Aceitos': 'Texto (ex: "Supermercado", "Combustível", "Salário", "Luz")',
      'Descrição e Dicas':
        'Subcategoria ou categoria do lançamento. Se a subcategoria não existir, o sistema cria automaticamente.',
    },
    {
      Coluna: 'Orçamento',
      'Obrigatória?': 'Opcional',
      'Formatos Aceitos': 'Texto (ex: "Família", "Fabrício", "Transporte", "Moradia", "Pets")',
      'Descrição e Dicas':
        'Categoria macro/orçamento responsável pelo gasto. Ajuda o sistema a mapear com precisão exata.',
    },
    {
      Coluna: 'Tipo',
      'Obrigatória?': 'Opcional',
      'Formatos Aceitos': '"Despesa" ou "Receita" (também aceita "Entrada" ou "Saída")',
      'Descrição e Dicas':
        'Se omitido, palavras como "salário", "holerite", "rendimento" viram Receita; os demais viram Despesa.',
    },
    {
      Coluna: 'Parcelas',
      'Obrigatória?': 'Opcional',
      'Formatos Aceitos': '"01/05", "2/10", "3 de 10" ou "10x"',
      'Descrição e Dicas':
        'Indica a parcela atual e o total. Ex: "02/10" criará a parcela 2 de 10 vinculada ao registro principal.',
    },
    {
      Coluna: 'Recorrência',
      'Obrigatória?': 'Opcional',
      'Formatos Aceitos': '"Mensal", "Semanal", "Anual" ou deixe em branco',
      'Descrição e Dicas':
        'Indica se a despesa ou receita se repete mês a mês (ex: aluguel, conta de luz, salário, assinaturas).',
    },
  ]

  const wsInstructions = XLSX.utils.json_to_sheet(instructions)
  wsInstructions['!cols'] = [
    { wch: 20 }, // Coluna
    { wch: 14 }, // Obrigatória?
    { wch: 42 }, // Formatos Aceitos
    { wch: 70 }, // Descrição e Dicas
  ]

  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções')

  return wb
}

/**
 * Dispara o download da planilha modelo (.xlsx).
 */
export function downloadTemplateXlsx(
  accounts: Account[] = [],
  categories: Category[] = [],
  subcategories: Subcategory[] = [],
  fileName: string = 'modelo-importacao-financeira.xlsx',
) {
  const wb = createTemplateWorkbook(accounts, categories, subcategories)
  XLSX.writeFile(wb, fileName)
}

/**
 * Dispara o download da planilha modelo em formato CSV (separador ponto e vírgula com BOM UTF-8).
 */
export function downloadTemplateCsv(
  accounts: Account[] = [],
  categories: Category[] = [],
  subcategories: Subcategory[] = [],
  fileName: string = 'modelo-importacao-financeira.csv',
) {
  const sampleData = generateSampleData(accounts, categories, subcategories)
  const headers = [
    'Data',
    'Descrição',
    'Valor',
    'Meio de Pagamento',
    'Categoria',
    'Orçamento',
    'Tipo',
    'Parcelas',
    'Recorrência',
  ]

  const csvRows = [
    headers.join(';'),
    ...sampleData.map((row) =>
      [
        row.Data,
        `"${row['Descrição'].replace(/"/g, '""')}"`,
        row.Valor,
        `"${row['Meio de Pagamento'].replace(/"/g, '""')}"`,
        `"${row.Categoria.replace(/"/g, '""')}"`,
        `"${(row['Orçamento'] || '').replace(/"/g, '""')}"`,
        row.Tipo || '',
        row.Parcelas || '',
        row['Recorrência'] || '',
      ].join(';'),
    ),
  ]

  const csvContent = '\uFEFF' + csvRows.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Interface dos dados exportados compatível com a estrutura de importação.
 */
export interface ExportTransactionRow {
  Data: string // dd/mm/aaaa
  Descrição: string
  Valor: string // R$ 1.234,56 ou 1.234,56
  'Meio de Pagamento': string
  Categoria: string
  Subcategoria: string
  Tipo: 'Entrada' | 'Saída'
  Parcelas: string // ex: "01/10" ou ""
  Recorrência: string // "Mensal", "Semanal", "Anual" ou ""
  Pago: 'Sim' | 'Não'
}

/**
 * Exporta uma lista de transações para arquivo Excel (.xlsx) na mesma estrutura
 * do modelo de importação para permitir reimportação imediata.
 */
export function exportTransactionsToXlsx(
  transactions: Array<{
    date: string
    description: string
    amount: number
    type: 'receita' | 'despesa'
    account?: { name: string }
    category?: { name: string }
    subcategory?: { name: string }
    installment_number?: number
    installments_total?: number
    installment_total?: number
    is_recurring?: boolean
    recurring?: boolean
    recurrence_type?: string
    recurrence_period?: string
    paid?: boolean
  }>,
  fileName: string = 'transacoes-exportadas.xlsx',
) {
  // Ordenar cronologicamente
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const rows: ExportTransactionRow[] = sorted.map((tx) => {
    // Formatar data em dd/mm/aaaa
    let dataBr = ''
    if (tx.date) {
      const match = tx.date.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (match) {
        dataBr = `${match[3]}/${match[2]}/${match[1]}`
      } else {
        const d = new Date(tx.date)
        if (!isNaN(d.getTime())) {
          const dd = String(d.getUTCDate()).padStart(2, '0')
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
          const yyyy = d.getUTCFullYear()
          dataBr = `${dd}/${mm}/${yyyy}`
        }
      }
    }

    // Formatar valor em pt-BR (ex: "1.250,00")
    const valorBr = Number(tx.amount || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    // Tipo (Entrada/Saída)
    const tipo = tx.type === 'receita' ? 'Entrada' : 'Saída'

    // Meio de Pagamento / Conta
    const meioPagamento = tx.account?.name || ''

    // Categoria e Subcategoria
    const categoria = tx.category?.name || ''
    const subcategoria = tx.subcategory?.name || ''

    // Parcelas (ex: "01/10" ou "")
    let parcelas = ''
    const totalInst = tx.installments_total || tx.installment_total || 0
    const numInst = tx.installment_number || 1
    if (totalInst > 1) {
      parcelas = `${String(numInst).padStart(2, '0')}/${String(totalInst).padStart(2, '0')}`
    }

    // Recorrência
    let recorrencia = ''
    const isRec = Boolean(
      tx.is_recurring || tx.recurring || (tx.recurrence_type && tx.recurrence_type.trim() !== ''),
    )
    if (isRec) {
      const period = (tx.recurrence_type || tx.recurrence_period || 'mensal').toLowerCase()
      if (period.includes('seman')) recorrencia = 'Semanal'
      else if (period.includes('anu')) recorrencia = 'Anual'
      else recorrencia = 'Mensal'
    }

    // Pago (Sim/Não)
    const pago = tx.paid !== false ? 'Sim' : 'Não'

    return {
      Data: dataBr,
      Descrição: tx.description || '',
      Valor: valorBr,
      'Meio de Pagamento': meioPagamento,
      Categoria: categoria,
      Subcategoria: subcategoria,
      Tipo: tipo,
      Parcelas: parcelas,
      Recorrência: recorrencia,
      Pago: pago,
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Definir larguras de colunas adequadas
  ws['!cols'] = [
    { wch: 14 }, // Data
    { wch: 38 }, // Descrição
    { wch: 16 }, // Valor
    { wch: 24 }, // Meio de Pagamento
    { wch: 22 }, // Categoria
    { wch: 22 }, // Subcategoria
    { wch: 12 }, // Tipo
    { wch: 12 }, // Parcelas
    { wch: 14 }, // Recorrência
    { wch: 10 }, // Pago
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos')
  XLSX.writeFile(wb, fileName)
}
