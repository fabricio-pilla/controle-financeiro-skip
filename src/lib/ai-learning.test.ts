import { describe, it, expect } from 'vitest'
import {
  extractAiMetadata,
  detectAiCorrection,
  cleanNotesForDisplay,
} from '@/lib/ai-learning-tracker'
import {
  extractKeywords,
  calculateLearningSimilarity,
  findRelevantLearnings,
  applyLearningsToClassification,
} from '@/lib/ai-learning-matcher'
import { parseNaturalLanguageTransaction } from '@/lib/nlp-parser'
import { Transaction, Category, Subcategory, Account, AiLearning } from '@/types/database'

describe('AI Learning Detection (ai-learning-tracker)', () => {
  const mockBaseTx: Transaction = {
    id: 'tx-1',
    control_id: 'comp-1',
    user_id: 'u-1',
    description: 'netflix 55,90',
    amount: 55.9,
    type: 'despesa',
    account_id: 'acc-1',
    category_id: 'cat-outros',
    subcategory_id: 'sub-outros',
    date: '2025-05-10',
    payment_date: '2025-05-10',
    paid: true,
    notes:
      '[IA:{"orig":"netflix 55,90","cat":"cat-outros","sub":"sub-outros","typ":"despesa","desc":"netflix"}]',
    created_at: '2025-05-10T10:00:00Z',
  }

  it('deve extrair metadados estruturados da flag IA em notes', () => {
    const meta = extractAiMetadata(mockBaseTx.notes)
    expect(meta).not.toBeNull()
    expect(meta?.orig).toBe('netflix 55,90')
    expect(meta?.cat).toBe('cat-outros')
    expect(meta?.typ).toBe('despesa')
  })

  it('deve limpar tag interna [IA:...] ao exibir notas', () => {
    const clean = cleanNotesForDisplay(mockBaseTx.notes)
    expect(clean).toBe('')
  })

  it('deve registrar correcao quando a categoria muda em lancamento de IA', () => {
    const check = detectAiCorrection(mockBaseTx, {
      category_id: 'cat-lazer',
      subcategory_id: 'sub-streaming',
    })
    expect(check.isCorrection).toBe(true)
    expect(check.changes.categoryChanged).toBe(true)
    expect(check.changes.subcategoryChanged).toBe(true)
  })

  it('deve registrar correcao quando apenas o tipo muda', () => {
    const check = detectAiCorrection(mockBaseTx, {
      type: 'receita',
    })
    expect(check.isCorrection).toBe(true)
    expect(check.changes.typeChanged).toBe(true)
  })

  it('deve registrar correcao quando apenas a descricao muda', () => {
    const check = detectAiCorrection(mockBaseTx, {
      description: 'Assinatura Netflix Premium',
    })
    expect(check.isCorrection).toBe(true)
    expect(check.changes.descriptionChanged).toBe(true)
  })

  it('NAO deve registrar aprendizado quando NADA e alterado na edicao', () => {
    const check = detectAiCorrection(mockBaseTx, {
      category_id: 'cat-outros',
      subcategory_id: 'sub-outros',
      type: 'despesa',
      description: 'netflix 55,90',
    })
    expect(check.isCorrection).toBe(false)
    expect(check.hasChanges).toBe(false)
  })

  it('NAO deve registrar aprendizado para lancamentos manuais sem flag de IA', () => {
    const manualTx: Transaction = {
      ...mockBaseTx,
      notes: 'Lancamento manual pelo teclado',
    }
    const check = detectAiCorrection(manualTx, {
      category_id: 'cat-lazer',
    })
    expect(check.hasChanges).toBe(true)
    expect(check.isCorrection).toBe(false)
  })
})

describe('AI Learning Matching & Similarity (ai-learning-matcher)', () => {
  it('deve extrair palavras-chave removendo stop words e pontuacao', () => {
    const kws = extractKeywords('Compra no mercado com o cartao de credito R$ 150')
    expect(kws).toContain('compra')
    expect(kws).toContain('mercado')
    expect(kws).toContain('cartao')
    expect(kws).toContain('credito')
    expect(kws).not.toContain('no')
    expect(kws).not.toContain('com')
    expect(kws).not.toContain('de')
  })

  it('deve calcular alta similaridade para frases com o mesmo termo principal', () => {
    const sim1 = calculateLearningSimilarity('netflix 55,90', 'netflix')
    expect(sim1).toBeGreaterThanOrEqual(75)

    const simExact = calculateLearningSimilarity('aluguel apartamento', 'aluguel apartamento')
    expect(simExact).toBe(100)

    const simDiff = calculateLearningSimilarity('padaria pao doce', 'combustivel posto shell')
    expect(simDiff).toBeLessThan(20)
  })

  it('deve ranquear e selecionar os aprendizados mais relevantes por similaridade', () => {
    const learnings: AiLearning[] = [
      {
        id: 'l-1',
        control_id: 'c-1',
        user_id: 'u-1',
        original_text: 'netflix mensalidade',
        corrected_category_id: 'cat-lazer',
        created_at: '2025-05-01T10:00:00Z',
      },
      {
        id: 'l-2',
        control_id: 'c-1',
        user_id: 'u-1',
        original_text: 'combustivel shell',
        corrected_category_id: 'cat-transporte',
        created_at: '2025-05-02T10:00:00Z',
      },
      {
        id: 'l-3',
        control_id: 'c-1',
        user_id: 'u-1',
        original_text: 'netflix premium 4k',
        corrected_category_id: 'cat-lazer',
        created_at: '2025-05-03T10:00:00Z',
      },
    ]

    const matches = findRelevantLearnings('netflix 55,90', learnings, 2)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches[0].learning.original_text).toContain('netflix')
    expect(matches.every((m) => m.learning.id !== 'l-2')).toBe(true)
  })

  it('deve priorizar a categoria e subcategoria aprendida na classificacao', () => {
    const categories: Category[] = [
      {
        id: 'cat-moradia',
        control_id: 'c-1',
        name: 'Moradia',
        type: 'despesa',
        color: '#000',
        icon: 'home',
        created_at: '',
      },
      {
        id: 'cat-lazer',
        control_id: 'c-1',
        name: 'Lazer',
        type: 'despesa',
        color: '#000',
        icon: 'tv',
        created_at: '',
      },
    ]
    const subcategories: Subcategory[] = [
      {
        id: 'sub-stream',
        control_id: 'c-1',
        category_id: 'cat-lazer',
        name: 'Streaming',
        icon: 'tv',
        created_at: '',
      },
    ]

    const learnings: AiLearning[] = [
      {
        id: 'l-netflix',
        control_id: 'c-1',
        user_id: 'u-1',
        original_text: 'netflix',
        corrected_category_id: 'cat-lazer',
        corrected_subcategory_id: 'sub-stream',
        corrected_type: 'despesa',
        created_at: '2025-05-01T10:00:00Z',
      },
    ]

    const result = applyLearningsToClassification(
      'netflix 55,90',
      learnings,
      categories,
      subcategories,
    )
    expect(result.categoryId).toBe('cat-lazer')
    expect(result.subcategoryId).toBe('sub-stream')
    expect(result.type).toBe('despesa')
  })
})

describe('End-to-end NLP parser with AI Learning', () => {
  const accounts: Account[] = [
    {
      id: 'acc-1',
      control_id: 'c-1',
      name: 'Conta Principal',
      type: 'banco',
      balance: 1000,
      color: '#000',
      is_primary: true,
      created_at: '',
    },
  ]
  const categories: Category[] = [
    {
      id: 'cat-alimentacao',
      control_id: 'c-1',
      name: 'Alimentacao',
      type: 'despesa',
      color: '#000',
      icon: 'utensils',
      created_at: '',
    },
    {
      id: 'cat-lazer',
      control_id: 'c-1',
      name: 'Lazer',
      type: 'despesa',
      color: '#000',
      icon: 'film',
      created_at: '',
    },
  ]
  const subcategories: Subcategory[] = [
    {
      id: 'sub-assinaturas',
      control_id: 'c-1',
      category_id: 'cat-lazer',
      name: 'Assinaturas',
      icon: 'tag',
      created_at: '',
    },
  ]

  it('deve usar o historico de aprendizado do usuario para classificar netflix 55,90 como Lazer / Assinaturas', () => {
    const learnings: AiLearning[] = [
      {
        id: 'l-net',
        control_id: 'c-1',
        user_id: 'u-1',
        original_text: 'netflix',
        corrected_category_id: 'cat-lazer',
        corrected_subcategory_id: 'sub-assinaturas',
        corrected_type: 'despesa',
        created_at: '2025-05-01T10:00:00Z',
      },
    ]

    const parsed = parseNaturalLanguageTransaction(
      'netflix 55,90',
      accounts,
      categories,
      subcategories,
      learnings,
    )

    expect(parsed.amount).toBe(55.9)
    expect(parsed.type).toBe('despesa')
    expect(parsed.category_id).toBe('cat-lazer')
    expect(parsed.subcategory_id).toBe('sub-assinaturas')
    expect(parsed.confidence.category).toBe(true)
    expect(parsed.confidence.subcategory).toBe(true)
  })
})
