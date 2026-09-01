import { Account, Category, TransactionType } from '@/types/database'

export interface ParsedTransaction {
  description: string
  amount: number
  type: TransactionType
  date: string // YYYY-MM-DD
  installments_total: number
  account_id?: string
  category_id?: string
  confidence: {
    type: boolean
    amount: boolean
    date: boolean
    category: boolean
    account: boolean
    installments: boolean
  }
}

// ---- Normalisation helpers ----
const ACCENTS: Record<string, string> = {
  á: 'a',
  à: 'a',
  â: 'a',
  ã: 'a',
  ä: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  õ: 'o',
  ö: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ç: 'c',
  ñ: 'n',
}
function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((ch) => ACCENTS[ch] || ch)
    .join('')
}

// ---- Category dictionary (PT-BR) ----
// Maps keyword -> suggested category name (as the user would have it in the DB)
interface CategoryRule {
  keywords: string[]
  category: string
  type: TransactionType
}

const CATEGORY_RULES: CategoryRule[] = [
  // Alimentação
  {
    category: 'Alimentação',
    type: 'despesa',
    keywords: [
      'padaria',
      'padoca',
      'pao',
      'pães',
      'restaurante',
      'almoco',
      'almoço',
      'janta',
      'jantar',
      'lanche',
      'mercado',
      'supermercado',
      'ifood',
      'i food',
      'food',
      'delivery',
      'cafe',
      'café',
      'lancheonete',
      'pizzaria',
      'pizza',
      'hamburguer',
      'hambúrguer',
      'burger',
      'acai',
      'açaí',
      'sorvete',
      'doceria',
      'confeitaria',
      'mercearia',
      'sacolao',
      'sacolão',
      'quitanda',
      'hortifruti',
      'hortifrúti',
    ],
  },
  // Transporte
  {
    category: 'Transporte',
    type: 'despesa',
    keywords: [
      'uber',
      '99',
      'taxi',
      'táxi',
      'gasolina',
      'combustivel',
      'combustível',
      'estacionamento',
      'estacionar',
      'onibus',
      'ônibus',
      'metro',
      'metrô',
      'trem',
      'pedagio',
      'pedágio',
      'ipva',
      'licenciamento',
      'oficina',
      'mecanico',
      'mecânico',
      'pneu',
      'carro',
      'aluguel carro',
      'locacao veiculo',
      'locação veículo',
      'aplicativo transporte',
    ],
  },
  // Moradia
  {
    category: 'Moradia',
    type: 'despesa',
    keywords: [
      'aluguel',
      'condominio',
      'condomínio',
      'iptu',
      'luz',
      'energia',
      'eletricidade',
      'agua',
      'água',
      'saneamento',
      'gas',
      'gás',
      'internet',
      'telefone',
      'fixo',
      'net ',
      'wifi',
      'obra',
      'reforma',
      'manutencao predial',
      'manutenção predial',
      'financiamento imovel',
      'financiamento imóvel',
    ],
  },
  // Saúde
  {
    category: 'Saúde',
    type: 'despesa',
    keywords: [
      'farmacia',
      'farmácia',
      'medico',
      'médico',
      'medica',
      'médica',
      'plano de saude',
      'plano de saúde',
      'consulta',
      'dentista',
      'ortodontista',
      'remedio',
      'remédio',
      'medicamento',
      'exame',
      'laboratorio',
      'laboratório',
      'fisioterapia',
      'psicologo',
      'psicólogo',
      'terapia',
      'vacina',
      'oftalmologista',
      'clinica',
      'clínica',
    ],
  },
  // Lazer
  {
    category: 'Lazer',
    type: 'despesa',
    keywords: [
      'cinema',
      'ingresso',
      'netflix',
      'spotify',
      'disney',
      'hbo max',
      'prime video',
      'globoplay',
      'youtube premium',
      'streaming',
      'assinatura',
      'viagem',
      'passagem',
      'hotel',
      'hospedagem',
      'passeio',
      'balada',
      'show',
      'ingresso show',
      'bar',
      'boteco',
      'pub',
      'jogo',
      'steam',
      'xbox',
      'playstation',
      'nintendo',
    ],
  },
  // Educação
  {
    category: 'Educação',
    type: 'despesa',
    keywords: [
      'curso',
      'faculdade',
      'universidade',
      'livro',
      'livraria',
      'escola',
      'colegio',
      'colégio',
      'mensalidade escolar',
      'material escolar',
      'udemy',
      'alura',
      'coursera',
      'duolingo',
      'aula',
      'professor particular',
      'reforco',
      'reforço',
      'enem',
      'preparatorio',
      'preparatório',
    ],
  },
  // Salários / Vendas (receita)
  {
    category: 'Salários',
    type: 'receita',
    keywords: [
      'salario',
      'salário',
      'remuneracao',
      'remuneração',
      'provento',
      'honorario',
      'honorários',
      'freela',
      'freelance',
      'prestacao servico',
      'prestação serviço',
    ],
  },
  {
    category: 'Vendas',
    type: 'receita',
    keywords: [
      'venda',
      'vendas',
      'vendi',
      'produto vendido',
      'recebimento venda',
      'comissao',
      'comissão',
      'faturamento',
    ],
  },
  {
    category: 'Investimentos',
    type: 'receita',
    keywords: [
      'rendimento',
      'dividendo',
      'juros recebido',
      'resgate aplicacao',
      'resgate aplicação',
      'lucro investimento',
      'cdb',
      'tesouro',
      'fii',
    ],
  },
  // Despesas gerais / negócio
  {
    category: 'Marketing',
    type: 'despesa',
    keywords: [
      'marketing',
      'anuncio',
      'anúncio',
      'google ads',
      'facebook ads',
      'instagram ads',
      'trafego pago',
      'tráfego pago',
      'campanha',
      'propaganda',
      'publicidade',
    ],
  },
  {
    category: 'Fornecedores',
    type: 'despesa',
    keywords: [
      'fornecedor',
      'materia prima',
      'matéria prima',
      'insumo',
      'estoque',
      'compra mercadoria',
      'reposicao',
      'reposição',
    ],
  },
  {
    category: 'Impostos',
    type: 'despesa',
    keywords: [
      'imposto',
      'tributo',
      'das',
      'simples nacional',
      'irpj',
      'iss',
      'contribuicao',
      'contribuição',
      'taxa governamental',
    ],
  },
  {
    category: 'Material de escritório',
    type: 'despesa',
    keywords: [
      'papelaria',
      'material escritorio',
      'material de escritorio',
      'cartucho',
      'toner',
      'tinta impressora',
      'suprimento',
    ],
  },
  {
    category: 'Utilidades',
    type: 'despesa',
    keywords: [
      'aws',
      'cloud',
      'servidor',
      'hosting',
      'dominio',
      'domínio',
      'saas',
      'software',
      'licenca software',
      'licença software',
      'assinatura profissional',
    ],
  },
]

// ---- Type (receita/despesa) keywords ----
const EXPENSE_KEYWORDS = [
  'paguei',
  'gastei',
  'comprei',
  'pagar',
  'pagamento',
  'despesa',
  'gasto',
  'custou',
  'custo',
  'compra',
  'compramos',
  'pago',
]
const INCOME_KEYWORDS = [
  'recebi',
  'ganhei',
  'salario',
  'salário',
  'vendi',
  'venda',
  'recebimento',
  'faturamento',
  'rendimento',
  'comissao',
  'comissão',
  'freela',
  'freelance',
  'receita',
  'recebi pix',
  'deposito recebido',
  'depósito recebido',
]

// ---- Account detection keywords ----
const ACCOUNT_TYPE_KEYWORDS: Record<string, string[]> = {
  credito: [
    'credito',
    'crédito',
    'cartao de credito',
    'cartão de crédito',
    'cartao credito',
    'cartão crédito',
  ],
  debito: ['debito', 'débito', 'cartao de debito', 'cartão de débito'],
  pix: ['pix'],
  carteira: ['dinheiro', 'especie', 'espécie', 'carteira', 'dinheirinho'],
}

// ---- Date helpers ----
function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (day > lastDay) d.setDate(lastDay)
  return toISODate(d)
}

// ---- Amount extraction (PT-BR) ----
// Handles: "25,90", "1.500", "R$ 5.000,00", "5000", "2.000,50"
function extractAmount(text: string): number | null {
  // Normalize R$ / currency symbols
  const cleaned = text.replace(/r\$\s?/gi, ' ').replace(/\b(?:reais?)\b/gi, ' ')

  // Try patterns with comma decimal separator (most common in PT-BR)
  // Match numbers possibly with thousand dots and a comma decimal part
  const patterns = [
    /(\d{1,3}(?:\.\d{3})+,\d{1,2})/, // 1.500,00 or 1.234.567,89
    /(\d+,\d{1,2})/, // 25,90
    /(\d{1,3}(?:\.\d{3})+)/, // 1.500 (no decimal)
    /(\d+(?:\.\d+)?)/, // 5000 or 5.5
  ]

  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match) {
      const raw = match[1]
      let normalized: string
      // If has both '.' and ',' -> PT-BR thousand/decimal
      if (raw.includes('.') && raw.includes(',')) {
        normalized = raw.replace(/\./g, '').replace(',', '.')
      } else if (raw.includes(',') && !raw.includes('.')) {
        // Comma is decimal separator
        normalized = raw.replace(',', '.')
      } else {
        // Only dots or only digits. Single dot with 1-2 digits after = decimal, otherwise thousand
        const dotParts = raw.split('.')
        if (dotParts.length === 2 && dotParts[1].length <= 2) {
          normalized = raw // 5.5 -> decimal
        } else if (dotParts.length > 1) {
          // 1.500 -> thousand separator
          normalized = raw.replace(/\./g, '')
        } else {
          normalized = raw
        }
      }
      const value = parseFloat(normalized)
      if (!isNaN(value) && value > 0) return value
    }
  }
  return null
}

// ---- Installments extraction ----
function extractInstallments(text: string): number {
  const normalized = stripAccents(text)
  // "parcelado em 12", "em 12 vezes", "12x", "12 x"
  const patterns = [
    /parcelado\s+em\s+(\d{1,2})/,
    /em\s+(\d{1,2})\s+vezes/,
    /(\d{1,2})\s*[xX]\s/,
    /(\d{1,2})\s*[xX]$/,
    /\b(\d{1,2})x\b/,
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match) {
      const v = parseInt(match[1], 10)
      if (v >= 2 && v <= 60) return v
    }
  }
  return 1
}

// ---- Type extraction ----
function extractType(normalized: string, categoryType?: TransactionType): TransactionType {
  if (EXPENSE_KEYWORDS.some((kw) => normalized.includes(kw))) return 'despesa'
  if (INCOME_KEYWORDS.some((kw) => normalized.includes(kw))) return 'receita'
  // Fallback: rely on the detected category type
  if (categoryType) return categoryType
  return 'despesa' // default conservative
}

// ---- Category extraction ----
function extractCategory(
  normalized: string,
  categories: Category[],
  type: TransactionType,
): { categoryId?: string; categoryName: string; matched: boolean } {
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(stripAccents(kw)))) {
      // Find a matching category in the company's list (by name, case-insensitive, no accents)
      const match = categories.find(
        (c) =>
          c.name.toLowerCase() === rule.category.toLowerCase() ||
          stripAccents(c.name) === stripAccents(rule.category),
      )
      if (match) return { categoryId: match.id, categoryName: match.name, matched: true }
      // Loose: category contains keyword
      const loose = categories.find(
        (c) =>
          c.name.toLowerCase().includes(rule.category.toLowerCase()) ||
          stripAccents(c.name).includes(stripAccents(rule.category)),
      )
      if (loose) return { categoryId: loose.id, categoryName: loose.name, matched: true }
      // Suggested category name not present in DB -> fall back to "Outros"
      return { categoryName: rule.category, matched: false }
    }
  }
  return { categoryName: 'Outros', matched: false }
}

// ---- Account extraction ----
function extractAccount(
  normalized: string,
  accounts: Account[],
): { accountId?: string; matched: boolean } {
  if (accounts.length === 0) return { matched: false }
  // Match by account name or bank name (normalized)
  for (const acc of accounts) {
    const accName = stripAccents(acc.name.toLowerCase())
    if (accName.length > 2 && normalized.includes(accName)) {
      return { accountId: acc.id, matched: true }
    }
    if (acc.bank) {
      const bank = stripAccents(acc.bank.toLowerCase())
      // Match significant bank tokens (nubank, itau, bradesco, etc.)
      const tokens = bank.split(/[\s/&]+/).filter((t) => t.length > 2)
      for (const tok of tokens) {
        if (normalized.includes(tok)) {
          return { accountId: acc.id, matched: true }
        }
      }
    }
  }
  // Match by account type keyword
  for (const [accType, keywords] of Object.entries(ACCOUNT_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalized.includes(stripAccents(kw))) {
        const match = accounts.find((a) => a.type === accType)
        if (match) return { accountId: match.id, matched: true }
      }
    }
  }
  // Fallback: first account
  return { accountId: accounts[0]?.id, matched: false }
}

// ---- Date extraction ----
function extractDate(text: string): { date: string; matched: boolean } {
  const normalized = stripAccents(text)
  const today = new Date()

  if (/\bhoje\b/.test(normalized)) return { date: toISODate(today), matched: true }
  if (/\bontem\b/.test(normalized)) {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return { date: toISODate(d), matched: true }
  }
  if (/\banteontem\b/.test(normalized)) {
    const d = new Date(today)
    d.setDate(d.getDate() - 2)
    return { date: toISODate(d), matched: true }
  }
  if (/\bsemana passada\b/.test(normalized)) {
    const d = new Date(today)
    d.setDate(d.getDate() - 7)
    return { date: toISODate(d), matched: true }
  }

  // "dia X" / "dia XX"
  const dayMatch = normalized.match(/\bdia\s+(\d{1,2})\b/)
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10)
    if (day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), today.getMonth(), day)
      // If the day already passed this month, assume next month
      if (d < today && Math.abs(d.getTime() - today.getTime()) > 1000 * 60 * 60 * 12) {
        d.setMonth(d.getMonth() + 1)
      }
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      if (day <= lastDay) return { date: toISODate(d), matched: true }
    }
  }

  return { date: toISODate(today), matched: false }
}

// ---- Description builder ----
function buildDescription(text: string, amount: number | null, installments: number): string {
  let desc = text.trim()
  // Remove currency symbols
  desc = desc.replace(/r\$\s?/gi, '')
  // Remove amount mentions
  if (amount !== null) {
    // Try to remove the raw number strings that may represent the amount
    const candidates = new Set<string>()
    const raw = amount.toString().replace('.', ',')
    candidates.add(raw)
    candidates.add(amount.toFixed(2).replace('.', ','))
    candidates.add(
      amount
        .toFixed(2)
        .replace('.', ',')
        .replace(/(\d)(?=(\d{3})+,)/g, '$1.'),
    )
    candidates.add(amount.toLocaleString('pt-BR'))
    candidates.add(String(amount))
    candidates.forEach((cand) => {
      // Word-boundary-ish removal
      desc = desc.split(cand).join('')
    })
  }
  // Remove installment phrases
  desc = desc.replace(/parcelado\s+em\s+\d{1,2}\s*(vezes)?/gi, '')
  desc = desc.replace(/em\s+\d{1,2}\s+vezes/gi, '')
  desc = desc.replace(/\d{1,2}\s*[xX]\s/gi, '')
  desc = desc.replace(/\d{1,2}\s*[xX]$/gi, '')
  desc = desc.replace(/\b\d{1,2}x\b/gi, '')
  // Remove date phrases
  desc = desc.replace(/\bhoje\b/gi, '')
  desc = desc.replace(/\bontem\b/gi, '')
  desc = desc.replace(/\banteontem\b/gi, '')
  desc = desc.replace(/\bsemana passada\b/gi, '')
  desc = desc.replace(/\bdia\s+\d{1,2}\b/gi, '')
  // Remove type/action verbs at the start for a cleaner description
  desc = desc.replace(/^(paguei|gastei|comprei|pagar|pago|recebi|ganhei|vendi)\s+/i, '')
  // Remove leftover account-type filler words near the end
  desc = desc.replace(
    /\b(no|na|em|com|pelo|pela)\s+(cart[aã]o de cr[eé]dito|cart[aã]o de d[eé]bito|cr[eé]dito|d[eé]bito|pix|dinheiro|carteira)\b/gi,
    '',
  )
  // Remove "no Nubank" / "na conta X" style when account is a known bank name - generic cleanup
  desc = desc.replace(
    /\b(no|na)\s+(nubank|itau|ita[uú]|bradesco|santander|caixa|inter|c6|xp|btg|original|next)\b/gi,
    '',
  )
  // Tidy punctuation and whitespace
  desc = desc.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,\s*$/g, '').trim()
  // Capitalise first letter
  if (desc.length > 0) desc = desc.charAt(0).toUpperCase() + desc.slice(1)
  if (!desc) desc = 'Lançamento'
  return desc
}

// ---- Main parser ----
export function parseNaturalLanguageTransaction(
  text: string,
  accounts: Account[],
  categories: Category[],
): ParsedTransaction {
  const normalized = stripAccents(text.toLowerCase())

  // Determine type early (using a provisional category guess to inform type)
  const provisionalCat = extractCategory(normalized, categories, 'despesa')
  const provisionalCatType: TransactionType | undefined = CATEGORY_RULES.find(
    (r) => stripAccents(r.category) === stripAccents(provisionalCat.categoryName),
  )?.type
  const type = extractType(normalized, provisionalCatType)

  // Re-extract category
  const category = extractCategory(normalized, categories, type)
  const account = extractAccount(normalized, accounts)
  const date = extractDate(text)
  const installments = extractInstallments(text)
  const amount = extractAmount(text)
  const description = buildDescription(text, amount, installments)

  return {
    description,
    amount: amount ?? 0,
    type,
    date: date.date,
    installments_total: installments,
    account_id: account.accountId,
    category_id: category.categoryId,
    confidence: {
      type:
        EXPENSE_KEYWORDS.some((k) => normalized.includes(k)) ||
        INCOME_KEYWORDS.some((k) => normalized.includes(k)) ||
        Boolean(provisionalCatType),
      amount: amount !== null,
      date: date.matched,
      category: category.matched,
      account: account.matched,
      installments: installments > 1,
    },
  }
}

export { addMonths }
