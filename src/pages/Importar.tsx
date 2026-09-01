import { useState, useRef, useMemo, ChangeEvent, DragEvent } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  Upload,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  Info,
  Building2,
  Receipt,
  Calendar,
  CreditCard,
  Tag,
  Loader2,
  Sparkles,
  User,
  Users,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import { Account, Category, RESPONSIBLE_PERSONS, ResponsiblePerson } from '@/types/database'

// 9 Standard categories recognized in the system
const SYSTEM_CATEGORIES = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Filhos',
  'Pets',
  'Lazer',
  'Investimentos',
  'Pessoal',
  'Salário',
] as const

type SystemCategoryName = (typeof SYSTEM_CATEGORIES)[number]

interface ParsedRow {
  rowIndex: number
  raw: Record<string, any>
  dateRaw: any
  dateFormatted: string // YYYY-MM-DD
  description: string
  amount: number
  accountRaw: string
  matchedAccount: Account | null
  categoryRaw: string
  matchedCategoryName: SystemCategoryName | 'Outros'
  matchedCategoryId: string | null
  matchedCategoryType: 'despesa' | 'receita'
  responsibleRaw: string
  matchedResponsible: ResponsiblePerson | ''
  paymentMethodRaw: string
  recurrenceRaw: string
  isRecurring: boolean
  recurrenceType: 'mensal' | 'semanal' | 'anual' | null
  installmentRaw: string
  installmentNumber: number | null
  totalInstallments: number | null
  isParentInstallment: boolean
  isValid: boolean
  skipReason?: string
}

interface UnimportedRowItem {
  rowIndex: number
  dateFormatted: string
  description: string
  amount: number
  accountRaw: string
  categoryRaw: string
  responsibleRaw?: string
  reason: string
  type: 'skipped' | 'error'
  rawDetails?: Record<string, any>
}

interface ImportSummary {
  totalRows: number
  importedCount: number
  skippedCount: number
  errorsCount: number
  createdTransactions: number
  details: {
    row: number
    description: string
    status: 'imported' | 'skipped' | 'error'
    message: string
  }[]
  unimportedRows: UnimportedRowItem[]
}

// Map helper to normalize text
function normalizeText(text: string): string {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Convert Excel dates (serial numbers, Date objects, or strings) to YYYY-MM-DD
function parseExcelDate(value: any): string {
  if (!value) {
    return new Date().toISOString().split('T')[0]
  }

  // If it's already a JS Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split('T')[0]
  }

  // If it's an Excel numeric serial date (e.g. 45292)
  if (typeof value === 'number') {
    // Excel base date offset
    const dateObj = new Date(Math.round((value - 25569) * 86400 * 1000))
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0]
    }
  }

  const str = String(value).trim()

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const brMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0')
    const month = brMatch[2].padStart(2, '0')
    let year = brMatch[3]
    if (year.length === 2) {
      year = '20' + year
    }
    return `${year}-${month}-${day}`
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
  if (isoMatch) {
    const year = isoMatch[1]
    const month = isoMatch[2].padStart(2, '0')
    const day = isoMatch[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Try Date.parse
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }

  return new Date().toISOString().split('T')[0]
}

// Parse numeric values (support Brazilian format R$ 1.234,56 or -123.45)
function parseExcelAmount(value: any): number {
  if (typeof value === 'number') return Math.abs(value)
  if (!value) return 0

  let str = String(value).trim()
  // Remove currency symbol, spaces, non-numeric except . , and -
  str = str.replace(/[R$\s]/gi, '')

  // If format is like "1.234,56"
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.')
    } else {
      str = str.replace(/,/g, '')
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }

  const num = parseFloat(str)
  return isNaN(num) ? 0 : Math.abs(num)
}

// Normalize responsible person from "Orçamento" column or raw text
function normalizeResponsible(value: any): ResponsiblePerson | '' {
  if (!value) return ''
  const str = String(value).trim()
  if (!str) return ''
  const norm = normalizeText(str)

  // Specialized aliases / variations mapping before generic matching
  if (norm.includes('fast escova') || norm.includes('fastescova') || norm === 'fast') {
    return 'Fast Escova'
  }
  if (
    norm === 'investimento' ||
    norm === 'investimentos' ||
    norm.includes('investimento') ||
    norm.includes('investimentos')
  ) {
    return 'Investimento'
  }
  if (norm.includes('familia')) {
    return 'Família'
  }
  if (norm.includes('fabricio')) {
    return 'Fabrício'
  }
  if (norm.includes('raffaela') || norm.includes('rafaela')) {
    return 'Raffaela'
  }
  if (norm.includes('emanuel')) {
    return 'Emanuel'
  }
  if (norm.includes('helena')) {
    return 'Helena'
  }
  if (norm.includes('matheus') || norm.includes('mateus')) {
    return 'Matheus'
  }

  for (const person of RESPONSIBLE_PERSONS) {
    if (normalizeText(person) === norm) {
      return person
    }
  }

  // Loose check (e.g. contains name)
  for (const person of RESPONSIBLE_PERSONS) {
    if (norm.includes(normalizeText(person))) {
      return person
    }
  }

  return ''
}

// Intelligent Category Mapper based on task instructions
function mapCategory(
  rawCategory: string,
  rawDescription: string,
  rawType?: string,
): { name: SystemCategoryName | 'Outros'; type: 'despesa' | 'receita' } {
  const normCat = normalizeText(rawCategory)
  const normDesc = normalizeText(rawDescription)
  const normCombined = `${normCat} ${normDesc}`
  const normType = normalizeText(rawType || '')

  // 1. Salário / Receitas
  if (
    normCat.includes('salario') ||
    normCat.includes('rendimento') ||
    normCat.includes('pro labore') ||
    normDesc.includes('salario') ||
    normDesc.includes('holerite') ||
    normDesc.includes('pagamento recebido') ||
    (normType === 'receita' && (normCat.includes('salario') || normCat.includes('rendimento')))
  ) {
    return { name: 'Salário', type: 'receita' }
  }

  // 2. Investimentos
  if (
    normCombined.includes('cdb') ||
    normCombined.includes('acao') ||
    normCombined.includes('acoes') ||
    normCombined.includes('fii') ||
    normCombined.includes('fiis') ||
    normCombined.includes('tesouro') ||
    normCombined.includes('investimento') ||
    normCombined.includes('aplicacao') ||
    normCombined.includes('renda fixa') ||
    normCombined.includes('dividendo') ||
    normCombined.includes('poupanca')
  ) {
    return {
      name: 'Investimentos',
      type: normType === 'receita' || normCombined.includes('dividendo') ? 'receita' : 'despesa',
    }
  }

  // 3. Alimentação
  if (
    normCombined.includes('supermercado') ||
    normCombined.includes('feira') ||
    normCombined.includes('acougue') ||
    normCombined.includes('mercado') ||
    normCombined.includes('padaria') ||
    normCombined.includes('sacolao') ||
    normCombined.includes('hortifruti') ||
    normCombined.includes('restaurante') ||
    normCombined.includes('refeicao') ||
    normCombined.includes('alimentacao') ||
    normCombined.includes('carrefour') ||
    normCombined.includes('pao de acucar') ||
    normCombined.includes('assaí') ||
    normCombined.includes('assai') ||
    normCombined.includes('atacadão') ||
    normCombined.includes('atacadao')
  ) {
    return { name: 'Alimentação', type: 'despesa' }
  }

  // 4. Moradia
  if (
    normCombined.includes('luz') ||
    normCombined.includes('agua') ||
    normCombined.includes('internet') ||
    normCombined.includes('aluguel') ||
    normCombined.includes('diarista') ||
    normCombined.includes('condominio') ||
    normCombined.includes('energia') ||
    normCombined.includes('enel') ||
    normCombined.includes('sabesp') ||
    normCombined.includes('gas') ||
    normCombined.includes('comgas') ||
    normCombined.includes('iptu') ||
    normCombined.includes('faxina') ||
    normCombined.includes('moradia') ||
    normCombined.includes('casa') ||
    normCombined.includes('financiamento casa')
  ) {
    return { name: 'Moradia', type: 'despesa' }
  }

  // 5. Transporte
  if (
    normCombined.includes('gasolina') ||
    normCombined.includes('combustivel') ||
    normCombined.includes('ipva') ||
    normCombined.includes('seguro carro') ||
    normCombined.includes('seguro auto') ||
    normCombined.includes('uber') ||
    normCombined.includes('99app') ||
    normCombined.includes('estacionamento') ||
    normCombined.includes('pedagio') ||
    normCombined.includes('sem parar') ||
    normCombined.includes('veloe') ||
    normCombined.includes('mecanico') ||
    normCombined.includes('oficina') ||
    normCombined.includes('onibus') ||
    normCombined.includes('metro') ||
    normCombined.includes('transporte')
  ) {
    return { name: 'Transporte', type: 'despesa' }
  }

  // 6. Saúde
  if (
    normCombined.includes('medico') ||
    normCombined.includes('medicos') ||
    normCombined.includes('farmacia') ||
    normCombined.includes('plano de saude') ||
    normCombined.includes('psicologo') ||
    normCombined.includes('psicologos') ||
    normCombined.includes('dentista') ||
    normCombined.includes('gympass') ||
    normCombined.includes('droga raia') ||
    normCombined.includes('drogasil') ||
    normCombined.includes('drogaria') ||
    normCombined.includes('consulta') ||
    normCombined.includes('exame') ||
    normCombined.includes('academia') ||
    normCombined.includes('smart fit') ||
    normCombined.includes('saude')
  ) {
    return { name: 'Saúde', type: 'despesa' }
  }

  // 7. Filhos
  if (
    normCombined.includes('emanuel') ||
    normCombined.includes('helena') ||
    normCombined.includes('matheus') ||
    normCombined.includes('escola') ||
    normCombined.includes('natacao') ||
    normCombined.includes('filho') ||
    normCombined.includes('filhos') ||
    normCombined.includes('colegio') ||
    normCombined.includes('pediatra') ||
    normCombined.includes('material escolar') ||
    normCombined.includes('brinquedo')
  ) {
    return { name: 'Filhos', type: 'despesa' }
  }

  // 8. Pets
  if (
    normCombined.includes('racao') ||
    normCombined.includes('pet shop') ||
    normCombined.includes('petshop') ||
    normCombined.includes('veterinario') ||
    normCombined.includes('pet') ||
    normCombined.includes('pets') ||
    normCombined.includes('cobasi') ||
    normCombined.includes('petz') ||
    normCombined.includes('banho e tosa') ||
    normCombined.includes('cachorro') ||
    normCombined.includes('gato')
  ) {
    return { name: 'Pets', type: 'despesa' }
  }

  // 9. Lazer
  if (
    normCombined.includes('viagens') ||
    normCombined.includes('viagem') ||
    normCombined.includes('netflix') ||
    normCombined.includes('spotify') ||
    normCombined.includes('streaming') ||
    normCombined.includes('ifood') ||
    normCombined.includes('lazer') ||
    normCombined.includes('cinema') ||
    normCombined.includes('hotel') ||
    normCombined.includes('airbnb') ||
    normCombined.includes('passagem') ||
    normCombined.includes('bar') ||
    normCombined.includes('show') ||
    normCombined.includes('hbo') ||
    normCombined.includes('disney') ||
    normCombined.includes('amazon prime')
  ) {
    return { name: 'Lazer', type: 'despesa' }
  }

  // 10. Pessoal
  if (
    normCombined.includes('celular') ||
    normCombined.includes('roupas') ||
    normCombined.includes('roupa') ||
    normCombined.includes('cabelereiro') ||
    normCombined.includes('cabeleireiro') ||
    normCombined.includes('barbearia') ||
    normCombined.includes('educacao') ||
    normCombined.includes('curso') ||
    normCombined.includes('pessoal') ||
    normCombined.includes('perfume') ||
    normCombined.includes('cosmetico') ||
    normCombined.includes('zara') ||
    normCombined.includes('renner') ||
    normCombined.includes('shein')
  ) {
    return { name: 'Pessoal', type: 'despesa' }
  }

  // Fallback to Outros or default type
  if (normType === 'receita') {
    return { name: 'Salário', type: 'receita' }
  }
  return { name: 'Pessoal', type: 'despesa' }
}

// Find matching account by name
function matchAccount(accountNameRaw: string, accounts: Account[]): Account | null {
  if (!accountNameRaw || accounts.length === 0) return null
  const normRaw = normalizeText(accountNameRaw)

  // Exact or contains match
  const exact = accounts.find((a) => normalizeText(a.name) === normRaw)
  if (exact) return exact

  // Loose match (e.g. "Neon Fabricio" -> "Neon Fabrício")
  const loose = accounts.find((a) => {
    const aNorm = normalizeText(a.name)
    return aNorm.includes(normRaw) || normRaw.includes(aNorm)
  })
  if (loose) return loose

  // Specialized mappings for common payment methods
  if (normRaw.includes('santander') && normRaw.includes('cred')) {
    return (
      accounts.find((a) => normalizeText(a.name).includes('santander') && a.type === 'credito') ||
      null
    )
  }
  if (normRaw.includes('santander')) {
    return (
      accounts.find((a) => normalizeText(a.name).includes('santander') && a.type !== 'credito') ||
      null
    )
  }
  if (normRaw.includes('neon') && normRaw.includes('fab') && normRaw.includes('cred')) {
    return (
      accounts.find(
        (a) =>
          normalizeText(a.name).includes('neon') &&
          normalizeText(a.name).includes('fabricio') &&
          a.type === 'credito',
      ) || null
    )
  }
  if (normRaw.includes('neon') && normRaw.includes('raff') && normRaw.includes('cred')) {
    return (
      accounts.find(
        (a) =>
          normalizeText(a.name).includes('neon') &&
          normalizeText(a.name).includes('raffaela') &&
          a.type === 'credito',
      ) || null
    )
  }
  if (normRaw.includes('neon') && normRaw.includes('fab')) {
    return (
      accounts.find(
        (a) => normalizeText(a.name).includes('neon') && normalizeText(a.name).includes('fabricio'),
      ) || null
    )
  }
  if (normRaw.includes('neon') && normRaw.includes('raff')) {
    return (
      accounts.find(
        (a) => normalizeText(a.name).includes('neon') && normalizeText(a.name).includes('raffaela'),
      ) || null
    )
  }
  if (normRaw.includes('flash')) {
    return accounts.find((a) => normalizeText(a.name).includes('flash')) || null
  }

  return null
}

// Parse installments info like "01/05" or "23/36"
function parseInstallment(
  val: any,
  description: string = '',
): { number: number | null; total: number | null } {
  const combined = `${String(val || '')} ${description}`
  const match = combined.match(/(\d{1,2})\s*[/|\\]\s*(\d{1,2})/i)
  if (match) {
    const num = parseInt(match[1], 10)
    const tot = parseInt(match[2], 10)
    if (!isNaN(num) && !isNaN(tot) && tot >= 1 && num <= tot) {
      return { number: num, total: tot }
    }
  }

  // Also match "parcela 3 de 10" or "3x"
  const matchDe = combined.match(/parcela\s*(\d{1,2})\s*de\s*(\d{1,2})/i)
  if (matchDe) {
    const num = parseInt(matchDe[1], 10)
    const tot = parseInt(matchDe[2], 10)
    if (!isNaN(num) && !isNaN(tot) && tot >= 1 && num <= tot) {
      return { number: num, total: tot }
    }
  }

  return { number: null, total: null }
}

// Parse recurrence info
function parseRecurrence(
  paymentMethod: string,
  frequencyVal: string,
  desc: string,
): { isRecurring: boolean; type: 'mensal' | 'semanal' | 'anual' | null } {
  const norm = `${normalizeText(paymentMethod)} ${normalizeText(frequencyVal)} ${normalizeText(desc)}`

  if (norm.includes('mensal') || norm.includes('mes a mes') || norm.includes('recorrente mensal')) {
    return { isRecurring: true, type: 'mensal' }
  }
  if (norm.includes('semanal')) {
    return { isRecurring: true, type: 'semanal' }
  }
  if (norm.includes('anual') || norm.includes('ano')) {
    return { isRecurring: true, type: 'anual' }
  }

  return { isRecurring: false, type: null }
}

// Helper: add months to date
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  const targetMonthLastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (day > targetMonthLastDay) d.setDate(targetMonthLastDay)
  return d.toISOString().split('T')[0]
}

export default function Importar() {
  const { currentCompany, reloadCompanyData } = useCompany()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')

  const [dbAccounts, setDbAccounts] = useState<Account[]>([])
  const [dbCategories, setDbCategories] = useState<Category[]>([])
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)

  // Parsed data & execution state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  })
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Non-imported rows filter and copy states
  const [unimportedSearch, setUnimportedSearch] = useState('')
  const [unimportedFilter, setUnimportedFilter] = useState<'all' | 'skipped' | 'error'>('all')
  const [isCopied, setIsCopied] = useState(false)
  const [showPreImportSkipped, setShowPreImportSkipped] = useState(false)

  // Fetch accounts and categories directly for the active control
  const fetchControlMetadata = async (companyId: string) => {
    setIsLoadingMetadata(true)
    try {
      const [accs, cats] = await Promise.all([
        pb.collection('accounts').getFullList<Account>({
          filter: `control_id="${companyId}"`,
          sort: 'name',
        }),
        pb.collection('categories').getFullList<Category>({
          filter: `control_id="${companyId}"`,
          sort: 'name',
        }),
      ])
      setDbAccounts(accs)
      setDbCategories(cats)
    } catch (e: any) {
      console.error('Erro ao buscar contas/categorias:', e)
      setErrorBanner('Erro ao carregar contas e categorias do controle ativo.')
    } finally {
      setIsLoadingMetadata(false)
    }
  }

  // Load metadata whenever currentCompany changes
  useMemo(() => {
    if (currentCompany?.id) {
      fetchControlMetadata(currentCompany.id)
    }
  }, [currentCompany?.id])

  // Handle uploaded file
  const processFile = (file: File) => {
    setErrorBanner(null)
    setImportSummary(null)
    setParsedRows([])

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrorBanner(
        'Formato de arquivo inválido. Por favor, envie uma planilha Excel (.xlsx ou .xls).',
      )
      return
    }

    setFileName(file.name)
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false,
        })
        setWorkbook(wb)
        setSheetNames(wb.SheetNames)
        if (wb.SheetNames.length > 0) {
          setSelectedSheet(wb.SheetNames[0])
          parseSheetData(wb, wb.SheetNames[0], dbAccounts, dbCategories)
        }
      } catch (err: any) {
        console.error('Erro ao ler planilha:', err)
        setErrorBanner(
          'Não foi possível ler o arquivo Excel. Verifique se o arquivo não está corrompido.',
        )
      }
    }

    reader.readAsArrayBuffer(file)
  }

  // Parse worksheet content into structured rows
  const parseSheetData = (
    wb: XLSX.WorkBook,
    sheetName: string,
    accountsList: Account[],
    categoriesList: Category[],
  ) => {
    if (!wb || !wb.Sheets[sheetName]) return

    const sheet = wb.Sheets[sheetName]
    // Get raw json rows
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      raw: true,
      defval: '',
      blankrows: false,
    })

    if (jsonRows.length === 0) {
      setParsedRows([])
      return
    }

    const rows: ParsedRow[] = []

    jsonRows.forEach((row, index) => {
      // Find columns by flexible names
      const getVal = (...keys: string[]) => {
        for (const k of keys) {
          const matchKey = Object.keys(row).find((rk) => normalizeText(rk) === normalizeText(k))
          if (matchKey && row[matchKey] !== undefined && row[matchKey] !== '') {
            return row[matchKey]
          }
        }
        return ''
      }

      // Column candidates
      const dateVal = getVal('Data', 'Date', 'Dt', 'Dia', 'Data Lançamento', 'Data do Lançamento')
      const descVal = getVal(
        'Descrição',
        'Descricao',
        'Desc',
        'Histórico',
        'Historico',
        'Nome',
        'Título',
        'Titulo',
        'Lançamento',
        'Lancamento',
      )
      const amountVal = getVal(
        'Valor',
        'Valor (R$)',
        'Quantia',
        'Total',
        'Amount',
        'Preço',
        'Preco',
      )
      const accountVal = getVal(
        'Meio de pagamento',
        'Conta',
        'Meio Pagamento',
        'Forma de Pagamento',
        'Cartão',
        'Cartao',
        'Banco',
        'Origem',
        'Payment Method',
      )
      const orcamentoVal = getVal(
        'Orçamento',
        'Orcamento',
        'Responsável',
        'Responsavel',
        'Quem',
        'Pessoa',
        'Membro',
      )
      const catVal = getVal(
        'Categoria',
        'Tipo',
        'Category',
        'Classificação',
        'Classificacao',
        'Grupo',
        'Subcategoria',
      )
      const typeVal = getVal('Tipo Lançamento', 'Tipo Transação', 'Natureza', 'D/C', 'Operação')
      const parcelasVal = getVal(
        'Parcelas',
        'Parcela',
        'Qtd Parcelas',
        'Plano',
        'Nº Parcela',
        'Parcelamento',
      )
      const recurrenceVal = getVal(
        'Recorrência',
        'Recorrencia',
        'Frequência',
        'Frequencia',
        'Periodicidade',
        'Repetição',
      )

      const description = String(descVal || 'Sem descrição').trim()
      const amount = parseExcelAmount(amountVal)
      const dateFormatted = parseExcelDate(dateVal)
      const paymentMethodRaw = String(accountVal || '').trim()
      const categoryRaw = String(catVal || '').trim()
      const responsibleRaw = String(orcamentoVal || '').trim()
      const matchedResponsible = normalizeResponsible(responsibleRaw)

      // Account match
      const matchedAccount = matchAccount(paymentMethodRaw, accountsList)

      // Category match
      const mappedCat = mapCategory(categoryRaw, description, String(typeVal))
      const matchedCatRecord =
        categoriesList.find(
          (c) =>
            normalizeText(c.name) === normalizeText(mappedCat.name) && c.type === mappedCat.type,
        ) ||
        categoriesList.find((c) => normalizeText(c.name) === normalizeText(mappedCat.name)) ||
        null

      // Recurrence
      const recurrenceInfo = parseRecurrence(paymentMethodRaw, String(recurrenceVal), description)

      // Installment
      const installmentInfo = parseInstallment(parcelasVal, description)
      const isCreditInstallment =
        normalizeText(paymentMethodRaw).includes('parcelad') ||
        normalizeText(paymentMethodRaw).includes('credito parcelado') ||
        (installmentInfo.total !== null && installmentInfo.total > 1)

      // Validation
      let isValid = true
      let skipReason: string | undefined

      if (!dateVal || dateFormatted === 'Invalid Date') {
        isValid = false
        skipReason = 'Data não informada ou formato inválido'
      } else if (!paymentMethodRaw) {
        isValid = false
        skipReason = 'Meio de pagamento não informado'
      } else if (!matchedAccount) {
        isValid = false
        skipReason = `Conta "${paymentMethodRaw}" não cadastrada no controle`
      } else if (amount <= 0) {
        isValid = false
        skipReason = 'Valor zerado ou inválido'
      }
      rows.push({
        rowIndex: index + 2, // Excel 1-based index (header is 1)
        raw: row,
        dateRaw: dateVal,
        dateFormatted,
        description,
        amount,
        accountRaw: paymentMethodRaw,
        matchedAccount,
        categoryRaw,
        matchedCategoryName: mappedCat.name,
        matchedCategoryId: matchedCatRecord?.id || null,
        matchedCategoryType: mappedCat.type,
        responsibleRaw,
        matchedResponsible,
        paymentMethodRaw,
        recurrenceRaw: String(recurrenceVal),
        isRecurring: recurrenceInfo.isRecurring,
        recurrenceType: recurrenceInfo.type,
        installmentRaw: String(parcelasVal),
        installmentNumber: installmentInfo.number,
        totalInstallments: installmentInfo.total,
        isParentInstallment: isCreditInstallment,
        isValid,
        skipReason,
      })
    })

    setParsedRows(rows)
  }

  // Switch active sheet
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName)
    if (workbook) {
      parseSheetData(workbook, sheetName, dbAccounts, dbCategories)
    }
  }

  // Drag & drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0])
    }
  }

  // Main import execution routine
  const handleExecuteImport = async () => {
    if (!currentCompany?.id) {
      setErrorBanner('Nenhum controle selecionado.')
      return
    }

    if (parsedRows.length === 0) {
      setErrorBanner('Nenhum dado encontrado para importar.')
      return
    }

    setIsImporting(true)
    setErrorBanner(null)
    setImportProgress({ current: 0, total: parsedRows.length })

    const summary: ImportSummary = {
      totalRows: parsedRows.length,
      importedCount: 0,
      skippedCount: 0,
      errorsCount: 0,
      createdTransactions: 0,
      details: [],
      unimportedRows: [],
    }

    const currentUserId = pb.authStore.model?.id || ''

    // Ensure we have real category IDs by querying current control categories
    const freshCategories = await pb.collection('categories').getFullList<Category>({
      filter: `control_id="${currentCompany.id}"`,
    })

    const getCatId = (name: string, type: 'despesa' | 'receita'): string => {
      const match =
        freshCategories.find(
          (c) => normalizeText(c.name) === normalizeText(name) && c.type === type,
        ) || freshCategories.find((c) => normalizeText(c.name) === normalizeText(name))
      return match ? match.id : ''
    }

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      setImportProgress({ current: i + 1, total: parsedRows.length })

      // Check if row is skippable due to missing account or invalid data
      if (!row.isValid || !row.matchedAccount) {
        summary.skippedCount++
        const reason = row.skipReason || 'Conta não encontrada ou dados insuficientes.'
        summary.details.push({
          row: row.rowIndex,
          description: row.description || 'Linha inválida',
          status: 'skipped',
          message: reason,
        })
        summary.unimportedRows.push({
          rowIndex: row.rowIndex,
          dateFormatted: row.dateFormatted,
          description: row.description || 'Sem descrição',
          amount: row.amount,
          accountRaw: row.accountRaw,
          categoryRaw: row.categoryRaw,
          responsibleRaw: row.responsibleRaw,
          reason,
          type: 'skipped',
          rawDetails: row.raw,
        })
        continue
      }

      try {
        const categoryId =
          row.matchedCategoryId || getCatId(row.matchedCategoryName, row.matchedCategoryType)

        // Case A: Installment purchase (e.g. "01/05" or "23/36" or "Crédito parcelado")
        if (
          row.totalInstallments &&
          row.totalInstallments > 1 &&
          row.installmentNumber !== null &&
          row.installmentNumber > 0
        ) {
          const totalInst = row.totalInstallments
          const currentInst = row.installmentNumber
          const unitAmount = row.amount
          const totalEstimatedAmount = Math.round(unitAmount * totalInst * 100) / 100

          // 1. Create parent record (is_parent = true, installment_number = 0)
          const parentPayload: any = {
            control_id: currentCompany.id,
            user_id: currentUserId,
            type: row.matchedCategoryType,
            amount: totalEstimatedAmount,
            description: `${row.description} (Total: ${formatCurrency(totalEstimatedAmount)})`,
            category_id: categoryId,
            account_id: row.matchedAccount.id,
            date: row.dateFormatted,
            paid: true,
            is_recurring: false,
            responsible: row.matchedResponsible || undefined,
            installments_total: totalInst,
            installment_number: 0,
            notes: `Importado de planilha: registro pai consolidado (${totalInst}x)`,
          }

          const parentRecord = await pb.collection('transactions').create(parentPayload)
          summary.createdTransactions++

          // 2. Create the current individual installment (e.g. 23/36) with sheet date
          const currentInstPayload: any = {
            control_id: currentCompany.id,
            user_id: currentUserId,
            type: row.matchedCategoryType,
            amount: unitAmount,
            description: `${row.description} (${currentInst}/${totalInst})`,
            category_id: categoryId,
            account_id: row.matchedAccount.id,
            date: row.dateFormatted,
            paid: true,
            is_recurring: false,
            responsible: row.matchedResponsible || undefined,
            installments_total: totalInst,
            installment_number: currentInst,
            parent_transaction_id: parentRecord.id,
            notes: `Importado de planilha: parcela ${currentInst}/${totalInst}`,
          }

          await pb.collection('transactions').create(currentInstPayload)
          summary.createdTransactions++

          // Adjust account balance for the created installment
          try {
            const acc = await pb.collection('accounts').getOne(row.matchedAccount.id)
            let newBalance = Number(acc.balance) || 0
            if (acc.type === 'credito') {
              newBalance += row.matchedCategoryType === 'despesa' ? unitAmount : -unitAmount
            } else {
              newBalance += row.matchedCategoryType === 'receita' ? unitAmount : -unitAmount
            }
            await pb.collection('accounts').update(row.matchedAccount.id, { balance: newBalance })
          } catch (err) {
            console.warn('Erro ao atualizar saldo da conta:', err)
          }

          summary.importedCount++
          summary.details.push({
            row: row.rowIndex,
            description: row.description,
            status: 'imported',
            message: `Parcela ${currentInst}/${totalInst} criada com vínculo pai.`,
          })
        } else if (
          // Case B: General "Crédito parcelado" without explicit N/M, but has installment total
          row.totalInstallments &&
          row.totalInstallments > 1 &&
          (!row.installmentNumber || row.installmentNumber === 0)
        ) {
          const totalInst = row.totalInstallments
          const baseAmount = Math.round((row.amount / totalInst) * 100) / 100
          const remainder = Math.round((row.amount - baseAmount * totalInst) * 100) / 100

          let parentId = ''
          for (let inst = 1; inst <= totalInst; inst++) {
            const parcelAmount =
              inst === 1 ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount
            const instDate = addMonths(row.dateFormatted, inst - 1)

            const payload: any = {
              control_id: currentCompany.id,
              user_id: currentUserId,
              type: row.matchedCategoryType,
              amount: parcelAmount,
              description: `${row.description} (${inst}/${totalInst})`,
              category_id: categoryId,
              account_id: row.matchedAccount.id,
              date: instDate,
              paid: true,
              is_recurring: false,
              responsible: row.matchedResponsible || undefined,
              installments_total: totalInst,
              installment_number: inst,
              notes: 'Importado de planilha via parcelamento automático',
            }

            if (inst !== 1) payload.parent_transaction_id = parentId
            const rec = await pb.collection('transactions').create(payload)
            summary.createdTransactions++

            if (inst === 1) {
              parentId = rec.id
              await pb
                .collection('transactions')
                .update(rec.id, { parent_transaction_id: parentId })
            }
          }

          // Adjust balance
          try {
            const acc = await pb.collection('accounts').getOne(row.matchedAccount.id)
            let newBalance = Number(acc.balance) || 0
            if (acc.type === 'credito') {
              newBalance += row.matchedCategoryType === 'despesa' ? row.amount : -row.amount
            } else {
              newBalance += row.matchedCategoryType === 'receita' ? row.amount : -row.amount
            }
            await pb.collection('accounts').update(row.matchedAccount.id, { balance: newBalance })
          } catch (err) {
            console.warn('Erro ao atualizar saldo da conta:', err)
          }

          summary.importedCount++
          summary.details.push({
            row: row.rowIndex,
            description: row.description,
            status: 'imported',
            message: `Plano de ${totalInst} parcelas gerado com sucesso.`,
          })
        } else {
          // Case C: Standard single transaction (or recurring)
          const singlePayload: any = {
            control_id: currentCompany.id,
            user_id: currentUserId,
            type: row.matchedCategoryType,
            amount: row.amount,
            description: row.description,
            category_id: categoryId,
            account_id: row.matchedAccount.id,
            date: row.dateFormatted,
            paid: true,
            is_recurring: row.isRecurring,
            recurring: row.isRecurring,
            recurrence_type: row.recurrenceType || '',
            recurrence_period: row.recurrenceType || '',
            responsible: row.matchedResponsible || undefined,
            installments_total: 1,
            installment_number: 1,
            notes: row.isRecurring
              ? `Importado de planilha (Recorrente ${row.recurrenceType || 'mensal'})`
              : 'Importado de planilha',
          }

          await pb.collection('transactions').create(singlePayload)
          summary.createdTransactions++

          // Adjust balance
          try {
            const acc = await pb.collection('accounts').getOne(row.matchedAccount.id)
            let newBalance = Number(acc.balance) || 0
            if (acc.type === 'credito') {
              newBalance += row.matchedCategoryType === 'despesa' ? row.amount : -row.amount
            } else {
              newBalance += row.matchedCategoryType === 'receita' ? row.amount : -row.amount
            }
            await pb.collection('accounts').update(row.matchedAccount.id, { balance: newBalance })
          } catch (err) {
            console.warn('Erro ao atualizar saldo da conta:', err)
          }

          summary.importedCount++
          summary.details.push({
            row: row.rowIndex,
            description: row.description,
            status: 'imported',
            message: 'Importado com sucesso.',
          })
        }
      } catch (err: any) {
        console.error(`Erro ao importar linha ${row.rowIndex}:`, err)
        summary.errorsCount++
        const errorMessage = err?.message || 'Falha ao gravar no banco de dados.'
        summary.details.push({
          row: row.rowIndex,
          description: row.description,
          status: 'error',
          message: errorMessage,
        })
        summary.unimportedRows.push({
          rowIndex: row.rowIndex,
          dateFormatted: row.dateFormatted,
          description: row.description || 'Sem descrição',
          amount: row.amount,
          accountRaw: row.accountRaw,
          categoryRaw: row.categoryRaw,
          responsibleRaw: row.responsibleRaw,
          reason: `Erro da API PocketBase: ${errorMessage}`,
          type: 'error',
          rawDetails: row.raw,
        })
      }
    }

    setImportSummary(summary)
    setIsImporting(false)
    // Reload global company state to reflect new data across Dashboard and Transactions
    await reloadCompanyData()
  }

  const validRowsCount = parsedRows.filter((r) => r.isValid).length
  const invalidRowsCount = parsedRows.filter((r) => !r.isValid).length
  const preImportSkippedRows = parsedRows.filter((r) => !r.isValid)
  const previewRows = parsedRows.slice(0, 5)

  // Filter unimported rows based on user input
  const filteredUnimportedRows = useMemo(() => {
    if (!importSummary) return []
    return importSummary.unimportedRows.filter((item) => {
      // Status filter
      if (unimportedFilter === 'skipped' && item.type !== 'skipped') return false
      if (unimportedFilter === 'error' && item.type !== 'error') return false

      // Text search
      if (!unimportedSearch.trim()) return true
      const q = normalizeText(unimportedSearch)
      return (
        String(item.rowIndex).includes(q) ||
        normalizeText(item.description).includes(q) ||
        normalizeText(item.accountRaw).includes(q) ||
        normalizeText(item.categoryRaw).includes(q) ||
        normalizeText(item.reason).includes(q) ||
        (item.responsibleRaw && normalizeText(item.responsibleRaw).includes(q))
      )
    })
  }, [importSummary, unimportedFilter, unimportedSearch])

  // Copy unimported lines to clipboard as structured text/CSV
  const handleCopyUnimported = (format: 'text' | 'csv' = 'text') => {
    if (!importSummary || importSummary.unimportedRows.length === 0) return

    let content = ''
    if (format === 'csv') {
      content = [
        'Linha;Data;Descrição;Valor;Conta/Meio;Categoria;Responsável;Motivo;Tipo Falha',
        ...importSummary.unimportedRows.map(
          (r) =>
            `${r.rowIndex};${r.dateFormatted};"${r.description.replace(/"/g, '""')}";${r.amount};"${r.accountRaw.replace(/"/g, '""')}";"${r.categoryRaw.replace(/"/g, '""')}";"${(r.responsibleRaw || '').replace(/"/g, '""')}";"${r.reason.replace(/"/g, '""')}";${r.type === 'skipped' ? 'Pulada (Dados/Conta)' : 'Erro API'}`,
        ),
      ].join('\n')
    } else {
      content = [
        `RELATÓRIO DE LINHAS NÃO IMPORTADAS - PLANILHA: ${fileName || 'Excel'} (Aba: ${selectedSheet})`,
        `Total Não Importadas: ${importSummary.unimportedRows.length} de ${importSummary.totalRows}`,
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        '--------------------------------------------------------------------------------',
        ...importSummary.unimportedRows.map(
          (r) =>
            `• Linha ${r.rowIndex} | Data: ${r.dateFormatted} | Descrição: ${r.description} | Valor: ${formatCurrency(r.amount)} | Conta: ${r.accountRaw || 'N/A'} | Motivo: ${r.reason}`,
        ),
      ].join('\n')
    }

    navigator.clipboard.writeText(content).then(
      () => {
        setIsCopied(true)
        toast.success(
          format === 'csv'
            ? 'Linhas não importadas copiadas em formato CSV!'
            : 'Linhas não importadas copiadas para a área de transferência!',
        )
        setTimeout(() => setIsCopied(false), 2500)
      },
      (err) => {
        console.error('Falha ao copiar:', err)
        toast.error('Não foi possível copiar para a área de transferência.')
      },
    )
  }

  // Export unimported lines directly as CSV file
  const handleDownloadUnimportedCsv = () => {
    if (!importSummary || importSummary.unimportedRows.length === 0) return

    const headers =
      'Linha;Data;Descrição;Valor;Conta / Meio;Categoria;Responsável;Motivo;Tipo Falha\n'
    const rows = importSummary.unimportedRows
      .map(
        (r) =>
          `${r.rowIndex};${r.dateFormatted};"${r.description.replace(/"/g, '""')}";${r.amount};"${r.accountRaw.replace(/"/g, '""')}";"${r.categoryRaw.replace(/"/g, '""')}";"${(r.responsibleRaw || '').replace(/"/g, '""')}";"${r.reason.replace(/"/g, '""')}";${r.type === 'skipped' ? 'Pulada' : 'Erro API'}`,
      )
      .join('\n')

    // Add BOM for Excel UTF-8 recognition
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `linhas-nao-importadas-${selectedSheet || 'planilha'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Download do arquivo CSV de falhas iniciado!')
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ferramenta de Integração</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Importar Planilha Excel
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Envie sua planilha{' '}
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono">
              .xlsx
            </code>{' '}
            para carregar lançamentos automaticamente para o controle{' '}
            <strong className="text-slate-700">{currentCompany?.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to={`/controle/${currentCompany?.id}/lancamentos`}>
            <Button variant="outline" className="rounded-xl h-10 gap-2">
              <Receipt className="w-4 h-4" />
              <span>Ver Lançamentos</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error alert banner */}
      {errorBanner && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Atenção na importação</p>
            <p className="mt-0.5">{errorBanner}</p>
          </div>
        </div>
      )}

      {/* 1. Upload Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]'
            : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/50 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 shadow-inner">
          <Upload className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-1">
          {fileName ? fileName : 'Arraste e solte seu arquivo Excel aqui'}
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
          Suporte completo para arquivos <strong className="text-slate-700">.xlsx</strong> com
          múltiplas abas, parcelamento e meios de pagamento.
        </p>

        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            fileInputRef.current?.click()
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-6 shadow-md shadow-indigo-600/20"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          {fileName ? 'Trocar de Arquivo' : 'Selecionar Arquivo .xlsx'}
        </Button>
      </div>

      {/* 2. Sheet Selector & Summary stats when workbook is loaded */}
      {sheetNames.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Selecione a Aba do Excel</h4>
                <p className="text-xs text-slate-500">
                  Identificamos {sheetNames.length} aba{sheetNames.length > 1 ? 's' : ''} no
                  arquivo.
                </p>
              </div>
            </div>

            {/* Sheet Tabs / Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {sheetNames.map((name) => {
                const isSelected = selectedSheet === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSheetChange(name)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick analysis cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Linhas na Aba
              </span>
              <p className="text-xl font-extrabold text-slate-800 mt-0.5">{parsedRows.length}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wide">
                Prontas p/ Importar
              </span>
              <p className="text-xl font-extrabold text-emerald-800 mt-0.5">{validRowsCount}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wide">
                Contas não encontradas
              </span>
              <p className="text-xl font-extrabold text-amber-800 mt-0.5">{invalidRowsCount}</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
              <span className="text-[11px] font-medium text-indigo-700 uppercase tracking-wide">
                Contas Cadastradas
              </span>
              <p className="text-xl font-extrabold text-indigo-800 mt-0.5">{dbAccounts.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Preview Section (First 5 rows) */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Pré-visualização (Primeiras 5 Linhas)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Revise os mapeamentos inteligentes de Data, Descrição, Valor, Conta e Categoria
                antes de confirmar.
              </p>
            </div>

            <Badge variant="secondary" className="font-semibold text-xs px-3 py-1">
              Exibindo {Math.min(5, parsedRows.length)} de {parsedRows.length} linhas
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Linha</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Meio / Conta</th>
                  <th className="py-3 px-4">Responsável (Orçamento)</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Recorrência / Parcelas</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row) => (
                  <tr key={row.rowIndex} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 font-semibold">
                      #{row.rowIndex}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {row.dateFormatted}
                    </td>
                    <td className="py-3 px-4 max-w-[240px] truncate font-medium text-slate-800">
                      {row.description}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      <span
                        className={
                          row.matchedCategoryType === 'receita'
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }
                      >
                        {row.matchedCategoryType === 'receita' ? '+' : '-'}{' '}
                        {formatCurrency(row.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {row.matchedAccount ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-800 font-medium">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: row.matchedAccount.color }}
                          />
                          {row.matchedAccount.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          {row.accountRaw || 'Não mapeada'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {row.matchedResponsible ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                          <User className="w-3 h-3 text-violet-500" />
                          {row.matchedResponsible}
                        </span>
                      ) : row.responsibleRaw ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-500 bg-slate-100">
                          {row.responsibleRaw}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Não definido</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Tag className="w-3 h-3 text-indigo-500" />
                        {row.matchedCategoryName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-500">
                      {row.isRecurring && (
                        <span className="text-indigo-600 font-semibold block">
                          Recorrente ({row.recurrenceType || 'mensal'})
                        </span>
                      )}
                      {row.totalInstallments && row.totalInstallments > 1 && (
                        <span className="text-amber-700 font-semibold block">
                          Parcela {row.installmentNumber || '1'}/{row.totalInstallments}
                        </span>
                      )}
                      {!row.isRecurring &&
                        (!row.totalInstallments || row.totalInstallments <= 1) && (
                          <span className="text-slate-400">À vista</span>
                        )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Válido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Pular
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              {invalidRowsCount > 0 ? (
                <span className="flex items-center gap-1 text-amber-700 font-medium">
                  <Info className="w-4 h-4" />
                  {invalidRowsCount} linha(s) com contas não cadastradas serão ignoradas.
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Todas as {validRowsCount} linhas foram mapeadas com sucesso.
                </span>
              )}
            </div>

            <Button
              onClick={handleExecuteImport}
              disabled={isImporting || validRowsCount === 0}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl h-12 px-8 font-bold shadow-lg shadow-emerald-900/20 gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Importando...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Importar {validRowsCount} Lançamentos</span>
                </>
              )}
            </Button>
          </div>

          {/* Pre-import skipped alert & accordion if there are invalid rows */}
          {invalidRowsCount > 0 && (
            <div className="border-t border-amber-200 bg-amber-50/70 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span className="text-xs font-semibold text-amber-900">
                    {invalidRowsCount} linha{invalidRowsCount > 1 ? 's' : ''} com pendências não{' '}
                    {invalidRowsCount > 1 ? 'serão importadas' : 'será importada'} (contas não
                    cadastradas ou valores zerados).
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreImportSkipped(!showPreImportSkipped)}
                  className="h-8 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg gap-1.5 self-start sm:self-auto"
                >
                  {showPreImportSkipped ? (
                    <>
                      <span>Ocultar lista prévia</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Ver {invalidRowsCount} linha(s) que serão puladas</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>

              {showPreImportSkipped && (
                <div className="mt-3 bg-white rounded-xl border border-amber-200 overflow-hidden shadow-inner max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-100/60 text-amber-900 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="py-2 px-3">Linha</th>
                        <th className="py-2 px-3">Descrição</th>
                        <th className="py-2 px-3">Valor</th>
                        <th className="py-2 px-3">Meio / Conta na Planilha</th>
                        <th className="py-2 px-3">Motivo da Não Importação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {preImportSkippedRows.map((row) => (
                        <tr key={row.rowIndex} className="hover:bg-amber-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-amber-800">
                            #{row.rowIndex}
                          </td>
                          <td className="py-2 px-3 text-slate-800 font-medium truncate max-w-[200px]">
                            {row.description}
                          </td>
                          <td className="py-2 px-3 tabular-nums font-semibold text-slate-700">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="py-2 px-3 text-amber-900 font-medium">
                            {row.accountRaw || '(Vazio)'}
                          </td>
                          <td className="py-2 px-3 text-amber-700 font-semibold">
                            {row.skipReason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* 4. Import In Progress Bar */}
      {isImporting && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-md space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Processando Planilha</h4>
                <p className="text-xs text-slate-500">
                  Gravando transações, parcelas e atualizando saldos no PocketBase...
                </p>
              </div>
            </div>
            <span className="text-sm font-extrabold text-indigo-600 tabular-nums">
              {importProgress.current} de {importProgress.total} importados
            </span>
          </div>

          <Progress
            value={(importProgress.current / Math.max(1, importProgress.total)) * 100}
            className="h-3 rounded-full bg-slate-100"
          />
        </div>
      )}

      {/* 5. Final Summary Card */}
      {importSummary && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg animate-fade-in">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Importação Concluída</h3>
                <p className="text-xs text-slate-400">
                  Resumo da execução da aba{' '}
                  <strong className="text-slate-200">"{selectedSheet}"</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700">
                <span className="text-[11px] text-slate-400 font-medium">Linhas Processadas</span>
                <p className="text-xl font-bold text-white mt-0.5">{importSummary.totalRows}</p>
              </div>
              <div className="bg-emerald-950/40 rounded-xl p-3 border border-emerald-800/60">
                <span className="text-[11px] text-emerald-400 font-medium">
                  Importados com Sucesso
                </span>
                <p className="text-xl font-bold text-emerald-300 mt-0.5">
                  {importSummary.importedCount}
                </p>
              </div>
              <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-800/60">
                <span className="text-[11px] text-amber-400 font-medium">
                  Não Importados (Pulados)
                </span>
                <p className="text-xl font-bold text-amber-300 mt-0.5">
                  {importSummary.skippedCount}
                </p>
              </div>
              <div className="bg-rose-950/40 rounded-xl p-3 border border-rose-800/60">
                <span className="text-[11px] text-rose-400 font-medium">Erros de Execução</span>
                <p className="text-xl font-bold text-rose-300 mt-0.5">
                  {importSummary.errorsCount}
                </p>
              </div>
            </div>
          </div>

          {/* Main non-imported lines inspection section */}
          {importSummary.unimportedRows.length > 0 ? (
            <div className="p-6 border-b border-slate-200 bg-amber-50/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                      {importSummary.unimportedRows.length}
                    </div>
                    <h4 className="text-base font-bold text-slate-900">
                      Linhas NÃO Importadas ({importSummary.unimportedRows.length})
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Confira abaixo cada linha da planilha que não pôde ser gravada e o respectivo
                    motivo para que você possa corrigir.
                  </p>
                </div>

                {/* Actions: Copy & CSV Download */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyUnimported('text')}
                    className="h-9 px-3 rounded-xl bg-white border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs gap-1.5 shadow-sm"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        <span>Copiar Lista</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadUnimportedCsv}
                    className="h-9 px-3 rounded-xl bg-white border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs gap-1.5 shadow-sm"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>Baixar CSV de Falhas</span>
                  </Button>
                </div>
              </div>

              {/* Filters toolbar for non-imported table */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Filtrar por linha, descrição, motivo ou conta..."
                    value={unimportedSearch}
                    onChange={(e) => setUnimportedSearch(e.target.value)}
                    className="h-9 pl-9 pr-3 text-xs bg-white rounded-xl border-slate-200"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setUnimportedFilter('all')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      unimportedFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({importSummary.unimportedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnimportedFilter('skipped')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      unimportedFilter === 'skipped'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Puladas ({importSummary.skippedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnimportedFilter('error')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      unimportedFilter === 'error'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Erros API ({importSummary.errorsCount})
                  </button>
                </div>
              </div>

              {/* Dedicated Non-Imported Rows Table */}
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                <div className="max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-amber-100/80 text-amber-950 font-bold text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-amber-200">
                      <tr>
                        <th className="py-3 px-3.5 whitespace-nowrap">Linha Planilha</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Data</th>
                        <th className="py-3 px-3.5">Descrição</th>
                        <th className="py-3 px-3.5 whitespace-nowrap">Valor</th>
                        <th className="py-3 px-3.5">Conta / Meio na Planilha</th>
                        <th className="py-3 px-3.5">Categoria / Orçamento</th>
                        <th className="py-3 px-3.5 min-w-[220px]">Motivo da Não Importação</th>
                        <th className="py-3 px-3.5 text-center whitespace-nowrap">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUnimportedRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                            Nenhuma linha encontrada com o filtro aplicado.
                          </td>
                        </tr>
                      ) : (
                        filteredUnimportedRows.map((item) => (
                          <tr
                            key={item.rowIndex}
                            className="hover:bg-amber-50/60 transition-colors"
                          >
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                #{item.rowIndex}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 font-medium text-slate-700 whitespace-nowrap">
                              {item.dateFormatted}
                            </td>
                            <td className="py-3 px-3.5 font-semibold text-slate-900 max-w-[200px] truncate">
                              {item.description}
                            </td>
                            <td className="py-3 px-3.5 font-bold text-slate-800 tabular-nums whitespace-nowrap">
                              {formatCurrency(item.amount)}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {item.accountRaw || '(Não preenchido)'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-600">
                              <div className="flex flex-col gap-0.5">
                                <span>{item.categoryRaw || 'Sem categoria'}</span>
                                {item.responsibleRaw && (
                                  <span className="text-[10px] text-violet-700 font-medium">
                                    Resp: {item.responsibleRaw}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="flex items-start gap-1.5 text-rose-700 font-medium leading-tight">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>{item.reason}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              {item.type === 'error' ? (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] font-bold uppercase tracking-wider"
                                >
                                  Erro API
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 uppercase tracking-wider"
                                >
                                  Pulada
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-emerald-50/60 border-b border-emerald-200 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-950">
                  100% dos lançamentos foram importados com sucesso!
                </p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Nenhuma linha da planilha foi ignorada ou encontrou erros durante o processamento.
                </p>
              </div>
            </div>
          )}

          {/* Details list / Full execution logs */}
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Histórico Completo de Execução</h4>
                <p className="text-xs text-slate-500">
                  Registro passo a passo de todas as {importSummary.totalRows} linhas da planilha.
                </p>
              </div>

              <Link to={`/controle/${currentCompany?.id}/lancamentos`}>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 gap-2 w-full sm:w-auto">
                  <span>Abrir Extrato de Lançamentos</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
              {importSummary.details.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 flex items-start justify-between gap-3 ${
                    item.status === 'imported'
                      ? 'hover:bg-slate-50'
                      : item.status === 'skipped'
                        ? 'bg-amber-50/30 hover:bg-amber-50/60'
                        : 'bg-rose-50/30 hover:bg-rose-50/60'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {item.status === 'imported' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {item.status === 'skipped' && (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    {item.status === 'error' && (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">
                        Linha {item.row}: {item.description}
                      </span>
                      <p className="text-slate-500 text-[11px] mt-0.5">{item.message}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 uppercase tracking-wider ${
                      item.status === 'imported'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'skipped'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.status === 'imported'
                      ? 'Importado'
                      : item.status === 'skipped'
                        ? 'Pulado'
                        : 'Erro'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. Guidance and reference information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs text-slate-600">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Users className="w-4 h-4 text-violet-600" />
            <span>Responsáveis (Orçamento)</span>
          </div>
          <p className="text-slate-500 leading-relaxed">
            Mapeados da coluna "Orçamento" da planilha para identificar "de quem" é cada gasto:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {RESPONSIBLE_PERSONS.map((person) => (
              <span
                key={person}
                className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 font-medium border border-violet-100"
              >
                {person}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Contas Reconhecidas</span>
          </div>
          <p className="text-slate-500 leading-relaxed">
            O importador busca contas cadastradas pelo nome exato ou aproximado:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {dbAccounts.map((acc) => (
              <span
                key={acc.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                {acc.name}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Tag className="w-4 h-4 text-emerald-600" />
            <span>Categorias Padrão</span>
          </div>
          <p className="text-slate-500 leading-relaxed">
            Mapeamento inteligente baseado em palavras-chave da coluna Categoria e Descrição:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SYSTEM_CATEGORIES.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
