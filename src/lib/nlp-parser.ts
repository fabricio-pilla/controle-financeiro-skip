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

// ---- Consumption / expense keywords for disambiguation ----
const CONSUMPTION_KEYWORDS = [
  'almoco',
  'almoco',
  'almoço',
  'janta',
  'jantar',
  'lanche',
  'padaria',
  'restaurante',
  'mercado',
  'supermercado',
  'ifood',
  'delivery',
  'cafe',
  'café',
  'pizza',
  'pizzaria',
  'hamburguer',
  'burger',
  'uber',
  'gasolina',
  'farmacia',
  'farmácia',
  'remedio',
  'remédio',
  'cinema',
  'estacionamento',
  'pedagio',
  'pedágio',
  'passagem',
  'hotel',
  'pet',
  'racao',
  'ração',
  'veterinario',
  'veterinário',
  'vet',
]

// ---- Category dictionary (PT-BR) fallback rules ----
interface CategoryRule {
  keywords: string[]
  category: string
  type: TransactionType
}

const CLOTHING_KEYWORDS = [
  'tenis',
  'tênis',
  'sapato',
  'sapatos',
  'sandalia',
  'sandália',
  'chinelo',
  'bota',
  'roupa',
  'roupas',
  'camisa',
  'camiseta',
  'calca',
  'calça',
  'bermuda',
  'short',
  'shorts',
  'jaqueta',
  'casaco',
  'moletom',
  'vestido',
  'saia',
  'meia',
  'meias',
  'cueca',
  'calcinha',
  'sutia',
  'sutiã',
  'bones',
  'bone',
  'boné',
  'relogio',
  'relógio',
  'bolsa',
  'mochila',
  'carteira',
  'cinto',
  'oculos',
  'óculos',
  'acessorio',
  'acessórios',
  'acessorios',
  'zara',
  'renner',
  'riachuelo',
  'c&a',
  'cea',
  'centauro',
  'nike',
  'adidas',
]

const CATEGORY_RULES: CategoryRule[] = [
  // Roupas e Acessórios / Vestuário
  {
    category: 'Roupas e Acessórios',
    type: 'despesa',
    keywords: CLOTHING_KEYWORDS,
  },
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
  'credito',
  'crédito',
  'cartao de credito',
  'cartão de crédito',
  'cartao credito',
  'cartão crédito',
  'no credito',
  'no crédito',
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
  // Explicit words for income
  const hasIncomeKw = INCOME_KEYWORDS.some((kw) => {
    const escaped = stripAccents(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized)
  })

  // Explicit words for expense
  const hasExpenseKw = EXPENSE_KEYWORDS.some((kw) => {
    const escaped = stripAccents(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized)
  })

  // Words indicating credit card / payment method that signify purchase / despesa
  const hasCreditWord = /\b(cr[eé]dito|cart[aã]o de cr[eé]dito|cart[aã]o cr[eé]dito)\b/i.test(
    normalized,
  )

  // Priority 1: Explicit words of income in text ("entrada", "recebi", "salário", "faturamento", etc.)
  // (e.g. "Fabricio Entrada Salario 8000,00 recorrente")
  const hasStrongIncomeWord =
    /\b(entrada|entradas|salario|salário|recebi|ganhei|recebimento|faturamento|rendimento|plr|pro-labore|pro labore|honorarios?|comissao|comissão|freela|freelance)\b/i.test(
      normalized,
    )
  if (hasStrongIncomeWord) {
    return { type: 'receita', matched: true }
  }
  if (hasIncomeKw && !hasExpenseKw && !hasCreditWord) {
    return { type: 'receita', matched: true }
  }

  // Priority 2: Explicit words of expense ("paguei", "compra", "credito", "cartao de credito", "no credito", "debito", "saida"...)
  // Requirement: "A palavra 'credito' (e variações: 'crédito', 'credito', 'cartão de crédito', 'no credito') no texto interpretado deve forçar o tipo como DESPESA"
  if (hasExpenseKw || hasCreditWord) {
    return { type: 'despesa', matched: true }
  }

  // Priority 3: Consumption words (almoço, mercado, restaurante, janta, farmácia, tênis, etc.)
  const hasConsumptionWord =
    CONSUMPTION_KEYWORDS.some((kw) => {
      const normKw = stripAccents(kw)
      const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized)
    }) ||
    CLOTHING_KEYWORDS.some((kw) => {
      const normKw = stripAccents(kw)
      const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized)
    })

  if (hasConsumptionWord) {
    return { type: 'despesa', matched: true }
  }

  // Subcategory hint (e.g. Salário, PLR, Vendas, IRPF -> receita)
  if (subcategory) {
    const subNorm = stripAccents(subcategory.name)
    if (INCOME_SUBCATEGORIES.some((s) => subNorm === s || subNorm.includes(s))) {
      return { type: 'receita', matched: true }
    }
  }

  // Priority 4: Category fallback
  if (category) {
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

export const HYBRID_CATEGORIES = ['fabricio', 'raffaela', 'investimento']

export function isHybridCategory(categoryName: string): boolean {
  const norm = stripAccents(categoryName.trim())
  return (
    norm === 'fabricio' ||
    norm === 'raffaela' ||
    norm === 'rafaela' ||
    norm === 'investimento' ||
    norm === 'investimentos'
  )
}

export function isCategoryAllowedForType(category: Category, type: TransactionType): boolean {
  if (category.type === type) return true
  return isHybridCategory(category.name)
}

export function extractCategoryAndSubcategory(
  normalized: string,
  categories: Category[],
  subcategories: Subcategory[],
  targetType?: TransactionType,
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
  const directCatMatches: Category[] = []
  for (const cat of sortedCategories) {
    if (matchesPhraseOrWord(normalized, cat.name)) {
      directCatMatches.push(cat)
    }
  }

  // Check if a person category was explicitly mentioned (e.g. "Raffaela", "Fabrício", "Helena", "Emanuel", "Matheus")
  const personCat = directCatMatches.find((c) => {
    const n = stripAccents(c.name)
    return (
      n === 'raffaela' ||
      n === 'rafaela' ||
      n === 'raffa' ||
      n === 'rafa' ||
      n === 'fabricio' ||
      n === 'emanuel' ||
      n === 'helena' ||
      n === 'matheus'
    )
  })

  // If a person category is mentioned, check if that person has a subcategory matching the action or words
  if (personCat) {
    const personSubs = subcategories.filter((s) => s.category_id === personCat.id)
    // 1. Direct subcategory name match within person's subcategories
    const directSubInPerson = personSubs.find((s) => matchesPhraseOrWord(normalized, s.name))
    if (directSubInPerson) {
      return {
        category: personCat,
        subcategory: directSubInPerson,
        categoryMatched: true,
        subcategoryMatched: true,
      }
    }
    // 2. Semantic matching for food/lunch/dinner under person category (e.g. "Alimentação")
    if (
      normalized.includes('almoco') ||
      normalized.includes('janta') ||
      normalized.includes('restaurante') ||
      normalized.includes('lanche') ||
      normalized.includes('padaria') ||
      normalized.includes('refeicao')
    ) {
      const foodSubInPerson = personSubs.find((s) => {
        const sNorm = stripAccents(s.name)
        return (
          sNorm.includes('alimentac') || sNorm.includes('refeic') || sNorm.includes('restaurante')
        )
      })
      if (foodSubInPerson) {
        return {
          category: personCat,
          subcategory: foodSubInPerson,
          categoryMatched: true,
          subcategoryMatched: true,
        }
      }
    }
    // 3. Any other semantic matches under person's subcategories (e.g. farmácia, remédio -> medicamentos)
    if (
      normalized.includes('farmacia') ||
      normalized.includes('remedio') ||
      normalized.includes('medicamento')
    ) {
      const medSub = personSubs.find(
        (s) =>
          stripAccents(s.name).includes('medicament') || stripAccents(s.name).includes('farmac'),
      )
      if (medSub) {
        return {
          category: personCat,
          subcategory: medSub,
          categoryMatched: true,
          subcategoryMatched: true,
        }
      }
    }
    // 4. Semantic matching for clothes/shoes under person category (e.g. "Roupas e Acessórios")
    if (CLOTHING_KEYWORDS.some((kw) => matchesPhraseOrWord(normalized, kw))) {
      const clothingSub = personSubs.find((s) => {
        const sNorm = stripAccents(s.name)
        return sNorm.includes('roupa') || sNorm.includes('vestuario') || sNorm.includes('acessorio')
      })
      if (clothingSub) {
        return {
          category: personCat,
          subcategory: clothingSub,
          categoryMatched: true,
          subcategoryMatched: true,
        }
      }
    }
  }

  // Step 3: Check dictionary rules
  const ruleMatches: Category[] = []
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => matchesPhraseOrWord(normalized, kw))) {
      const match = categories.find(
        (c) =>
          stripAccents(c.name) === stripAccents(rule.category) ||
          stripAccents(c.name).includes(stripAccents(rule.category)) ||
          stripAccents(rule.category).includes(stripAccents(c.name)),
      )
      if (match) {
        ruleMatches.push(match)
      }
    }
  }

  // Step 4: If matching subcategories exist, prioritize them!
  // E.g. If "Almoço" or "Restaurante" matches subcategory "Restaurantes / Delivery",
  // that points directly to category "Família" and subcategory "Restaurantes / Delivery".
  if (matchingSubs.length > 0) {
    // If a person category is mentioned and owns one of matchingSubs, prefer it
    if (personCat) {
      const subOwnedByPerson = matchingSubs.find((s) => s.category_id === personCat.id)
      if (subOwnedByPerson) {
        return {
          category: personCat,
          subcategory: subOwnedByPerson,
          categoryMatched: true,
          subcategoryMatched: true,
        }
      }
    }

    // If we have a directCatMatch that owns this subcategory
    const subOwnedByDirect = matchingSubs.find((s) =>
      directCatMatches.some((dc) => dc.id === s.category_id),
    )
    if (subOwnedByDirect) {
      const parent = categories.find((c) => c.id === subOwnedByDirect.category_id)
      return {
        category: parent,
        subcategory: subOwnedByDirect,
        categoryMatched: Boolean(parent),
        subcategoryMatched: true,
      }
    }

    // If we have a ruleMatch that owns this subcategory
    const subOwnedByRule = matchingSubs.find((s) =>
      ruleMatches.some((rm) => rm.id === s.category_id),
    )
    if (subOwnedByRule) {
      const parent = categories.find((c) => c.id === subOwnedByRule.category_id)
      return {
        category: parent,
        subcategory: subOwnedByRule,
        categoryMatched: Boolean(parent),
        subcategoryMatched: true,
      }
    }

    // Otherwise, the best matched subcategory gives us its parent category
    const bestSub = matchingSubs[0]
    const parentCategory = categories.find((c) => c.id === bestSub.category_id)
    return {
      category: parentCategory,
      subcategory: bestSub,
      categoryMatched: Boolean(parentCategory),
      subcategoryMatched: true,
    }
  }

  // If no direct subcategory matched yet, see if dictionary rule keywords match a subcategory
  // e.g. "almoco" matches "Restaurantes / Delivery" or "Alimentação"
  for (const rule of CATEGORY_RULES) {
    const matchedKeyword = rule.keywords.find((kw) => matchesPhraseOrWord(normalized, kw))
    if (matchedKeyword) {
      // Look for a subcategory whose name or category matches
      // First check if personCat has a matching subcategory for this keyword or rule
      if (personCat) {
        const personSubs = subcategories.filter((s) => s.category_id === personCat.id)
        const subInPerson = personSubs.find((s) => {
          const sNorm = stripAccents(s.name)
          return (
            sNorm.includes(matchedKeyword) ||
            matchedKeyword.includes(sNorm) ||
            (rule.category === 'Roupas e Acessórios' &&
              (sNorm.includes('roupa') ||
                sNorm.includes('acessorio') ||
                sNorm.includes('vestuario'))) ||
            (rule.category === 'Alimentação' &&
              (sNorm.includes('alimentac') ||
                sNorm.includes('refeic') ||
                sNorm.includes('restaurante'))) ||
            (rule.category === 'Saúde' &&
              (sNorm.includes('medicament') || sNorm.includes('saude') || sNorm.includes('farmac')))
          )
        })
        if (subInPerson) {
          return {
            category: personCat,
            subcategory: subInPerson,
            categoryMatched: true,
            subcategoryMatched: true,
          }
        }
      }

      // Check if any subcategory contains or relates to this keyword
      const subMatch = subcategories.find((s) => {
        const sNorm = stripAccents(s.name)
        return (
          sNorm.includes(matchedKeyword) ||
          matchedKeyword.includes(sNorm) ||
          (matchedKeyword === 'almoco' &&
            (sNorm.includes('restaurante') || sNorm.includes('alimentac'))) ||
          (matchedKeyword === 'jantar' &&
            (sNorm.includes('restaurante') || sNorm.includes('alimentac'))) ||
          (matchedKeyword === 'ifood' &&
            (sNorm.includes('delivery') || sNorm.includes('restaurante'))) ||
          (rule.category === 'Roupas e Acessórios' &&
            (sNorm.includes('roupa') || sNorm.includes('acessorio') || sNorm.includes('vestuario')))
        )
      })
      if (subMatch) {
        const parent = categories.find((c) => c.id === subMatch.category_id)
        if (personCat) {
          return {
            category: personCat,
            subcategory: undefined,
            categoryMatched: true,
            subcategoryMatched: false,
          }
        }
        if (parent) {
          return {
            category: parent,
            subcategory: subMatch,
            categoryMatched: true,
            subcategoryMatched: true,
          }
        }
      }
    }
  }

  // Step 5: Check category from personCat, directCatMatches, or ruleMatches
  if (personCat) {
    return {
      category: personCat,
      subcategory: undefined,
      categoryMatched: true,
      subcategoryMatched: false,
    }
  }

  // Direct category matches
  if (directCatMatches.length > 0) {
    const found = directCatMatches[0]
    return {
      category: found,
      subcategory: undefined,
      categoryMatched: true,
      subcategoryMatched: false,
    }
  }

  // Dictionary rule matches
  if (ruleMatches.length > 0) {
    const found = ruleMatches[0]
    return {
      category: found,
      subcategory: undefined,
      categoryMatched: true,
      subcategoryMatched: false,
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
  // Match by combinations: e.g. "credito santander" -> account with 'santander' and type 'credito' (or 'credito' in name)
  // or "debito neon" -> account with 'neon' and type != 'credito'
  const isCreditoKw =
    matchesPhraseOrWord(normalized, 'credito') ||
    matchesPhraseOrWord(normalized, 'crédito') ||
    matchesPhraseOrWord(normalized, 'cartao de credito') ||
    matchesPhraseOrWord(normalized, 'cartão de crédito') ||
    matchesPhraseOrWord(normalized, 'cartao credito') ||
    matchesPhraseOrWord(normalized, 'cartão crédito')

  const isDebitoKw =
    matchesPhraseOrWord(normalized, 'debito') ||
    matchesPhraseOrWord(normalized, 'débito') ||
    matchesPhraseOrWord(normalized, 'cartao de debito') ||
    matchesPhraseOrWord(normalized, 'cartão de débito') ||
    matchesPhraseOrWord(normalized, 'cartao debito') ||
    matchesPhraseOrWord(normalized, 'cartão débito')

  // Collect potential bank/brand tokens from accounts dynamically + known list
  const knownBanks = new Set([
    'santander',
    'neon',
    'nubank',
    'itau',
    'bradesco',
    'inter',
    'c6',
    'caixa',
    'flash',
    'original',
    'next',
    'safra',
    'btg',
    'xp',
    'sicoob',
    'sicredi',
  ])
  accounts.forEach((a) => {
    if (a.bank) {
      stripAccents(a.bank.toLowerCase())
        .split(/[\s/&]+/)
        .forEach((tok) => {
          if (tok.length > 2) knownBanks.add(tok)
        })
    }
    // Also include words from account name (e.g. "Neon", "Santander")
    stripAccents(a.name.toLowerCase())
      .split(/[\s/&]+/)
      .forEach((tok) => {
        if (
          tok.length > 2 &&
          tok !== 'credito' &&
          tok !== 'debito' &&
          tok !== 'conta' &&
          tok !== 'cartao'
        ) {
          knownBanks.add(tok)
        }
      })
  })

  // Check which bank keywords are mentioned in normalized string
  for (const bankName of Array.from(knownBanks)) {
    if (matchesPhraseOrWord(normalized, bankName)) {
      let bankAccounts = accounts.filter((a) => {
        const aName = stripAccents(a.name.toLowerCase())
        const aBank = stripAccents((a.bank || '').toLowerCase())
        return aName.includes(bankName) || aBank.includes(bankName)
      })

      if (bankAccounts.length > 0) {
        // If a person is mentioned in the text (e.g. "fabricio", "raffaela"), filter to that person's accounts first if possible
        const personTokens = ['fabricio', 'raffaela', 'rafaela', 'helena', 'emanuel', 'matheus']
        const mentionedPerson = personTokens.find((p) => matchesPhraseOrWord(normalized, p))
        if (mentionedPerson) {
          const personBankAccounts = bankAccounts.filter((a) =>
            stripAccents(a.name.toLowerCase()).includes(mentionedPerson),
          )
          if (personBankAccounts.length > 0) {
            bankAccounts = personBankAccounts
          }
        }

        if (isCreditoKw) {
          const credAcc = bankAccounts.find(
            (a) => a.type === 'credito' || stripAccents(a.name.toLowerCase()).includes('credito'),
          )
          if (credAcc) return { accountId: credAcc.id, matched: true }
        }
        if (isDebitoKw) {
          const debAcc = bankAccounts.find(
            (a) => a.type !== 'credito' && !stripAccents(a.name.toLowerCase()).includes('credito'),
          )
          if (debAcc) return { accountId: debAcc.id, matched: true }
        }
        // If bank matches and there's a person mentioned (e.g. "santander fabricio")
        for (const candidate of bankAccounts) {
          const cNameTokens = stripAccents(candidate.name.toLowerCase()).split(/\s+/)
          if (cNameTokens.some((tok) => tok.length > 3 && matchesPhraseOrWord(normalized, tok))) {
            return { accountId: candidate.id, matched: true }
          }
        }
        // If neither or only bank mentioned, pick primary among bankAccounts or first
        const primaryInBank = bankAccounts.find((a) => a.is_primary)
        return { accountId: (primaryInBank || bankAccounts[0]).id, matched: true }
      }
    }
  }

  // Match by account type keyword
  for (const [accType, keywords] of Object.entries(ACCOUNT_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (matchesPhraseOrWord(normalized, kw)) {
        // Prefer primary account of this type if any, else first
        const match =
          accounts.find((a) => a.type === accType && a.is_primary) ||
          accounts.find((a) => a.type === accType)
        if (match) return { accountId: match.id, matched: true }
      }
    }
  }
  // Fallback: primary account or first account
  const primary = accounts.find((a) => a.is_primary)
  return { accountId: primary?.id || accounts[0]?.id, matched: false }
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
  accounts: Account[] = [],
  categories: Category[] = [],
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
    // Also candidate for "45,0" when amount is 45
    candidates.add(`${Math.floor(amount)},0`)
    candidates.forEach((cand) => {
      desc = desc.split(cand).join(' ')
    })
  }

  // Remove recurrence keywords
  RECURRING_KEYWORDS.forEach((kw) => {
    const reg = new RegExp(`\\b${kw}\\b`, 'gi')
    desc = desc.replace(reg, ' ')
  })
  WEEKLY_KEYWORDS.forEach((kw) => {
    const reg = new RegExp(`\\b${kw}\\b`, 'gi')
    desc = desc.replace(reg, ' ')
  })
  YEARLY_KEYWORDS.forEach((kw) => {
    const reg = new RegExp(`\\b${kw}\\b`, 'gi')
    desc = desc.replace(reg, ' ')
  })

  // Remove installment phrases
  desc = desc.replace(/parcelado\s+em\s+\d{1,2}\s*(vezes)?/gi, ' ')
  desc = desc.replace(/em\s+\d{1,2}\s+vezes/gi, ' ')
  desc = desc.replace(/em\s+\d{1,2}\s*[xX]/gi, ' ')
  desc = desc.replace(/\d{1,2}\s*[xX]\s/gi, ' ')
  desc = desc.replace(/\d{1,2}\s*[xX]$/gi, ' ')
  desc = desc.replace(/\b\d{1,2}x\b/gi, ' ')

  // Remove date phrases
  desc = desc.replace(/\bhoje\b/gi, ' ')
  desc = desc.replace(/\bontem\b/gi, ' ')
  desc = desc.replace(/\banteontem\b/gi, ' ')
  desc = desc.replace(/\bsemana passada\b/gi, ' ')
  desc = desc.replace(/\bdia\s+\d{1,2}\b/gi, ' ')

  // Remove type/action verbs
  desc = desc.replace(
    /\b(paguei|gastei|comprei|pagar|pago|recebi|ganhei|vendi|entrada|receita|despesa|saida|saída)\b/gi,
    ' ',
  )

  // Remove account names and bank tokens
  accounts.forEach((acc) => {
    if (acc.name) {
      const escaped = acc.name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
      desc = desc.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ')
    }
    if (acc.bank) {
      const tokens = acc.bank.split(/[\s/&]+/).filter((t) => t.length > 2)
      tokens.forEach((t) => {
        const escaped = t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
        desc = desc.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ')
      })
    }
  })

  // Known bank names
  const knownBanksRegex =
    /\b(santander|neon|nubank|itau|itaú|bradesco|inter|c6|caixa|flash|original|next|safra|btg|xp|sicoob|sicredi)\b/gi
  desc = desc.replace(knownBanksRegex, ' ')

  // Remove payment method/channel phrases
  desc = desc.replace(
    /\b(cart[aã]o de cr[eé]dito|cart[aã]o de d[eé]bito|cart[aã]o cr[eé]dito|cart[aã]o d[eé]bito|cart[aã]o)\b/gi,
    ' ',
  )
  desc = desc.replace(
    /\b(cr[eé]dito|d[eé]bito|pix|dinheiro|carteira|transfer[eê]ncia|ted|doc|boleto)\b/gi,
    ' ',
  )

  // Remove prepositions and articles left over: no, na, nos, nas, em, de, do, da, dos, das, pelo, pela, pelos, pelas, com, para, pro, pra
  desc = desc.replace(
    /\b(no|na|nos|nas|em|de|do|da|dos|das|pelo|pela|pelos|pelas|com|para|pro|pra)\b/gi,
    ' ',
  )

  // If a personal category name was matched (e.g. Raffaela, Fabrício, Matheus, Helena, Emanuel),
  // remove the person name from the product description if there is other product content in phrase.
  // E.g.: "almoço raffaela" -> "Almoço"
  const personCatNames = [
    'fabricio',
    'fabrício',
    'raffaela',
    'rafaela',
    'helena',
    'emanuel',
    'matheus',
  ]
  personCatNames.forEach((pn) => {
    const reg = new RegExp(`\\b${pn}\\b`, 'gi')
    // Only strip person name if there are other meaningful words
    const stripped = desc.replace(reg, ' ').replace(/\s+/g, ' ').trim()
    if (stripped.length >= 3) {
      desc = stripped
    }
  })

  // Tidy punctuation and whitespace
  desc = desc.replace(/[^\w\sÀ-ÿ-]/gi, ' ')
  desc = desc.replace(/\s+/g, ' ').trim()

  // Regra do usuário:
  // "Na descrição do lançamento gerado, colocar APENAS o nome do produto (a coisa comprada, ex: 'Almoço', 'Notebook').
  // Se não houver nome de produto na frase, usar a Subcategoria ou, na falta, a Categoria."
  if (!desc || desc.length <= 1) {
    if (subcategoryName && subcategoryName.trim()) {
      desc = subcategoryName.trim()
    } else if (categoryName && categoryName.trim()) {
      desc = categoryName.trim()
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

  // 1. Extract preliminary category & subcategory to help determine type
  const preliminaryCatMatch = extractCategoryAndSubcategory(normalized, categories, subcategories)

  // 2. Extract Type (receita / despesa)
  const typeResult = extractType(
    normalized,
    preliminaryCatMatch.category,
    preliminaryCatMatch.subcategory,
  )

  // 3. Extract category & subcategory filtered by the detected type (only compatible categories)
  const compatibleCategories = categories.filter((c) =>
    isCategoryAllowedForType(c, typeResult.type),
  )
  const { category, subcategory, categoryMatched, subcategoryMatched } =
    extractCategoryAndSubcategory(normalized, compatibleCategories, subcategories, typeResult.type)

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
    accounts,
    categories,
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
