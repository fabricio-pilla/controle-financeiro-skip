import { describe, it, expect } from 'vitest'
import {
  detectIsIncome,
  matchImportCategoryAndSubcategory,
  normalizeText,
} from './import-category-matcher'
import { Category, Subcategory } from '@/types/database'

const mockCategories: Category[] = [
  {
    id: 'cat_desp_fab',
    control_id: 'ctrl1',
    name: 'Despesa Fabrício',
    type: 'despesa',
    color: '#6366F1',
    icon: 'User',
    is_default: true,
    created_at: '2026-01-01',
  },
  {
    id: 'cat_rec_fab',
    control_id: 'ctrl1',
    name: 'Receita Fabrício',
    type: 'receita',
    color: '#6366F1',
    icon: 'TrendingUp',
    is_default: true,
    created_at: '2026-01-01',
  },
  {
    id: 'cat_desp_raff',
    control_id: 'ctrl1',
    name: 'Despesa Raffaela',
    type: 'despesa',
    color: '#EC4899',
    icon: 'User',
    is_default: true,
    created_at: '2026-01-01',
  },
  {
    id: 'cat_rec_raff',
    control_id: 'ctrl1',
    name: 'Receita Raffaela',
    type: 'receita',
    color: '#EC4899',
    icon: 'TrendingUp',
    is_default: true,
    created_at: '2026-01-01',
  },
  {
    id: 'cat_invest',
    control_id: 'ctrl1',
    name: 'Investimento',
    type: 'receita',
    color: '#8B5CF6',
    icon: 'TrendingUp',
    is_default: true,
    created_at: '2026-01-01',
  },
  {
    id: 'cat_transp',
    control_id: 'ctrl1',
    name: 'Transporte',
    type: 'despesa',
    color: '#F59E0B',
    icon: 'Car',
    is_default: true,
    created_at: '2026-01-01',
  },
  {
    id: 'cat_moradia',
    control_id: 'ctrl1',
    name: 'Moradia',
    type: 'despesa',
    color: '#EF4444',
    icon: 'Home',
    is_default: true,
    created_at: '2026-01-01',
  },
  {
    id: 'cat_familia',
    control_id: 'ctrl1',
    name: 'Família',
    type: 'despesa',
    color: '#06B6D4',
    icon: 'Users',
    is_default: true,
    created_at: '2026-01-01',
  },
]

const mockSubcategories: Subcategory[] = [
  // Receita Fabrício
  {
    id: 'sub_rec_fab_sal',
    control_id: 'ctrl1',
    category_id: 'cat_rec_fab',
    name: 'Salário',
    created_at: '2026-01-01',
  },
  {
    id: 'sub_rec_fab_plr',
    control_id: 'ctrl1',
    category_id: 'cat_rec_fab',
    name: 'PLR',
    created_at: '2026-01-01',
  },
  {
    id: 'sub_rec_fab_outros',
    control_id: 'ctrl1',
    category_id: 'cat_rec_fab',
    name: 'Outros',
    created_at: '2026-01-01',
  },
  // Despesa Fabrício
  {
    id: 'sub_desp_fab_alim',
    control_id: 'ctrl1',
    category_id: 'cat_desp_fab',
    name: 'Alimentação',
    created_at: '2026-01-01',
  },
  {
    id: 'sub_desp_fab_div',
    control_id: 'ctrl1',
    category_id: 'cat_desp_fab',
    name: 'Diversos',
    created_at: '2026-01-01',
  },
  // Receita Raffaela
  {
    id: 'sub_rec_raff_sal',
    control_id: 'ctrl1',
    category_id: 'cat_rec_raff',
    name: 'Salário',
    created_at: '2026-01-01',
  },
  {
    id: 'sub_rec_raff_corr',
    control_id: 'ctrl1',
    category_id: 'cat_rec_raff',
    name: 'Corretagem',
    created_at: '2026-01-01',
  },
  // Despesa Raffaela
  {
    id: 'sub_desp_raff_alim',
    control_id: 'ctrl1',
    category_id: 'cat_desp_raff',
    name: 'Alimentação',
    created_at: '2026-01-01',
  },
  // Transporte
  {
    id: 'sub_combustivel',
    control_id: 'ctrl1',
    category_id: 'cat_transp',
    name: 'Combustível',
    created_at: '2026-01-01',
  },
  // Moradia
  {
    id: 'sub_luz',
    control_id: 'ctrl1',
    category_id: 'cat_moradia',
    name: 'Luz',
    created_at: '2026-01-01',
  },
]

describe('import-category-matcher', () => {
  it('detecta receita via coluna Tipo (Receita / Entrada)', () => {
    expect(detectIsIncome('Receita', '', '')).toBe(true)
    expect(detectIsIncome('Entrada', '', '')).toBe(true)
    expect(detectIsIncome('Despesa', '', '')).toBe(false)
    expect(detectIsIncome('Saída', '', '')).toBe(false)
  })

  it('detecta receita via descrição ou subcategoria quando Tipo está ausente', () => {
    expect(detectIsIncome('', 'Salário adiantamento', '')).toBe(true)
    expect(detectIsIncome('', 'Pagamento de conta de luz', 'Salário')).toBe(true)
    expect(detectIsIncome('', 'Supermercado Mensal', 'Alimentação')).toBe(false)
  })

  it('requisito: linha "Entrada / Fabrício / Salário" deve gerar "Receita Fabrício" + "Salário"', () => {
    const res = matchImportCategoryAndSubcategory({
      rawType: 'Entrada',
      rawBudgetCol: 'Fabrício',
      rawCategoryCol: 'Salário',
      rawDescription: 'Salário Mensal',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })

    expect(res.type).toBe('receita')
    expect(res.categoryName).toBe('Receita Fabrício')
    expect(res.categoryId).toBe('cat_rec_fab')
    expect(res.subcategoryName).toBe('Salário')
    expect(res.subcategoryId).toBe('sub_rec_fab_sal')
  })

  it('requisito: linha "Saída / Fabrício / Alimentação" deve gerar "Despesa Fabrício" + "Alimentação"', () => {
    const res = matchImportCategoryAndSubcategory({
      rawType: 'Saída',
      rawBudgetCol: 'Fabrício',
      rawCategoryCol: 'Alimentação',
      rawDescription: 'Restaurante',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })

    expect(res.type).toBe('despesa')
    expect(res.categoryName).toBe('Despesa Fabrício')
    expect(res.categoryId).toBe('cat_desp_fab')
    expect(res.subcategoryName).toBe('Alimentação')
    expect(res.subcategoryId).toBe('sub_desp_fab_alim')
  })

  it('não permite que linha de receita caia em categoria de despesa mesmo se a planilha tiver texto "Despesa Fabrício"', () => {
    const res = matchImportCategoryAndSubcategory({
      rawType: 'Receita',
      rawCategoryCol: 'Despesa Fabrício',
      rawDescription: 'Recebimento de vendas',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })

    expect(res.type).toBe('receita')
    expect(res.categoryName).toBe('Receita Fabrício')
    expect(res.categoryId).toBe('cat_rec_fab')
  })

  it('não permite que linha de despesa caia em categoria de receita mesmo se a planilha tiver texto "Receita Fabrício"', () => {
    const res = matchImportCategoryAndSubcategory({
      rawType: 'Despesa',
      rawCategoryCol: 'Receita Fabrício',
      rawDescription: 'Compra farmácia',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })

    expect(res.type).toBe('despesa')
    expect(res.categoryName).toBe('Despesa Fabrício')
    expect(res.categoryId).toBe('cat_desp_fab')
  })

  it('linha Raffaela: Entrada Raffaela mapeia para Receita Raffaela e Saída para Despesa Raffaela', () => {
    const recRaffa = matchImportCategoryAndSubcategory({
      rawType: 'Receita',
      rawBudgetCol: 'Raffaela',
      rawCategoryCol: 'Corretagem',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })
    expect(recRaffa.type).toBe('receita')
    expect(recRaffa.categoryName).toBe('Receita Raffaela')
    expect(recRaffa.categoryId).toBe('cat_rec_raff')
    expect(recRaffa.subcategoryName).toBe('Corretagem')
    expect(recRaffa.subcategoryId).toBe('sub_rec_raff_corr')

    const despRaffa = matchImportCategoryAndSubcategory({
      rawType: 'Despesa',
      rawBudgetCol: 'Raffaela',
      rawCategoryCol: 'Alimentação',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })
    expect(despRaffa.type).toBe('despesa')
    expect(despRaffa.categoryName).toBe('Despesa Raffaela')
    expect(despRaffa.categoryId).toBe('cat_desp_raff')
  })

  it('fallback de categoria sem correspondência respeita o tipo da linha', () => {
    const unknownIncome = matchImportCategoryAndSubcategory({
      rawType: 'Receita',
      rawCategoryCol: 'AlgoTotalmenteDesconhecidoXYZ',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })
    expect(unknownIncome.type).toBe('receita')
    expect(unknownIncome.categoryName).toBe('Receita Fabrício')

    const unknownExpense = matchImportCategoryAndSubcategory({
      rawType: 'Despesa',
      rawCategoryCol: 'AlgoTotalmenteDesconhecidoXYZ',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })
    expect(unknownExpense.type).toBe('despesa')
    expect(unknownExpense.categoryName).toBe('Despesa Fabrício')
  })

  it('quando subcategoria existe em receita e despesa (ex: Salário), associa à categoria do tipo da linha', () => {
    const res = matchImportCategoryAndSubcategory({
      rawType: 'Receita',
      rawCategoryCol: 'Salário',
      categories: mockCategories,
      subcategories: mockSubcategories,
    })
    expect(res.type).toBe('receita')
    expect(res.categoryId).toBe('cat_rec_fab')
    expect(res.subcategoryId).toBe('sub_rec_fab_sal')
  })
})
