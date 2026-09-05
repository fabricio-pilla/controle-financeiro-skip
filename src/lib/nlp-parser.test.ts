import {
  parseNaturalLanguageTransaction,
  isCategoryAllowedForType,
  isHybridCategory,
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

  // Fixture categories matching real app structure
  const mockCategories: Category[] = [
    {
      id: 'cat-fabricio',
      control_id: 'c1',
      name: 'Fabrício',
      type: 'receita',
      color: '#6366F1',
      icon: 'User',
      created_at: '',
    },
    {
      id: 'cat-raffaela',
      control_id: 'c1',
      name: 'Raffaela',
      type: 'receita',
      color: '#EC4899',
      icon: 'User',
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
      category_id: 'cat-fabricio',
      control_id: 'c1',
      name: 'Salário',
      created_at: '',
    },
    {
      id: 'sub-outros-fab',
      category_id: 'cat-fabricio',
      control_id: 'c1',
      name: 'Outros',
      created_at: '',
    },
    {
      id: 'sub-salario-raffa',
      category_id: 'cat-raffaela',
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
      res.category_id === 'cat-raffaela',
      `Test 1: category should resolve to Raffaela, got ${res.category_id}`,
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
      category_id: 'cat-raffaela',
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
    assert(res.category_id === 'cat-raffaela', `Test 1b: category should be Raffaela`)
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
  // - category: Fabrício
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
    assert(res.category_id === 'cat-fabricio', `Test 2: category should be Fabrício`)
    assert(res.subcategory_id === 'sub-salario-fab', `Test 2: subcategory should be Salário`)
    assert(
      res.description.toLowerCase() === 'salario' || res.description.toLowerCase() === 'salário',
      `Test 2: description should be "Salário", got "${res.description}"`,
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
    assert(res.category_id === 'cat-raffaela', `Test 5: category should be Raffaela`)
    assert(
      res.description === 'Raffaela',
      `Test 5: description should fallback to category Raffaela, got "${res.description}"`,
    )
  }

  // Test 6: Hybrid categories validation
  // Fabrício, Raffaela and Investimento are available for BOTH 'receita' and 'despesa'
  // Regular categories like Moradia, Pets, etc. only for 'despesa'
  {
    const catFab = mockCategories.find((c) => c.id === 'cat-fabricio')!
    const catRaffa = mockCategories.find((c) => c.id === 'cat-raffaela')!
    const catMoradia = mockCategories.find((c) => c.id === 'cat-moradia')!
    const catInvestimento: Category = {
      id: 'cat-investimento',
      control_id: 'c1',
      name: 'Investimento',
      type: 'receita',
      color: '#8B5CF6',
      icon: 'TrendingUp',
      created_at: '',
    }

    assert(isHybridCategory('Fabrício'), 'Test 6: Fabrício should be hybrid category')
    assert(isHybridCategory('Raffaela'), 'Test 6: Raffaela should be hybrid category')
    assert(isHybridCategory('Investimento'), 'Test 6: Investimento should be hybrid category')
    assert(!isHybridCategory('Moradia'), 'Test 6: Moradia should NOT be hybrid category')

    assert(
      isCategoryAllowedForType(catFab, 'receita') && isCategoryAllowedForType(catFab, 'despesa'),
      'Test 6: Fabrício should be allowed for both receita and despesa',
    )
    assert(
      isCategoryAllowedForType(catRaffa, 'receita') &&
        isCategoryAllowedForType(catRaffa, 'despesa'),
      'Test 6: Raffaela should be allowed for both receita and despesa',
    )
    assert(
      isCategoryAllowedForType(catInvestimento, 'receita') &&
        isCategoryAllowedForType(catInvestimento, 'despesa'),
      'Test 6: Investimento should be allowed for both receita and despesa',
    )
    assert(
      isCategoryAllowedForType(catMoradia, 'despesa'),
      'Test 6: Moradia should be allowed for despesa',
    )
    assert(
      !isCategoryAllowedForType(catMoradia, 'receita'),
      'Test 6: Moradia should NOT be allowed for receita',
    )
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

  return { passed, failed, errors }
}
