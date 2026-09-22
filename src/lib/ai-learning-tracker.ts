import { Transaction, TransactionType } from '@/types/database'
import { skipCloud } from '@/lib/skip-cloud'

export interface ParsedAiNotes {
  orig: string
  cat?: string
  sub?: string
  typ?: TransactionType
  desc?: string
}

/**
 * Extrai os metadados de IA embutidos no campo notes da transação.
 * Exemplo de formato: [IA:{"orig":"netflix 55,90","cat":"abc","sub":"","typ":"despesa","desc":"netflix"}]
 * Também suporta notas simples que contenham apenas a flag "[IA]".
 */
export function extractAiMetadata(notes?: string): ParsedAiNotes | null {
  if (!notes || typeof notes !== 'string') return null
  const trimmed = notes.trim()
  if (!trimmed) return null

  // Formato estruturado [IA:{...}]
  const jsonMatch = trimmed.match(/\[IA:(\{.*?\})\]/)
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1])
      if (data && typeof data.orig === 'string') {
        return {
          orig: data.orig,
          cat: data.cat || undefined,
          sub: data.sub || undefined,
          typ: data.typ || undefined,
          desc: data.desc || undefined,
        }
      }
    } catch {
      // Ignora erro de JSON
    }
  }

  // Se tem apenas a marcação [IA] ou IA
  if (trimmed.includes('[IA]') || trimmed.startsWith('IA:')) {
    return {
      orig: '',
    }
  }

  return null
}

/**
 * Remove a tag técnica [IA:...] das notas caso o usuário queira editar/visualizar notas limpas,
 * ou mantém o formato seguro.
 */
export function cleanNotesForDisplay(notes?: string): string {
  if (!notes) return ''
  return notes.replace(/\[IA:\{.*?\}\]/g, '').trim()
}

/**
 * Compara a transação antes e depois da edição e verifica se houve alteração
 * em categoria, subcategoria, tipo ou descrição.
 */
export function detectAiCorrection(
  originalTx: Transaction,
  updatedData: {
    category_id?: string
    subcategory_id?: string
    type?: TransactionType
    description?: string
  },
): {
  isCorrection: boolean
  hasChanges: boolean
  changes: {
    categoryChanged: boolean
    subcategoryChanged: boolean
    typeChanged: boolean
    descriptionChanged: boolean
  }
} {
  const aiMeta = extractAiMetadata(originalTx.notes)
  const isAiOrigin = Boolean(aiMeta || originalTx.notes?.includes('[IA]'))

  const origCat = originalTx.category_id || ''
  const newCat = updatedData.category_id !== undefined ? updatedData.category_id : origCat

  const origSub = originalTx.subcategory_id || ''
  const newSub = updatedData.subcategory_id !== undefined ? updatedData.subcategory_id : origSub

  const origType = originalTx.type
  const newType = updatedData.type || origType

  const origDesc = (originalTx.description || '').trim()
  const newDesc = (updatedData.description || '').trim()

  const categoryChanged = origCat !== newCat
  const subcategoryChanged = origSub !== newSub
  const typeChanged = origType !== newType
  const descriptionChanged = origDesc !== newDesc

  const hasChanges = categoryChanged || subcategoryChanged || typeChanged || descriptionChanged

  return {
    isCorrection: isAiOrigin && hasChanges,
    hasChanges,
    changes: {
      categoryChanged,
      subcategoryChanged,
      typeChanged,
      descriptionChanged,
    },
  }
}

/**
 * Grava o aprendizado da correção de forma silenciosa e resiliente.
 * Não quebra nem lança erros, não usa console.error.
 */
export async function trackAiCorrectionSilently(
  companyId: string,
  originalTx: Transaction,
  updatedData: {
    category_id?: string
    subcategory_id?: string
    type?: TransactionType
    description?: string
  },
): Promise<void> {
  try {
    const check = detectAiCorrection(originalTx, updatedData)
    if (!check.isCorrection) {
      return
    }

    const aiMeta = extractAiMetadata(originalTx.notes)
    // O texto original enviado à IA: se veio nos metadados, usa ele; senão usa a descrição inicial da tx
    const originalText = (aiMeta?.orig || originalTx.description || '').trim()
    if (!originalText) return

    // O que a IA havia classificado originalmente (dos metadados ou dos campos originais da tx)
    const aiCategoryId = aiMeta?.cat || originalTx.category_id || undefined
    const aiSubcategoryId = aiMeta?.sub || originalTx.subcategory_id || undefined
    const aiType = aiMeta?.typ || originalTx.type
    const aiDescription = aiMeta?.desc || originalTx.description

    // O que o usuário corrigiu
    const correctedCategoryId =
      updatedData.category_id !== undefined ? updatedData.category_id : originalTx.category_id
    const correctedSubcategoryId =
      updatedData.subcategory_id !== undefined
        ? updatedData.subcategory_id
        : originalTx.subcategory_id
    const correctedType = updatedData.type || originalTx.type
    const correctedDescription =
      updatedData.description !== undefined
        ? updatedData.description.trim()
        : originalTx.description

    await skipCloud.saveAiLearning(companyId, {
      original_text: originalText,
      ai_category_id: aiCategoryId,
      ai_subcategory_id: aiSubcategoryId,
      ai_type: aiType,
      ai_description: aiDescription,
      corrected_category_id: correctedCategoryId,
      corrected_subcategory_id: correctedSubcategoryId,
      corrected_type: correctedType,
      corrected_description: correctedDescription,
    })
  } catch {
    // Silencioso conforme requisito: não quebrar nem lançar erro
  }
}
