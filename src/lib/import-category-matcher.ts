import { Category, Subcategory } from '@/types/database'

export interface CategorySubcategoryImportResult {
  categoryName: string
  categoryId?: string
  subcategoryName: string
  subcategoryId?: string
  type: 'receita' | 'despesa'
}

/**
 * Normaliza strings para comparação (minúsculas, sem acentos, sem espaços extras).
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Detecta se o lançamento informado representa uma receita com base na coluna tipo,
 * descrição ou valor da categoria/subcategoria.
 */
export function detectIsIncome(
  rawType?: string,
  rawDescription?: string,
  rawCategoryCol?: string,
): boolean {
  const normType = normalizeText(rawType || '')
  const normDesc = normalizeText(rawDescription || '')
  const normSub = normalizeText(rawCategoryCol || '')

  // Se o tipo foi explicitamente declarado:
  if (
    normType === 'receita' ||
    normType === 'entrada' ||
    normType === 'c' ||
    normType === 'credito' ||
    normType === 'income'
  ) {
    return true
  }

  if (
    normType === 'despesa' ||
    normType === 'saida' ||
    normType === 'd' ||
    normType === 'debito' ||
    normType === 'expense'
  ) {
    return false
  }

  // Palavras-chave inequívocas de receita
  const incomeKeywords = [
    'salario',
    'holerite',
    'plr',
    'pro-labore',
    'prolabore',
    'comissao',
    'corretagem',
    'rendimento',
    'vendas',
    'restituicao',
    'irpf',
    'dividendo',
  ]

  for (const kw of incomeKeywords) {
    if (normDesc.includes(kw) || normSub.includes(kw)) {
      return true
    }
  }

  return false
}

/**
 * Mapeador central de categoria e subcategoria para importação de planilhas.
 * Garante estritamente que:
 * 1. O tipo da categoria resultante casa 100% com o tipo da linha (receita vs despesa).
 * 2. As categorias por pessoa ("Receita Fabrício" vs "Despesa Fabrício", "Receita Raffaela" vs "Despesa Raffaela")
 *    NUNCA se misturam.
 * 3. O fallback sempre pertence ao tipo correto da linha.
 * 4. A subcategoria resultante é vinculada à categoria correta.
 */
export function matchImportCategoryAndSubcategory(params: {
  rawCategoryCol?: string
  rawDescription?: string
  rawType?: string
  rawBudgetCol?: string
  categories: Category[]
  subcategories: Subcategory[]
}): CategorySubcategoryImportResult {
  const {
    rawCategoryCol = '',
    rawDescription = '',
    rawType = '',
    rawBudgetCol = '',
    categories,
    subcategories,
  } = params

  const isIncome = detectIsIncome(rawType, rawDescription, rawCategoryCol)
  const lineType: 'receita' | 'despesa' = isIncome ? 'receita' : 'despesa'

  // Filtrar categorias estritamente do tipo da linha
  const allowedCategories = categories.filter((c) => c.type === lineType)

  const normCategory = normalizeText(rawCategoryCol)
  const normBudget = normalizeText(rawBudgetCol)
  const normDesc = normalizeText(rawDescription)
  const cleanSubName = rawCategoryCol.trim()

  // Helper para buscar categoria por nome exato entre as permitidas
  const findExactCategory = (targetName: string): Category | undefined => {
    const normTarget = normalizeText(targetName)
    return allowedCategories.find((c) => normalizeText(c.name) === normTarget)
  }

  // Helper para buscar categoria por prefixo/inclusão segura entre as permitidas
  const findLooseCategory = (targetToken: string): Category | undefined => {
    const normTarget = normalizeText(targetToken)
    return allowedCategories.find((c) => {
      const cNorm = normalizeText(c.name)
      return cNorm === normTarget || cNorm.includes(normTarget) || normTarget.includes(cNorm)
    })
  }

  let matchedCategory: Category | undefined
  let candidateSubcategoryName = cleanSubName

  // 1. Identificar menção a pessoa ou orçamento na coluna Orçamento ou Categoria
  const hasFabricio =
    normBudget.includes('fabricio') ||
    normCategory === 'fabricio' ||
    normCategory.includes('receita fabricio') ||
    normCategory.includes('despesa fabricio')

  const hasRaffaela =
    normBudget.includes('raffaela') ||
    normCategory === 'raffaela' ||
    normCategory.includes('receita raffaela') ||
    normCategory.includes('despesa raffaela')

  const hasInvestimento =
    normBudget.includes('investimento') ||
    normCategory === 'investimento' ||
    normCategory.includes('investimento')

  if (lineType === 'receita') {
    // Linha de RECEITA
    if (hasFabricio) {
      matchedCategory =
        findExactCategory('Receita Fabrício') ||
        allowedCategories.find((c) => normalizeText(c.name).includes('fabricio'))
    } else if (hasRaffaela) {
      matchedCategory =
        findExactCategory('Receita Raffaela') ||
        allowedCategories.find((c) => normalizeText(c.name).includes('raffaela'))
    } else if (hasInvestimento) {
      matchedCategory =
        findExactCategory('Investimento') ||
        allowedCategories.find((c) => normalizeText(c.name).includes('investimento'))
    }

    // Se ainda não achou categoria pelo orçamento/nome explícito, tentar casar pelo nome de subcategoria
    // de cada categoria de receita (ex: "Salário", "IRPF", "PLR", "Corretagem", "Vendas", "Outros")
    if (!matchedCategory && cleanSubName) {
      // Buscar subcategoria nas categorias de receita
      const candidateSubs = subcategories.filter((s) => {
        const parentCat = categories.find((c) => c.id === s.category_id)
        return parentCat && parentCat.type === 'receita'
      })

      const exactSub = candidateSubs.find((s) => normalizeText(s.name) === normCategory)
      if (exactSub) {
        matchedCategory = allowedCategories.find((c) => c.id === exactSub.category_id)
        candidateSubcategoryName = exactSub.name
      }
    }

    // Se ainda não casou, tentar bater diretamente o nome da categoria na planilha com uma das categorias de receita
    if (!matchedCategory && normCategory) {
      matchedCategory = allowedCategories.find((c) => {
        const cNorm = normalizeText(c.name)
        return cNorm === normCategory || cNorm.includes(normCategory)
      })
    }

    // Fallback para receita: preferir "Receita Fabrício" se existir, ou a primeira categoria de receita
    if (!matchedCategory) {
      matchedCategory = findExactCategory('Receita Fabrício') || allowedCategories[0]
    }
  } else {
    // Linha de DESPESA
    if (hasFabricio) {
      matchedCategory =
        findExactCategory('Despesa Fabrício') ||
        allowedCategories.find((c) => normalizeText(c.name).includes('fabricio'))
    } else if (hasRaffaela) {
      matchedCategory =
        findExactCategory('Despesa Raffaela') ||
        allowedCategories.find((c) => normalizeText(c.name).includes('raffaela'))
    } else if (
      normBudget.includes('animais') ||
      normBudget.includes('pet') ||
      normCategory === 'pets' ||
      normCategory.includes('animais de estimacao')
    ) {
      matchedCategory = findExactCategory('Pets')
    } else if (
      normBudget.includes('automovel') ||
      normBudget.includes('carro') ||
      normBudget.includes('transporte') ||
      normCategory === 'transporte' ||
      normCategory.includes('automovel')
    ) {
      matchedCategory = findExactCategory('Transporte')
    } else if (
      normBudget.includes('casa') ||
      normBudget.includes('moradia') ||
      normCategory === 'moradia' ||
      normCategory === 'casa'
    ) {
      matchedCategory = findExactCategory('Moradia')
    } else if (normBudget.includes('emanuel') || normCategory === 'emanuel') {
      matchedCategory = findExactCategory('Emanuel')
    } else if (normBudget.includes('helena') || normCategory === 'helena') {
      matchedCategory = findExactCategory('Helena')
    } else if (normBudget.includes('matheus') || normCategory === 'matheus') {
      matchedCategory = findExactCategory('Matheus')
    } else if (
      normBudget.includes('familia') ||
      normCategory === 'familia' ||
      normCategory === 'familia'
    ) {
      matchedCategory = findExactCategory('Família')
    } else if (normBudget.includes('fast escova') || normCategory.includes('fast escova')) {
      matchedCategory = findExactCategory('Fast Escova')
    }

    // Se ainda não casou, testar subcategorias típicas de despesa
    if (!matchedCategory) {
      if (
        normCategory.includes('banho') ||
        normCategory.includes('racao') ||
        normCategory.includes('veterinario') ||
        normDesc.includes('petshop') ||
        normDesc.includes('cobasi') ||
        normDesc.includes('petz')
      ) {
        matchedCategory = findExactCategory('Pets')
      } else if (
        normCategory.includes('combustivel') ||
        normCategory.includes('gasolina') ||
        normCategory.includes('consorcio') ||
        normCategory.includes('estacionamento') ||
        normCategory.includes('pedagio') ||
        normCategory.includes('lavagem') ||
        normCategory.includes('multa') ||
        normCategory.includes('revisao') ||
        normCategory.includes('oficina') ||
        normCategory.includes('ipva')
      ) {
        matchedCategory = findExactCategory('Transporte')
      } else if (
        normCategory.includes('agua') ||
        normCategory.includes('luz') ||
        normCategory.includes('gas') ||
        normCategory.includes('internet') ||
        normCategory.includes('iptu') ||
        normCategory.includes('diarista') ||
        normCategory.includes('decoracao') ||
        normCategory.includes('utensilios') ||
        normCategory.includes('manutencao') ||
        normCategory.includes('aluguel') ||
        normCategory.includes('condominio')
      ) {
        matchedCategory = findExactCategory('Moradia')
      } else if (
        normCategory.includes('supermercado') ||
        normCategory.includes('restaurante') ||
        normCategory.includes('delivery') ||
        normCategory.includes('farmacia') ||
        normCategory.includes('igreja') ||
        normCategory.includes('lavanderia') ||
        normCategory.includes('suplemento') ||
        normCategory.includes('comemorac')
      ) {
        matchedCategory = findExactCategory('Família')
      } else if (
        normDesc.includes('fast escova') ||
        normCategory.includes('implantacao') ||
        normCategory.includes('pagamento de contas')
      ) {
        matchedCategory = findExactCategory('Fast Escova')
      }
    }

    // Tentar correspondência direta por nome com categoria permitida de despesa
    if (!matchedCategory && normCategory) {
      matchedCategory = allowedCategories.find((c) => {
        const cNorm = normalizeText(c.name)
        return cNorm === normCategory || cNorm.includes(normCategory)
      })
    }

    // Fallback para despesa: preferir "Despesa Fabrício" se existir, ou a primeira de despesa
    if (!matchedCategory) {
      matchedCategory = findExactCategory('Despesa Fabrício') || allowedCategories[0]
    }
  }

  // Se por alguma anomalia ainda não houver categoria (ex: sem categorias cadastradas no banco),
  // construir resposta limpa
  const categoryName = matchedCategory
    ? matchedCategory.name
    : lineType === 'receita'
      ? 'Receita Fabrício'
      : 'Despesa Fabrício'
  const categoryId = matchedCategory?.id

  // Subcategoria: verificar se existe sob a categoria escolhida
  let matchedSubRecord: Subcategory | undefined
  if (categoryId && candidateSubcategoryName) {
    matchedSubRecord = subcategories.find(
      (s) =>
        s.category_id === categoryId &&
        normalizeText(s.name) === normalizeText(candidateSubcategoryName),
    )
  }

  // Normalização do nome da subcategoria final
  let subcategoryName = candidateSubcategoryName || (lineType === 'receita' ? 'Outros' : 'Diversos')
  // Se o nome da subcategoria era igual ao nome da própria categoria (ex: "Fabrício" ou "Receita Fabrício"),
  // usar fallback semântico apropriado
  if (
    normalizeText(subcategoryName) === normalizeText(categoryName) ||
    normalizeText(subcategoryName) === 'fabricio' ||
    normalizeText(subcategoryName) === 'raffaela' ||
    normalizeText(subcategoryName) === 'investimento'
  ) {
    subcategoryName = lineType === 'receita' ? 'Outros' : 'Diversos'
  }

  return {
    categoryName,
    categoryId,
    subcategoryName: matchedSubRecord?.name || subcategoryName,
    subcategoryId: matchedSubRecord?.id,
    type: lineType,
  }
}
