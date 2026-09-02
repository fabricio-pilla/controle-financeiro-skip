import { Account, Category, Subcategory, TransactionType, RecurrenceType } from '@/types/database'

export interface ParsedTransaction {
  description: string
  amount: number
  type: TransactionType
  date: string // YYYY-MM-DD
  installments_total: number
  is_recurring?: boolean
  recurrence_type?: RecurrenceType
  account_id?: string
  category_id?: string
  subcategory_id?: string
  confidence: {
    type: boolean
    amount: boolean
    date: boolean
    category: boolean
    subcategory: boolean
    account: boolean
    installments: boolean
    recurrence: boolean
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
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
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

export function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((ch) => ACCENTS[ch] || ch)
    .join('')
}

// ---- Recurrence keywords & helpers ----
const RECURRING_KEYWORDS = [
  'recorrente',
  'recorrencia',
  'mensal',
  'mensalidade',
  'todo mes',
  'todos os meses',
  'mensalmente',
  'fixo',
  'fixa',
  'gasto fixo',
  'receita fixa',
  'assinatura',
]

const WEEKLY_KEYWORDS = ['semanal', 'semanalmente', 'toda semana']
const YEARLY_KEYWORDS = ['anual', 'anualmente', 'todo ano', 'anuidade']

function extractRecurrence(normalized: string): {
  isRecurring: boolean
  recurrenceType?: RecurrenceType
  matched: boolean
} {
  if (WEEKLY_KEYWORDS.some((kw) => normalized.includes(stripAccents(kw)))) {
    return { isRecurring: true, recurrenceType: 'semanal', matched: true }
  }
  if (YEARLY_KEYWORDS.some((kw) => normalized.includes(stripAccents(kw)))) {
    return { isRecurring: true, recurrenceType: 'anual', matched: true }
  }
  if (RECURRING_KEYWORDS.some((kw) => normalized.includes(stripAccents(kw)))) {
    return { isRecurring: true, recurrenceType: 'mensal', matched: true }
  }
  return { isRecurring: false, recurrenceType: undefined, matched: false }
}

// ---- Category dictionary (PT-BR) fallback rules ----
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
      '99app',
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
      'lavagem',
      'multa',
      'multas',
      'consorcio',
      'consórcio',
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
      'diarista',
      'faxina',
      'decoracao',
      'decoração',
      'utensilios',
      'utensílios',
      'manutencao predial',
      'manutenção predial',
      'financiamento imovel',
      'financiamento imóvel',
    ],
  },
  // Pets
  {
    category: 'Pets',
    type: 'despesa',
    keywords: [
      'pet',
      'pets',
      'cachorro',
      'gato',
      'racao',
      'ração',
      'veterinario',
      'veterinária',
      'veterinario',
      'banho e tosa',
      'petshop',
      'pet shop',
      'cobasi',
      'petz',
    ],
  },
  // Família
  {
    category: 'Família',
    type: 'despesa',
    keywords: [
      'familia',
      'família',
      'supermercado',
      'mercado',
      'farmacia',
      'farmácia',
      'comemoracao',
      'comemoração',
      'lavanderia',
      'suplementos',
      'suplemento',
      'igreja',
      'dizimo',
      'dízimo',
    ],
  },
  // Fast Escova
  {
    category: 'Fast Escova',
    type: 'despesa',
    keywords: ['fast escova', 'fastescova', 'franquia escova', 'implantacao', 'implantação'],
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
      'medicamentos',
      'exame',
      'laboratorio',
      'laboratório',
      'fisioterapia',
      'psicologo',
      'psicólogo',
      'psicologa',
      'psicóloga',
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
      'viagem',
      'passagem',
      'hotel',
      'hospedagem',
      'passeio',
      'balada',
      'show',
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
  // Salários / Proventos
  {
    category: 'Fabrício',
    type: 'receita',
    keywords: ['fabricio', 'fabrício'],
  },
  {
    category: 'Raffaela',
    type: 'receita',
    keywords: ['raffaela', 'raffa', 'rafaela', 'rafa'],
  },
  {
    category: 'Investimento',
    type: 'receita',
    keywords: [
      'investimento',
      'investimentos',
      'rendimento',
      'dividendo',
      'dividendos',
      'juros recebido',
      'resgate aplicacao',
      'resgate aplicação',
      'lucro investimento',
      'cdb',
      'tesouro',
      'fii',
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
  'debito',
  'débito',
  'saida',
  'saída',
]

const INCOME_KEYWORDS = [
  'recebi',
  'ganhei',
  'salario',
  'salário',
  'vendi',
  'venda',
  'vendas',
  'recebimento',
  'faturamento',
  'rendimento',
  'comissao',
  'comissão',
  'freela',
  'freelance',
  'receita',
  'receita fixa',
  'entrada',
  'entradas',
  'plr',
  'bonus',
  'bônus',
  'pro-labore',
  'pro labore',
  'honorario',
  'honorarios',
  'honorários',
  'recebi pix',
  'deposito recebido',
  'depósito recebido',
]

// Specific subcategories that strongly imply income
const INCOME_SUBCATEGORIES = [
  'salario',
  'salário',
  'plr',
  'vendas',
  'venda',
  'irpf',
  'prolabore',
  'pro labore',
  'comissao',
  'comissão',
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

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (day > lastDay) d.setDate(lastDay)
  return toISODate(d)
}

// ---- Amount extraction (PT-BR) ----
// Handles: "8000,00", "8.000,00", "25,90", "1.500", "R$ 5.000,00", "5000", "2.000,50"
function extractAmount(text: string): number | null {
  // Normalize R$ / currency symbols
  const cleaned = text.replace(/r\$\s?/gi, ' ').replace(/\b(?:reais?)\b/gi, ' ')

  // Try patterns with comma decimal separator (most common in PT-BR)
  // Match numbers possibly with thousand dots and a comma decimal part
  const patterns = [
    /(\d{1,3}(?:\.\d{3})+,\d{1,2})/, // 1.500,00 or 1.234.567,89
    /(\d+,\d{1,2})/, // 8000,00 or 25,90
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
function extractType(
  normalized: string,
  category?: Category | null,
  subcategory?: Subcategory | null,
): { type: TransactionType; matched: boolean } {
  // Explicit words for income/expense
  const hasIncomeKw = INCOME_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${stripAccents(kw)}\\b`, 'i')
    return regex.test(normalized)
  })
  const hasExpenseKw = EXPENSE_KEYWORDS.some((kw) => {
    const regex = new RegExp(`\\b${stripAccents(kw)}\\b`, 'i')
    return regex.test(normalized)
  })

  // Expense keywords (almoço, mercado, paguei...) indicam despesa — checar ANTES de nomes de pessoas
  const hasExpenseWord = EXPENSE_KEYWORDS.some((kw) =>
    new RegExp(`\\b${stripAccents(kw)}\\b`, 'i').test(normalized),
  )
  if (hasExpenseWord && !hasIncomeKw) {
    return { type: 'despesa', matched: true }
  }

  // Consumption words from expense category rules (almoço, mercado, supermercado, restaurante,
  // janta, lanche, padaria, farmácia...) indicam despesa — checar ANTES do fallback de categoria,
  // mas nunca sobrepor uma palavra explícita de renda.
  const hasConsumptionWord = CONSUMPTION_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(normalized),
  )
  if (hasConsumptionWord && !hasIncomeKw) {
    return { type: 'despesa', matched: true }
  }

  // Explicit 'entrada' vs 'saida' / 'despesa'
  if (/\b(entrada|entradas|receita|receitas|ganhei|recebi)\b/.test(normalized)) {
    return { type: 'receita', matched: true }
  }
  if (/\b(saida|saidas|saída|saídas|despesa|despesas|paguei|gastei|comprei)\b/.test(normalized)) {
    return { type: 'despesa', matched: true }
  }

  // Check subcategory hint (e.g. Salário, PLR, Vendas, IRPF -> receita)
  let incomeSubMatched = false
  if (subcategory) {
    const subNorm = stripAccents(subcategory.name)
    if (INCOME_SUBCATEGORIES.some((s) => subNorm === s || subNorm.includes(s))) {
      return { type: 'receita', matched: true }
    }
    incomeSubMatched = INCOME_SUBCATEGORIES.some((s) => subNorm === s)
  }

  // Check if text has income keywords
  if (hasIncomeKw && !hasExpenseKw) return { type: 'receita', matched: true }
  if (hasExpenseKw && !hasIncomeKw) return { type: 'despesa', matched: true }

  // Category fallback
  if (category) {
    // If category is strictly 'receita', default to receita
    if (category.type === 'receita') return { type: 'receita', matched: true }
    return { type: category.type, matched: false }
  }

  return { type: 'despesa', matched: false }
}

// ---- Token matching helper ----
function matchesPhraseOrWord(normalizedText: string, target: string): boolean {
  const normTarget = stripAccents(target.trim())
  if (!normTarget) return false
  // Word boundary regex
  const escaped = normTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return regex.test(normalizedText)
}

// ---- Category & Subcategory extraction ----
interface CategorySubcategoryMatch {
  category?: Category
  subcategory?: Subcategory
  categoryMatched: boolean
  subcategoryMatched: boolean
}

export function extractCategoryAndSubcategory(
  normalized: string,
  categories: Category[],
  subcategories: Subcategory[],
): CategorySubcategoryMatch {
  // Step 1: Check direct subcategory matches in the entire text
  // Sort subcategories by name length descending so multi-word names match first ("Plano de Saúde" before "Saúde")
  const sortedSubcategories = [...subcategories].sort((a, b) => b.name.length - a.name.length)

  // Find all matching subcategories from text
  const matchingSubs: Subcategory[] = []
  for (const sub of sortedSubcategories) {
    if (matchesPhraseOrWord(normalized, sub.name)) {
      matchingSubs.push(sub)
    }
  }

  // Step 2: Check direct category matches in the text
  const sortedCategories = [...categories].sort((a, b) => b.name.length - a.name.length)
  let foundCategory: Category | undefined
  for (const cat of sortedCategories) {
    if (matchesPhraseOrWord(normalized, cat.name)) {
      foundCategory = cat
      break
    }
  }

  // Step 3: Check category rules dictionary if not directly found
  if (!foundCategory) {
    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some((kw) => matchesPhraseOrWord(normalized, kw))) {
        const match = categories.find(
          (c) =>
            stripAccents(c.name) === stripAccents(rule.category) ||
            stripAccents(c.name).includes(stripAccents(rule.category)) ||
            stripAccents(rule.category).includes(stripAccents(c.name)),
        )
        if (match) {
          foundCategory = match
          break
        }
      }
    }
  }

  // Step 4: Resolve combination of category and subcategory
  if (foundCategory) {
    // Look for a matching subcategory that belongs to this category first
    const subForFoundCat = matchingSubs.find((s) => s.category_id === foundCategory?.id)
    if (subForFoundCat) {
      return {
        category: foundCategory,
        subcategory: subForFoundCat,
        categoryMatched: true,
        subcategoryMatched: true,
      }
    }
    // If no matching sub under this category, return category with subcategoryMatched = false
    return {
      category: foundCategory,
      subcategory: matchingSubs[0] || undefined,
      categoryMatched: true,
      subcategoryMatched: Boolean(
        matchingSubs[0] && matchingSubs[0].category_id === foundCategory.id,
      ),
    }
  }

  // If category wasn't found directly, but we found matching subcategories:
  if (matchingSubs.length > 0) {
    const bestSub = matchingSubs[0]
    const parentCategory = categories.find((c) => c.id === bestSub.category_id)
    return {
      category: parentCategory,
      subcategory: bestSub,
      categoryMatched: Boolean(parentCategory),
      subcategoryMatched: true,
    }
  }

  return {
    category: undefined,
    subcategory: undefined,
    categoryMatched: false,
    subcategoryMatched: false,
  }
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
    if (accName.length > 2 && matchesPhraseOrWord(normalized, accName)) {
      return { accountId: acc.id, matched: true }
    }
    if (acc.bank) {
      const bank = stripAccents(acc.bank.toLowerCase())
      // Match significant bank tokens (nubank, itau, bradesco, etc.)
      const tokens = bank.split(/[\s/&]+/).filter((t) => t.length > 2)
      for (const tok of tokens) {
        if (matchesPhraseOrWord(normalized, tok)) {
          return { accountId: acc.id, matched: true }
        }
      }
    }
  }
  // Match by account type keyword
  for (const [accType, keywords] of Object.entries(ACCOUNT_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (matchesPhraseOrWord(normalized, kw)) {
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
function buildDescription(
  text: string,
  amount: number | null,
  installments: number,
  categoryName?: string,
  subcategoryName?: string,
): string {
  let desc = text.trim()
  // Remove currency symbols
  desc = desc.replace(/r\$\s?/gi, '')
  // Remove amount mentions
  if (amount !== null) {
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
      desc = desc.split(cand).join('')
    })
  }

  // Remove recurrence keywords
  RECURRING_KEYWORDS.forEach((kw) => {
    const reg = new RegExp(`\\b${kw}\\b`, 'gi')
    desc = desc.replace(reg, '')
  })
  WEEKLY_KEYWORDS.forEach((kw) => {
    const reg = new RegExp(`\\b${kw}\\b`, 'gi')
    desc = desc.replace(reg, '')
  })
  YEARLY_KEYWORDS.forEach((kw) => {
    const reg = new RegExp(`\\b${kw}\\b`, 'gi')
    desc = desc.replace(reg, '')
  })

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
  desc = desc.replace(
    /^(paguei|gastei|comprei|pagar|pago|recebi|ganhei|vendi|entrada|receita|despesa|saida|saída)\s+/i,
    '',
  )

  // Remove leftover account-type filler words near the end
  desc = desc.replace(
    /\b(no|na|em|com|pelo|pela)\s+(cart[aã]o de cr[eé]dito|cart[aã]o de d[eé]bito|cr[eé]dito|d[eé]bito|pix|dinheiro|carteira)\b/gi,
    '',
  )
  desc = desc.replace(
    /\b(no|na)\s+(nubank|itau|ita[uú]|bradesco|santander|caixa|inter|c6|xp|btg|original|next)\b/gi,
    '',
  )

  // Tidy punctuation and whitespace
  desc = desc.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,\s*$/g, '').trim()

  // If text is empty or just generic, form an intelligent description from Category / Subcategory
  if (!desc || desc.length <= 1) {
    if (categoryName && subcategoryName) {
      desc = `${subcategoryName} (${categoryName})`
    } else if (subcategoryName) {
      desc = subcategoryName
    } else if (categoryName) {
      desc = categoryName
    } else {
      desc = 'Lançamento'
    }
  }

  // Capitalise first letter
  if (desc.length > 0) desc = desc.charAt(0).toUpperCase() + desc.slice(1)
  return desc
}

// ---- Main parser ----
export function parseNaturalLanguageTransaction(
  text: string,
  accounts: Account[],
  categories: Category[],
  subcategories: Subcategory[] = [],
): ParsedTransaction {
  const normalized = stripAccents(text.toLowerCase())

  // 1. Extract category & subcategory simultaneously
  const { category, subcategory, categoryMatched, subcategoryMatched } =
    extractCategoryAndSubcategory(normalized, categories, subcategories)

  // 2. Extract Type (receita / despesa)
  const typeResult = extractType(normalized, category, subcategory)

  // 3. Extract Recurrence
  const recurrenceResult = extractRecurrence(normalized)

  // 4. Extract Account
  const account = extractAccount(normalized, accounts)

  // 5. Extract Date, Installments and Amount
  const date = extractDate(text)
  const installments = extractInstallments(text)
  const amount = extractAmount(text)

  // 6. Build clean description
  const description = buildDescription(
    text,
    amount,
    installments,
    category?.name,
    subcategory?.name,
  )

  return {
    description,
    amount: amount ?? 0,
    type: typeResult.type,
    date: date.date,
    installments_total: installments,
    is_recurring: recurrenceResult.isRecurring,
    recurrence_type:
      recurrenceResult.recurrenceType || (recurrenceResult.isRecurring ? 'mensal' : undefined),
    account_id: account.accountId,
    category_id: category?.id,
    subcategory_id: subcategory?.id,
    confidence: {
      type: typeResult.matched,
      amount: amount !== null,
      date: date.matched,
      category: categoryMatched,
      subcategory: subcategoryMatched,
      account: account.matched,
      installments: installments > 1,
      recurrence: recurrenceResult.matched,
    },
  }
}
