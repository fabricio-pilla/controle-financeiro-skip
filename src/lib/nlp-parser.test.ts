import {
  parseNaturalLanguageTransaction,
  isCategoryAllowedForType,
  isHybridCategory,
  stripAccents,
} from './nlp-parser'
import type { Account, Category, Subcategory } from '@/types/database'

export function runTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0
  let failed = 0
  const errors: string[] = []

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++
    } else {
      failed++
      errors.push(msg)
      console.error(`[TEST FAIL]: ${msg}`)
    }
  }

  // Fixture accounts matching real app structure (as in Casa control)
  const mockAccounts: Account[] = [
    {
      id: 'acc-santander-credito',
      control_id: 'c1',
      name: 'Santander Fabrício Crédito',
      type: 'credito',
      bank: 'Santander',
      color: '#EF4444',
      balance: 0,
      is_primary: true,
      created_at: '',
    },
    {
      id: 'acc-santander-banco',
      control_id: 'c1',
      name: 'Santander Fabrício',
      type: 'banco',
      bank: 'Santander',
      color: '#EF4444',
      balance: 5000,
      is_primary: false,
      created_at: '',
    },
    {
      id: 'acc-neon-debito',
      control_id: 'c1',
      name: 'Neon Fabrício',
      type: 'banco',
      bank: 'Neon',
      color: '#10B981',
      balance: 1000,
      is_primary: false,
      created_at: '',
    },
    {
      id: 'acc-neon-credito',
      control_id: 'c1',
      name: 'Neon Fabrício Crédito',
      type: 'credito',
      bank: 'Neon',
      color: '#10B981',
      balance: 0,
      is_primary: false,
      created_at: '',
    },
  ]

  // Fixture categories matching real app structure (separate Despesa and Receita categories)
  const mockCategories: Category[] = [
    {
      id: 'cat-despesa-fabricio',
      control_id: 'c1',
      name: 'Despesa Fabrício',
      type: 'despesa',
      color: '#6366F1',
      icon: 'User',
      created_at: '',
    },
    {
      id: 'cat-receita-fabricio',
      control_id: 'c1',
      name: 'Receita Fabrício',
      type: 'receita',
      color: '#6366F1',
      icon: 'TrendingUp',
      created_at: '',
    },
    {
      id: 'cat-despesa-raffaela',
      control_id: 'c1',
      name: 'Despesa Raffaela',
      type: 'despesa',
      color: '#EC4899',
      icon: 'User',
      created_at: '',
    },
    {
      id: 'cat-receita-raffaela',
      control_id: 'c1',
      name: 'Receita Raffaela',
      type: 'receita',
      color: '#EC4899',
      icon: 'TrendingUp',
      created_at: '',
    },
    {
      id: 'cat-familia',
      control_id: 'c1',
      name: 'Família',
      type: 'despesa',
      color: '#06B6D4',
      icon: 'Users',
      created_at: '',
    },
    {
      id: 'cat-moradia',
      control_id: 'c1',
      name: 'Moradia',
      type: 'despesa',
      color: '#EF4444',
      icon: 'Home',
      created_at: '',
    },
    {
      id: 'cat-transporte',
      control_id: 'c1',
      name: 'Transporte',
      type: 'despesa',
      color: '#F59E0B',
      icon: 'Car',
      created_at: '',
    },
  ]

  // Fixture subcategories
  const mockSubcategories: Subcategory[] = [
    {
      id: 'sub-salario-fab',
      category_id: 'cat-receita-fabricio',
      control_id: 'c1',
      name: 'Salário',
      created_at: '',
    },
    {
      id: 'sub-outros-fab',
      category_id: 'cat-receita-fabricio',
      control_id: 'c1',
      name: 'Outros',
      created_at: '',
    },
    {
      id: 'sub-salario-raffa',
      category_id: 'cat-receita-raffaela',
      control_id: 'c1',
      name: 'Salário',
      created_at: '',
    },
    {
      id: 'sub-restaurantes-fam',
      category_id: 'cat-familia',
      control_id: 'c1',
      name: 'Restaurantes / Delivery',
      created_at: '',
    },
    {
      id: 'sub-mercado-fam',
      category_id: 'cat-familia',
      control_id: 'c1',
      name: 'Supermercado',
      created_at: '',
    },
    {
      id: 'sub-gasolina-trans',
      category_id: 'cat-transporte',
      control_id: 'c1',
      name: 'Combustível',
      created_at: '',
    },
    {
      id: 'sub-roupas-fab',
      category_id: 'cat-despesa-fabricio',
      control_id: 'c1',
      name: 'Roupas e Acessórios',
      created_at: '',
    },
  ]

  // Test 1: User's reported case "almoço raffaela 45,0 no credito santander"
  // Should resolve:
  // - type: despesa
  // - amount: 45
  // - account: "Santander Fabrício Crédito"
  // - category: Raffaela
  // - subcategory: if exists (here undefined since Raffaela has no Alimentação subcategory)
  {
    const res = parseNaturalLanguageTransaction(
      'almoço raffaela 45,0 no credito santander',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )

    assert(res.amount === 45, `Test 1: amount should be 45, got ${res.amount}`)
    assert(res.type === 'despesa', `Test 1: type should be despesa, got ${res.type}`)
    assert(
      res.account_id === 'acc-santander-credito',
      `Test 1: account_id should be acc-santander-credito, got ${res.account_id}`,
    )
    assert(
      res.category_id === 'cat-despesa-raffaela',
      `Test 1: category should resolve to Despesa Raffaela, got ${res.category_id}`,
    )
    assert(
      res.description.toLowerCase() === 'almoco' || res.description.toLowerCase() === 'almoço',
      `Test 1: description should be only the product ("Almoço"), got "${res.description}"`,
    )
  }

  // Test 1b: User's reported case when Raffaela DOES have an "Alimentação" subcategory
  {
    const subAlimRaffa: Subcategory = {
      id: 'sub-alim-raffa',
      category_id: 'cat-despesa-raffaela',
      control_id: 'c1',
      name: 'Alimentação',
      created_at: '',
    }
    const res = parseNaturalLanguageTransaction(
      'almoço raffaela 45,0 no credito santander',
      mockAccounts,
      mockCategories,
      [...mockSubcategories, subAlimRaffa],
    )

    assert(res.amount === 45, `Test 1b: amount should be 45, got ${res.amount}`)
    assert(res.type === 'despesa', `Test 1b: type should be despesa, got ${res.type}`)
    assert(
      res.account_id === 'acc-santander-credito',
      `Test 1b: account should be Santander Fabrício Crédito`,
    )
    assert(
      res.category_id === 'cat-despesa-raffaela',
      `Test 1b: category should be Despesa Raffaela`,
    )
    assert(
      res.subcategory_id === 'sub-alim-raffa',
      `Test 1b: subcategory should be Alimentação when it exists, got ${res.subcategory_id}`,
    )
  }

  // Test 2: User's reported case "Fabricio Entrada Salario 8000,00 recorrente"
  // Should resolve:
  // - type: receita
  // - amount: 8000
  // - is_recurring: true
  // - recurrence_type: mensal
  // - category: Receita Fabrício
  // - subcategory: Salário
  {
    const res = parseNaturalLanguageTransaction(
      'Fabricio Entrada Salario 8000,00 recorrente',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.amount === 8000, `Test 2: amount should be 8000, got ${res.amount}`)
    assert(res.type === 'receita', `Test 2: type should be receita, got ${res.type}`)
    assert(res.is_recurring === true, `Test 2: should be recurring`)
    assert(res.recurrence_type === 'mensal', `Test 2: recurrence type should be mensal`)
    assert(
      res.category_id === 'cat-receita-fabricio',
      `Test 2: category should be Receita Fabrício`,
    )
    assert(res.subcategory_id === 'sub-salario-fab', `Test 2: subcategory should be Salário`)
    assert(
      res.description.toLowerCase() === 'salario' || res.description.toLowerCase() === 'salário',
      `Test 2: description should be "Salário", got "${res.description}"`,
    )
  }

  // Test 2b: Preservation of original description without trailing ' 0' when amount has trailing zero
  {
    const resA = parseNaturalLanguageTransaction(
      'Alimentação Viagem 57,70',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(resA.amount === 57.7, `Test 2b amount: got ${resA.amount}`)
    assert(
      !resA.description.endsWith('0'),
      `Test 2b: description should NOT end with '0', got "${resA.description}"`,
    )
    assert(
      resA.description === 'Alimentação Viagem',
      `Test 2b: description should be "Alimentação Viagem", got "${resA.description}"`,
    )

    const resB = parseNaturalLanguageTransaction(
      'Combustivel Viagens 143,80',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(
      resB.description === 'Combustivel Viagens',
      `Test 2b: description should be "Combustivel Viagens", got "${resB.description}"`,
    )
  }

  // Test 3: Phrase without account -> falls back to primary account
  {
    const res = parseNaturalLanguageTransaction(
      'Padaria 25,90',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.amount === 25.9, `Test 3: amount should be 25.9, got ${res.amount}`)
    assert(res.type === 'despesa', `Test 3: type should be despesa, got ${res.type}`)
    assert(
      res.account_id === 'acc-santander-credito',
      `Test 3: should pick primary account (acc-santander-credito), got ${res.account_id}`,
    )
  }

  // Test 4: Comma decimal value and specific debit bank account
  {
    const res = parseNaturalLanguageTransaction(
      'Gasolina 150,50 no debito neon',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.amount === 150.5, `Test 4: amount should be 150.5, got ${res.amount}`)
    assert(res.type === 'despesa', `Test 4: type should be despesa`)
    assert(
      res.account_id === 'acc-neon-debito',
      `Test 4: account should be Neon Fabrício débito, got ${res.account_id}`,
    )
  }

  // Test 5: Only person category in text without consumption words (e.g. "Raffaela 200,00")
  {
    const res = parseNaturalLanguageTransaction(
      'Raffaela 200,00',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.amount === 200, `Test 5: amount should be 200, got ${res.amount}`)
    assert(
      res.category_id === 'cat-despesa-raffaela',
      `Test 5: category should be Despesa Raffaela`,
    )
    assert(
      res.description === 'Despesa Raffaela' || res.description === 'Raffaela',
      `Test 5: description should fallback to category name, got "${res.description}"`,
    )
  }

  // Test 6: Strict categories separation (NO hybrid categories)
  // Despesa categories are only allowed for despesa, Receita only for receita
  {
    const catDespFab = mockCategories.find((c) => c.id === 'cat-despesa-fabricio')!
    const catRecFab = mockCategories.find((c) => c.id === 'cat-receita-fabricio')!
    const catDespRaffa = mockCategories.find((c) => c.id === 'cat-despesa-raffaela')!
    const catRecRaffa = mockCategories.find((c) => c.id === 'cat-receita-raffaela')!
    const catMoradia = mockCategories.find((c) => c.id === 'cat-moradia')!

    assert(!isHybridCategory('Fabrício'), 'Test 6: Fabrício should NOT be hybrid category')
    assert(!isHybridCategory('Raffaela'), 'Test 6: Raffaela should NOT be hybrid category')
    assert(!isHybridCategory('Investimento'), 'Test 6: Investimento should NOT be hybrid category')
    assert(!isHybridCategory('Moradia'), 'Test 6: Moradia should NOT be hybrid category')

    assert(
      isCategoryAllowedForType(catDespFab, 'despesa') &&
        !isCategoryAllowedForType(catDespFab, 'receita'),
      'Test 6: Despesa Fabrício should be allowed ONLY for despesa',
    )
    assert(
      isCategoryAllowedForType(catRecFab, 'receita') &&
        !isCategoryAllowedForType(catRecFab, 'despesa'),
      'Test 6: Receita Fabrício should be allowed ONLY for receita',
    )
    assert(
      isCategoryAllowedForType(catDespRaffa, 'despesa') &&
        !isCategoryAllowedForType(catDespRaffa, 'receita'),
      'Test 6: Despesa Raffaela should be allowed ONLY for despesa',
    )
    assert(
      isCategoryAllowedForType(catRecRaffa, 'receita') &&
        !isCategoryAllowedForType(catRecRaffa, 'despesa'),
      'Test 6: Receita Raffaela should be allowed ONLY for receita',
    )
    assert(
      isCategoryAllowedForType(catMoradia, 'despesa') &&
        !isCategoryAllowedForType(catMoradia, 'receita'),
      'Test 6: Moradia should be allowed ONLY for despesa',
    )
  }

  // Test 8: Exact user example: "tenis fabricio 600 credito em 6x"
  // Should resolve:
  // - type: despesa (forced by 'credito')
  // - category: Despesa Fabrício
  // - subcategory: Roupas e Acessórios (matched via clothing keyword 'tenis')
  // - amount: 600
  // - installments_total: 6
  // - description: Tênis (clean product name)
  {
    const res = parseNaturalLanguageTransaction(
      'tenis fabricio 600 credito em 6x',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.type === 'despesa', `Test 8: type should be despesa, got ${res.type}`)
    assert(res.amount === 600, `Test 8: amount should be 600, got ${res.amount}`)
    assert(
      res.category_id === 'cat-despesa-fabricio',
      `Test 8: category should be Despesa Fabrício, got ${res.category_id}`,
    )
    assert(
      res.subcategory_id === 'sub-roupas-fab',
      `Test 8: subcategory should be Roupas e Acessórios, got ${res.subcategory_id}`,
    )
    assert(
      res.installments_total === 6,
      `Test 8: installments_total should be 6, got ${res.installments_total}`,
    )
    assert(
      stripAccents(res.description.toLowerCase()) === 'tenis',
      `Test 8: description should be product "Tenis", got "${res.description}"`,
    )
  }

  // Test 9: "compra 200 no credito" without category
  // Should resolve:
  // - type: despesa
  // - amount: 200
  // - category_id: undefined (no category mentioned)
  {
    const res = parseNaturalLanguageTransaction(
      'compra 200 no credito',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.type === 'despesa', `Test 9: type should be despesa, got ${res.type}`)
    assert(res.amount === 200, `Test 9: amount should be 200, got ${res.amount}`)
    assert(
      res.category_id === undefined,
      `Test 9: category should be undefined, got ${res.category_id}`,
    )
  }

  // Test 10: "credito" never results in receita even with hybrid or income category
  {
    const res = parseNaturalLanguageTransaction(
      'investimento 500 no credito',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.type === 'despesa', `Test 10: type should be despesa, got ${res.type}`)
    assert(res.amount === 500, `Test 10: amount should be 500, got ${res.amount}`)
  }

  // Test 7: Parser suggests only categories compatible with detected type
  // Despesa test: "Paguei aluguel 1500" should detect Moradia (despesa)
  {
    const res = parseNaturalLanguageTransaction(
      'Paguei aluguel 1500',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.type === 'despesa', 'Test 7: type should be despesa')
    assert(res.category_id === 'cat-moradia', 'Test 7: category should be Moradia')
  }

  // Receita test: A despesa-only category (like Moradia or Transporte) must NOT be suggested when type is receita
  {
    const res = parseNaturalLanguageTransaction(
      'Recebi 5000 de salário',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.type === 'receita', 'Test 7b: type should be receita')
    // Result category should NOT be a despesa-only category
    if (res.category_id) {
      const matchedCat = mockCategories.find((c) => c.id === res.category_id)
      assert(
        matchedCat ? isCategoryAllowedForType(matchedCat, 'receita') : true,
        'Test 7b: category must be allowed for receita',
      )
    }
  }

  // Test 11: Explicit date dd/mm/aaaa, e.g. "11/09/2026"
  // Must result in 2026-09-11 (11 de setembro de 2026)
  {
    const res = parseNaturalLanguageTransaction(
      'Almoço 50 11/09/2026',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(
      res.date === '2026-09-11',
      `Test 11: date should be 2026-09-11 for 11/09/2026, got ${res.date}`,
    )
    assert(res.confidence.date === true, 'Test 11: date confidence should be true')
    assert(res.amount === 50, `Test 11: amount should be 50, got ${res.amount}`)
  }

  // Test 12: Installments > 60 up to 999
  {
    const res = parseNaturalLanguageTransaction(
      'Financiamento 120000 em 120x',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(
      res.installments_total === 120,
      `Test 12: installments_total should be 120, got ${res.installments_total}`,
    )
  }

  {
    const res = parseNaturalLanguageTransaction(
      'Compra imóvel 500000 parcelado em 360 vezes',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(
      res.installments_total === 360,
      `Test 12b: installments_total should be 360, got ${res.installments_total}`,
    )
  }

  // Test 13: Regras PIX
  // "pix recebido" -> receita
  // "recebimento pix" -> receita
  // "recebi pix" -> receita
  // "pix que recebi" -> receita
  // qualquer outro caso com "pix" (ex: "pix 50", "paguei pix", "mandei um pix") -> despesa
  {
    const res1 = parseNaturalLanguageTransaction(
      'pix recebido 150',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(
      res1.type === 'receita',
      `Test 13a: "pix recebido 150" should be receita, got ${res1.type}`,
    )

    const res2 = parseNaturalLanguageTransaction(
      'recebimento pix 200 de vendas',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(
      res2.type === 'receita',
      `Test 13b: "recebimento pix" should be receita, got ${res2.type}`,
    )

    const res3 = parseNaturalLanguageTransaction(
      'recebi pix de 350',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res3.type === 'receita', `Test 13c: "recebi pix" should be receita, got ${res3.type}`)

    const res4 = parseNaturalLanguageTransaction(
      'pix que recebi 500',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(
      res4.type === 'receita',
      `Test 13d: "pix que recebi" should be receita, got ${res4.type}`,
    )

    const res5 = parseNaturalLanguageTransaction(
      'pix 50 almoço',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res5.type === 'despesa', `Test 13e: "pix 50 almoço" should be despesa, got ${res5.type}`)

    const res6 = parseNaturalLanguageTransaction(
      'transferi via pix 100',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(
      res6.type === 'despesa',
      `Test 13f: "transferi via pix 100" should be despesa, got ${res6.type}`,
    )
  }

  return { passed, failed, errors }
}
