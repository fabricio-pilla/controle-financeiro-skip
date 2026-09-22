import { AiLearning, Category, Subcategory, TransactionType } from '@/types/database'
import { stripAccents } from '@/lib/nlp-parser'

export interface LearningMatchResult {
  learning: AiLearning
  score: number
  matchedTokens: string[]
}

const STOP_WORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'no',
  'na',
  'nos',
  'nas',
  'em',
  'por',
  'para',
  'pra',
  'com',
  'sem',
  'um',
  'uma',
  'uns',
  'umas',
  'o',
  'a',
  'os',
  'as',
  'e',
  'ou',
  'que',
  'se',
  'foi',
  'reais',
  'real',
  'r$',
  'rs',
  'x',
  'vezes',
])

/**
 * Normaliza e tokeniza um texto extraindo palavras significativas (sem acentos, minúsculas, > 1 letra).
 */
export function extractKeywords(text: string): string[] {
  if (!text) return []
  const clean = stripAccents(text.toLowerCase())
    .replace(/[^\w\s]/g, ' ')
    .trim()
  const tokens = clean.split(/\s+/).filter((tok) => tok.length > 1 && !STOP_WORDS.has(tok))
  return Array.from(new Set(tokens))
}

/**
 * Calcula a similaridade entre o texto de entrada e o texto original gravado no aprendizado.
 * Retorna pontuação entre 0 e 100.
 */
export function calculateLearningSimilarity(inputText: string, originalText: string): number {
  const inputNorm = stripAccents(inputText.toLowerCase()).trim()
  const origNorm = stripAccents(originalText.toLowerCase()).trim()

  if (!inputNorm || !origNorm) return 0
  if (inputNorm === origNorm) return 100

  // Se um contém o outro exatamente
  if (inputNorm.includes(origNorm) || origNorm.includes(inputNorm)) {
    const minLen = Math.min(inputNorm.length, origNorm.length)
    const maxLen = Math.max(inputNorm.length, origNorm.length)
    return Math.round(75 + (minLen / maxLen) * 20)
  }

  const inputKeywords = extractKeywords(inputText)
  const origKeywords = extractKeywords(originalText)

  if (inputKeywords.length === 0 || origKeywords.length === 0) return 0

  let matches = 0
  for (const kw of origKeywords) {
    if (inputKeywords.includes(kw)) {
      matches += 1
    } else if (inputKeywords.some((ik) => ik.startsWith(kw) || kw.startsWith(ik))) {
      matches += 0.75
    }
  }

  // Jaccard ponderado
  const allUnique = new Set([...inputKeywords, ...origKeywords]).size
  const similarity = (matches / allUnique) * 100

  return Math.round(similarity)
}

/**
 * Filtra e ranqueia os aprendizados mais relevantes para um dado texto.
 * Limita aos N mais relevantes (padrão: 10) que atinjam o limiar mínimo de similaridade.
 */
export function findRelevantLearnings(
  inputText: string,
  learnings: AiLearning[],
  limit = 10,
  minScore = 25,
): LearningMatchResult[] {
  if (!inputText.trim() || !learnings || learnings.length === 0) return []

  const scored: LearningMatchResult[] = []

  for (const item of learnings) {
    const score = calculateLearningSimilarity(inputText, item.original_text)
    if (score >= minScore) {
      const origKeywords = extractKeywords(item.original_text)
      const inputKeywords = extractKeywords(inputText)
      const matchedTokens = origKeywords.filter((kw) =>
        inputKeywords.some((ik) => ik === kw || ik.startsWith(kw) || kw.startsWith(ik)),
      )
      scored.push({
        learning: item,
        score,
        matchedTokens,
      })
    }
  }

  // Ordena por score decrescente e recência
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return new Date(b.learning.created_at).getTime() - new Date(a.learning.created_at).getTime()
  })

  return scored.slice(0, limit)
}

/**
 * Aplica o aprendizado mais relevante sobre a classificação se houver correspondência forte.
 * Se o melhor aprendizado tiver alta similaridade (>= 50), prioriza a categoria/subcategoria/tipo
 * corrigidos pelo usuário sobre as regras genéricas.
 */
export function applyLearningsToClassification(
  text: string,
  learnings: AiLearning[],
  categories: Category[],
  subcategories: Subcategory[],
): {
  matchedLearning?: AiLearning
  categoryId?: string
  subcategoryId?: string
  type?: TransactionType
  description?: string
  confidenceScore: number
} {
  const relevant = findRelevantLearnings(text, learnings, 5, 40)
  if (relevant.length === 0) {
    return { confidenceScore: 0 }
  }

  const best = relevant[0]
  const l = best.learning

  // Validar se a categoria corrigida existe na lista atual
  const catObj = l.corrected_category_id
    ? categories.find((c) => c.id === l.corrected_category_id)
    : undefined

  // Validar subcategoria
  const subObj = l.corrected_subcategory_id
    ? subcategories.find((s) => s.id === l.corrected_subcategory_id)
    : undefined

  return {
    matchedLearning: l,
    categoryId: catObj?.id || l.corrected_category_id,
    subcategoryId: subObj?.id || l.corrected_subcategory_id,
    type: l.corrected_type,
    description: l.corrected_description,
    confidenceScore: best.score,
  }
}
