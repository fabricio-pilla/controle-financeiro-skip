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
