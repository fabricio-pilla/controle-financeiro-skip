import { parseNaturalLanguageTransaction } from './nlp-parser'
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

  // Fixture accounts matching real app structure
  const mockAccounts: Account[] = [
    {
      id: 'acc-santander-credito',
      control_id: 'c1',
      name: 'Santander Fabrício Crédito',
      type: 'credito',
      bank: 'Santander',
      color: '#EC0000',
      balance: 0,
      is_primary: false,
      created_at: '',
    },
    {
      id: 'acc-neon-debito',
      control_id: 'c1',
      name: 'Neon Fabrício Débito',
      type: 'banco',
      bank: 'Neon',
      color: '#00E5FF',
      balance: 1000,
      is_primary: true,
      created_at: '',
    },
  ]

  // Fixture categories
  const mockCategories: Category[] = [
    {
      id: 'cat-familia',
      control_id: 'c1',
      name: 'Família',
      type: 'despesa',
      color: '#EC4899',
      icon: 'users',
      created_at: '',
    },
    {
      id: 'cat-raffaela',
      control_id: 'c1',
      name: 'Raffaela',
      type: 'receita',
      color: '#8B5CF6',
      icon: 'user',
      created_at: '',
    },
    {
      id: 'cat-fabricio',
      control_id: 'c1',
      name: 'Fabrício',
      type: 'receita',
      color: '#3B82F6',
      icon: 'user',
      created_at: '',
    },
  ]

  // Fixture subcategories
  const mockSubcategories: Subcategory[] = [
    {
      id: 'sub-restaurantes',
      category_id: 'cat-familia',
      control_id: 'c1',
      name: 'Restaurantes / Delivery',
      color: '#EC4899',
      created_at: '',
    },
    {
      id: 'sub-alimentacao-raffa',
      category_id: 'cat-raffaela',
      control_id: 'c1',
      name: 'Alimentação',
      color: '#8B5CF6',
      created_at: '',
    },
    {
      id: 'sub-salario-fab',
      category_id: 'cat-fabricio',
      control_id: 'c1',
      name: 'Salário',
      color: '#3B82F6',
      created_at: '',
    },
  ]

  // Test 1: User's reported case "almoço raffaela 45,0 no credito santander"
  {
    const res = parseNaturalLanguageTransaction(
      'almoço raffaela 45,0 no credito santander',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )

    assert(res.amount === 45, `amount should be 45, got ${res.amount}`)
    assert(res.type === 'despesa', `type should be despesa, got ${res.type}`)
    assert(
      res.account_id === 'acc-santander-credito',
      `account_id should be acc-santander-credito, got ${res.account_id}`,
    )
    assert(
      res.category_id === 'cat-raffaela' || res.category_id === 'cat-familia',
      `category should resolve to Raffaela or Família, got ${res.category_id}`,
    )
    assert(
      res.subcategory_id === 'sub-alimentacao-raffa' || res.subcategory_id === 'sub-restaurantes',
      `subcategory should resolve to an eating out/food subcategory, got ${res.subcategory_id}`,
    )
  }

  // Test 2: Case with no account specified -> falls back to primary account
  {
    const res = parseNaturalLanguageTransaction(
      'Padaria 25,90',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.amount === 25.9, `amount should be 25.9, got ${res.amount}`)
    assert(res.type === 'despesa', `type should be despesa, got ${res.type}`)
    assert(
      res.account_id === 'acc-neon-debito',
      `should pick primary account when none specified, got ${res.account_id}`,
    )
  }

  // Test 3: Income with recurrence
  {
    const res = parseNaturalLanguageTransaction(
      'Fabricio Entrada Salario 8000,00 recorrente',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.amount === 8000, `amount should be 8000, got ${res.amount}`)
    assert(res.type === 'receita', `type should be receita, got ${res.type}`)
    assert(res.is_recurring === true, `should be recurring`)
    assert(res.recurrence_type === 'mensal', `recurrence type should be mensal`)
    assert(res.category_id === 'cat-fabricio', `category should be Fabricio`)
    assert(res.subcategory_id === 'sub-salario-fab', `subcategory should be Salario`)
  }

  // Test 4: Comma decimal value
  {
    const res = parseNaturalLanguageTransaction(
      'Gasolina 150,50 no debito neon',
      mockAccounts,
      mockCategories,
      mockSubcategories,
    )
    assert(res.amount === 150.5, `amount should be 150.5, got ${res.amount}`)
    assert(res.type === 'despesa', `type should be despesa`)
    assert(res.account_id === 'acc-neon-debito', `account should be neon debito`)
  }

  return { passed, failed, errors }
}
