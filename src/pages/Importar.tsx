import { useState, useRef, useMemo, useEffect, ChangeEvent, DragEvent } from 'react'
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
  FileDown,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { useCompany } from '@/contexts/CompanyContext'
import { skipCloud } from '@/lib/skip-cloud'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatDateBR } from '@/lib/formatters'
import { Account, Category, Subcategory } from '@/types/database'
import {
  sleep,
  executeWithRetry as executeSharedRetry,
  runInPool,
  is429Error,
} from '@/lib/pocketbase/retry'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import {
  downloadTemplateXlsx,
  downloadTemplateCsv,
  exportTransactionsToXlsx,
} from '@/lib/import-template'
import { isParentTransaction } from '@/lib/transaction-propagation'
import { matchImportCategoryAndSubcategory } from '@/lib/import-category-matcher'

// 11 Standard categories recognized in the system
const SYSTEM_CATEGORIES = [
  'Despesa Fabrício',
  'Receita Fabrício',
  'Despesa Raffaela',
  'Receita Raffaela',
  'Investimento',
  'Pets',
  'Transporte',
  'Moradia',
  'Emanuel',
  'Família',
  'Fast Escova',
  'Helena',
  'Matheus',
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
  categoryRaw: string // Raw text in Excel "Categoria" column (user's subcategory)
  matchedCategoryName: string
  matchedCategoryId: string | null
  matchedCategoryType: 'despesa' | 'receita'
  matchedSubcategoryName: string
  matchedSubcategoryId: string | null
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
  if (value === null || value === undefined || value === '') {
    return ''
  }

  // If it's already a JS Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // If it's an Excel numeric serial date (e.g. 45292)
  if (typeof value === 'number') {
    // Excel base date offset: Excel counts from 1900-01-01 with a leap year bug
    // In UTC ms: (value - 25569) * 86400 * 1000
    const dateObj = new Date(Math.round((value - 25569) * 86400 * 1000))
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear()
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
      const d = String(dateObj.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
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

  // Try Date.parse if looks like a date string
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime()) && !/^\d+$/.test(str)) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return ''
}

// Parse numeric values (support Brazilian format R$ 1.234,56, 1234.56, negative parentheses, etc)
function parseExcelAmount(value: any): number {
  if (typeof value === 'number') return Math.abs(value)
  if (value === null || value === undefined || value === '') return 0

  let str = String(value).trim()
  // Remove currency symbol, spaces, non-numeric except . , and -
  str = str.replace(/[R$\s]/gi, '')

  // Se estiver entre parênteses como "(150,00)"
  if (str.startsWith('(') && str.endsWith(')')) {
    str = str.slice(1, -1)
  }

  // If format is like "1.234,56" or "1,234.56"
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // Formato brasileiro com milhar ponto e decimal vírgula: 1.234,56 -> 1234.56
      str = str.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato americano com milhar vírgula e decimal ponto: 1,234.56 -> 1234.56
      str = str.replace(/,/g, '')
    }
  } else if (str.includes(',')) {
    // Formato brasileiro padrão: "1234,56" -> "1234.56"
    str = str.replace(',', '.')
  }

  const num = parseFloat(str)
  return isNaN(num) ? 0 : Math.abs(num)
}

// Removida implementação antiga imprecisa em favor de matchImportCategoryAndSubcategory de @/lib/import-category-matcher

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

// Allowed recurrence select values in PocketBase transactions schema
const VALID_RECURRENCE_VALUES = new Set(['mensal', 'semanal', 'anual'])

/**
 * Sanitizes transaction create payload according to PocketBase transactions collection schema.
 * Prevents HTTP 400 validation errors (e.g. empty strings in relation/date/select fields, invalid enums).
 */
function sanitizeTransactionPayload(input: Record<string, any>): Record<string, any> {
  const validDate =
    typeof input.date === 'string' && input.date.trim()
      ? input.date.trim()
      : new Date().toISOString().slice(0, 10)

  const payload: Record<string, any> = {
    control_id: input.control_id,
    type: input.type === 'receita' ? 'receita' : 'despesa',
    amount: typeof input.amount === 'number' && !isNaN(input.amount) ? Math.abs(input.amount) : 0,
    description: String(input.description || 'Sem descrição').trim() || 'Sem descrição',
    date: validDate,
  }

  // Relations (must be non-empty string or omitted, never "")
  if (typeof input.account_id === 'string' && input.account_id.trim()) {
    payload.account_id = input.account_id.trim()
  }
  if (typeof input.category_id === 'string' && input.category_id.trim()) {
    payload.category_id = input.category_id.trim()
  }
  if (typeof input.subcategory_id === 'string' && input.subcategory_id.trim()) {
    payload.subcategory_id = input.subcategory_id.trim()
  }
  if (typeof input.credit_card_id === 'string' && input.credit_card_id.trim()) {
    payload.credit_card_id = input.credit_card_id.trim()
  }

  // Optional text fields
  if (typeof input.user_id === 'string' && input.user_id.trim()) {
    payload.user_id = input.user_id.trim()
  }
  if (typeof input.parent_transaction_id === 'string' && input.parent_transaction_id.trim()) {
    payload.parent_transaction_id = input.parent_transaction_id.trim()
  }
  if (typeof input.notes === 'string' && input.notes.trim()) {
    payload.notes = input.notes.trim()
  }

  // Dates: only include if valid non-empty string, never empty string ""
  if (typeof input.payment_date === 'string' && input.payment_date.trim()) {
    payload.payment_date = input.payment_date.trim()
  }

  // Booleans
  if (typeof input.paid === 'boolean') {
    payload.paid = input.paid
  }
  if (typeof input.is_recurring === 'boolean') {
    payload.is_recurring = input.is_recurring
  }
  if (typeof input.recurring === 'boolean') {
    payload.recurring = input.recurring
  }

  // Numbers (installments)
  if (typeof input.installment_number === 'number' && !isNaN(input.installment_number)) {
    payload.installment_number = input.installment_number
  }
  if (typeof input.installment_total === 'number' && !isNaN(input.installment_total)) {
    payload.installment_total = input.installment_total
  }

  // Recurrence select fields (mensal | semanal | anual) - ONLY if valid, never ""
  const recPeriod = input.recurrence_period || input.recurrence_type
  if (
    typeof recPeriod === 'string' &&
    VALID_RECURRENCE_VALUES.has(recPeriod.trim().toLowerCase())
  ) {
    const val = recPeriod.trim().toLowerCase()
    payload.recurrence_period = val
    payload.recurrence_type = val
  }

  return payload
}

/**
 * Formats error message from PocketBase API response for human display.
 * Extracts individual field validation details when available (e.g. "date: Cannot be blank").
 */
function sanitizeSubcategoryPayload(input: Record<string, any>): Record<string, any> {
  const payload: Record<string, any> = {
    control_id: input.control_id,
    category_id: input.category_id,
    name: String(input.name || 'Diversos').trim() || 'Diversos',
  }
  if (typeof input.color === 'string' && input.color.trim()) {
    payload.color = input.color.trim()
  }
  if (typeof input.icon === 'string' && input.icon.trim()) {
    payload.icon = input.icon.trim()
  }
  return payload
}

/**
 * Formats error message from PocketBase API response for human display.
 * Extracts individual field validation details when available (e.g. "date: Cannot be blank").
 */
function formatPocketBaseError(err: any): string {
  const isRateLimit =
    err?.status === 429 ||
    err?.statusCode === 429 ||
    err?.response?.status === 429 ||
    err?.message?.includes('429')

  if (isRateLimit || is429Error(err)) {
    return 'Limite de requisições do servidor atingido — reimporte esta linha ou tente novamente em instantes'
  }

  const fieldErrors = extractFieldErrors(err)
  const fieldKeys = Object.keys(fieldErrors)
  if (fieldKeys.length > 0) {
    const details = fieldKeys.map((f) => `${f}: ${fieldErrors[f]}`).join('; ')
    return `Validação recusada (${details})`
  }

  // Also check raw response.data if extractFieldErrors didn't catch due to structure
  const rawData = err?.response?.data || err?.data
  if (rawData && typeof rawData === 'object') {
    const parts: string[] = []
    for (const [k, v] of Object.entries(rawData)) {
      if (v && typeof v === 'object' && 'message' in v && (v as any).message) {
        parts.push(`${k}: ${(v as any).message}`)
      } else if (typeof v === 'string') {
        parts.push(`${k}: ${v}`)
      }
    }
    if (parts.length > 0) {
      return `Validação recusada (${parts.join('; ')})`
    }
  }

  if (err?.response?.message) {
    return err.response.message
  }

  if (err?.message) {
    return err.message
  }

  return 'Falha ao gravar no banco de dados.'
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
  const [dbSubcategories, setDbSubcategories] = useState<Subcategory[]>([])
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

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
      const [accs, cats, subs] = await Promise.all([
        pb.collection('accounts').getFullList<Account>({
          filter: `control_id="${companyId}"`,
          sort: 'name',
        }),
        pb.collection('categories').getFullList<Category>({
          filter: `control_id="${companyId}"`,
          sort: 'name',
        }),
        pb.collection('subcategories').getFullList<Subcategory>({
          filter: `control_id="${companyId}"`,
          sort: 'name',
        }),
      ])
      const sortedCats = [...cats].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
      )
      const sortedSubs = [...subs].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
      )
      setDbAccounts(accs)
      setDbCategories(sortedCats)
      setDbSubcategories(sortedSubs)
    } catch (e: any) {
      console.error('Erro ao buscar contas/categorias:', e)
      setErrorBanner('Erro ao carregar contas e categorias do controle ativo.')
    } finally {
      setIsLoadingMetadata(false)
    }
  }

  // Load metadata whenever currentCompany changes
  useEffect(() => {
    if (currentCompany?.id) {
      fetchControlMetadata(currentCompany.id)
    }
  }, [currentCompany?.id])

  // Estado para o diálogo de exportação com filtro de período
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportPeriodType, setExportPeriodType] = useState<'all' | 'custom'>('all')
  const [exportStartMonth, setExportStartMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [exportEndMonth, setExportEndMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Handler para exportar transações com base no período selecionado
  const handleExportTransactions = async () => {
    setIsExporting(true)
    const toastId = toast.loading('Buscando transações do controle para exportação...')

    try {
      // Garantir resolução do controle único
      let targetCompany = currentCompany
      if (!targetCompany?.id) {
        try {
          const single = await skipCloud.getSingleCompany()
          if (single) {
            targetCompany = single
          }
        } catch (e) {
          console.warn('Erro ao obter controle único para exportação:', e)
        }
      }

      if (!targetCompany?.id) {
        toast.dismiss(toastId)
        toast.error('Nenhum controle selecionado ou encontrado.')
        return
      }

      // Montar filtros
      const filterConditions: string[] = [`control_id = "${targetCompany.id}"`]
      let periodLabel = 'Todos os períodos'

      if (exportPeriodType === 'custom') {
        let startM = exportStartMonth
        let endM = exportEndMonth
        if (startM > endM) {
          // Se o usuário inverter início e fim, ajustamos automaticamente
          const tmp = startM
          startM = endM
          endM = tmp
        }

        const [startY, startMonthNum] = startM.split('-').map(Number)
        const [endY, endMonthNum] = endM.split('-').map(Number)

        const startDateStr = `${startY}-${String(startMonthNum).padStart(2, '0')}-01`
        // Último dia do mês final em formato YYYY-MM-DD
        const lastDayOfEndMonth = new Date(endY, endMonthNum, 0).getDate()
        const endDateStr = `${endY}-${String(endMonthNum).padStart(2, '0')}-${String(lastDayOfEndMonth).padStart(2, '0')}`

        filterConditions.push(`date >= "${startDateStr}"`)
        filterConditions.push(`date <= "${endDateStr}"`)

        if (startM === endM) {
          periodLabel = `${String(startMonthNum).padStart(2, '0')}/${startY}`
        } else {
          periodLabel = `${String(startMonthNum).padStart(2, '0')}/${startY} a ${String(endMonthNum).padStart(2, '0')}/${endY}`
        }
      }

      // Carregar transações correspondentes com expansões completas
      const records = await pb.collection('transactions').getFullList<any>({
        filter: filterConditions.join(' && '),
        sort: 'date',
        expand: 'account_id,category_id,subcategory_id',
      })

      if (records.length === 0) {
        toast.dismiss(toastId)
        toast.info(
          exportPeriodType === 'all'
            ? 'Nenhuma transação encontrada no controle para exportação.'
            : `Nenhuma transação encontrada no período selecionado (${periodLabel}).`,
        )
        setIsExportDialogOpen(false)
        return
      }

      // Filtrar registros pai consolidados da exportação
      const nonParentRecords = records.filter((r) => !isParentTransaction(r))

      if (nonParentRecords.length === 0) {
        toast.dismiss(toastId)
        toast.info(`Nenhuma transação elegível encontrada para o período (${periodLabel}).`)
        setIsExportDialogOpen(false)
        return
      }

      // Mapear registros com as expansões
      const formatted = nonParentRecords.map((r) => ({
        date: r.date,
        description: r.description,
        amount: Number(r.amount) || 0,
        type: r.type as 'receita' | 'despesa',
        account: r.expand?.account_id ? { name: r.expand.account_id.name } : undefined,
        category: r.expand?.category_id ? { name: r.expand.category_id.name } : undefined,
        subcategory: r.expand?.subcategory_id ? { name: r.expand.subcategory_id.name } : undefined,
        installment_number: r.installment_number,
        installments_total: r.installments_total,
        installment_total: r.installment_total,
        is_recurring: r.is_recurring,
        recurring: r.recurring,
        recurrence_type: r.recurrence_type,
        recurrence_period: r.recurrence_period,
        paid: r.paid,
      }))

      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const safeName = (targetCompany.name || 'controle')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')

      const safePeriodPart =
        exportPeriodType === 'custom'
          ? `-${exportStartMonth === exportEndMonth ? exportStartMonth : `${exportStartMonth}-a-${exportEndMonth}`}`
          : '-todos-periodos'

      const fileName = `lancamentos-${safeName}${safePeriodPart}-${yyyy}${mm}${dd}.xlsx`

      exportTransactionsToXlsx(formatted, fileName)
      toast.dismiss(toastId)
      toast.success(
        `Planilha exportada com sucesso! ${formatted.length} lançamento${formatted.length > 1 ? 's' : ''} (${periodLabel}) salvo${formatted.length > 1 ? 's' : ''} em ${fileName}.`,
        { duration: 6000 },
      )
      setIsExportDialogOpen(false)
    } catch (err: any) {
      toast.dismiss(toastId)
      console.error('Erro ao exportar transações:', err)
      toast.error(err?.message || 'Erro ao exportar transações para planilha.')
    } finally {
      setIsExporting(false)
    }
  }

  // Handle uploaded file
  const processFile = (file: File) => {
    setErrorBanner(null)
    setImportSummary(null)
    setParsedRows([])

    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorBanner(
        'Formato de arquivo inválido. Por favor, envie uma planilha Excel (.xlsx ou .xls) ou arquivo CSV (.csv).',
      )
      return
    }

    setFileName(file.name)
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const isCsv = file.name.toLowerCase().endsWith('.csv')
        const wb = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false,
          raw: !isCsv,
          codepage: isCsv ? 65001 : undefined, // UTF-8
        })
        setWorkbook(wb)
        setSheetNames(wb.SheetNames)
        if (wb.SheetNames.length > 0) {
          setSelectedSheet(wb.SheetNames[0])
          parseSheetData(wb, wb.SheetNames[0], dbAccounts, dbCategories, dbSubcategories)
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
    subcategoriesList: Subcategory[],
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
      // Find columns by flexible names (ignores accents, case, spaces, symbols)
      const getVal = (...keys: string[]) => {
        const rowKeys = Object.keys(row)
        for (const k of keys) {
          const normTarget = normalizeText(k)
          // 1. Busca correspondência exata normalizada
          const matchKey = rowKeys.find((rk) => normalizeText(rk) === normTarget)
          if (matchKey && row[matchKey] !== undefined && row[matchKey] !== '') {
            return row[matchKey]
          }
          // 2. Busca correspondência contida (ex: "data do lançamento" ou "valor r$")
          const looseKey = rowKeys.find((rk) => {
            const norm = normalizeText(rk)
            return norm.includes(normTarget) || normTarget.includes(norm)
          })
          if (looseKey && row[looseKey] !== undefined && row[looseKey] !== '') {
            return row[looseKey]
          }
        }
        return ''
      }

      const paidVal = getVal(
        'Pago',
        'Status',
        'Quitado',
        'Liquidado',
        'Pago?',
        'Status de Pagamento',
        'Paid',
      )
      // Column candidates com ampla tolerância a variações de digitação e termos
      const dateVal = getVal(
        'Data',
        'Date',
        'Dt',
        'Dia',
        'Data Lançamento',
        'Data do Lançamento',
        'Data Lancamento',
        'Data da Transacao',
        'Data Transação',
      )
      const descVal = getVal(
        'Descrição',
        'Descricao',
        'Descriçao',
        'Descricao do Lancamento',
        'Desc',
        'Histórico',
        'Historico',
        'Nome',
        'Título',
        'Titulo',
        'Lançamento',
        'Lancamento',
        'Item',
        'Detalhe',
        'Estabelecimento',
      )
      const amountVal = getVal(
        'Valor',
        'Valor (R$)',
        'Valor R$',
        'Quantia',
        'Total',
        'Amount',
        'Preço',
        'Preco',
        'Valor da Parcela',
        'Valor Total',
      )
      const accountVal = getVal(
        'Meio de pagamento',
        'Meio Pagamento',
        'Tipo de Pagamento',
        'Tipo Pagamento',
        'Forma de Pagamento',
        'Forma Pagamento',
        'Conta',
        'Cartão',
        'Cartao',
        'Banco',
        'Origem',
        'Payment Method',
        'Conta / Cartão',
        'Cartão de Crédito',
      )
      const catVal = getVal(
        'Categoria',
        'Category',
        'Subcategoria',
        'Sub-categoria',
        'Classificação',
        'Classificacao',
        'Grupo',
      )
      const typeVal = getVal(
        'Tipo',
        'Tipo Lançamento',
        'Tipo Lancamento',
        'Tipo Transação',
        'Tipo Transacao',
        'Natureza',
        'D/C',
        'Operação',
        'Operacao',
        'Entrada/Saída',
      )
      const budgetVal = getVal(
        'Orçamento',
        'Orcamento',
        'Budget',
        'Centro de Custo',
        'Centro de Custo / Orçamento',
        'Macro Categoria',
        'Categoria Macro',
        'Pessoa / Orçamento',
      )
      const parcelasVal = getVal(
        'Parcelas',
        'Parcela',
        'Qtd Parcelas',
        'Plano',
        'Nº Parcela',
        'No Parcela',
        'Num Parcela',
        'Parcelamento',
        'Qtd de Parcelas',
      )
      const recurrenceVal = getVal(
        'Recorrência',
        'Recorrencia',
        'Frequência',
        'Frequencia',
        'Periodicidade',
        'Repetição',
        'Repeticao',
        'Recorrente',
      )

      const description = String(descVal || 'Sem descrição').trim()
      const amount = parseExcelAmount(amountVal)
      const dateFormatted = parseExcelDate(dateVal)
      const paymentMethodRaw = String(accountVal || '').trim()
      const categoryRaw = String(catVal || '').trim()
      const budgetRaw = String(budgetVal || '').trim()

      // Account match
      const matchedAccount = matchAccount(paymentMethodRaw, accountsList)

      // Category & Subcategory match (filtrado estritamente pelo tipo da linha: receita vs despesa)
      const mapped = matchImportCategoryAndSubcategory({
        rawCategoryCol: categoryRaw,
        rawDescription: description,
        rawType: String(typeVal),
        rawBudgetCol: budgetRaw,
        categories: categoriesList,
        subcategories: subcategoriesList,
      })

      const matchedCatRecord =
        (mapped.categoryId ? categoriesList.find((c) => c.id === mapped.categoryId) : null) ||
        categoriesList.find(
          (c) =>
            normalizeText(c.name) === normalizeText(mapped.categoryName) && c.type === mapped.type,
        ) ||
        null

      // Try matching subcategory in DB
      let matchedSubRecord: Subcategory | null = null
      if (mapped.subcategoryId) {
        matchedSubRecord = subcategoriesList.find((s) => s.id === mapped.subcategoryId) || null
      } else if (matchedCatRecord && mapped.subcategoryName) {
        matchedSubRecord =
          subcategoriesList.find(
            (s) =>
              s.category_id === matchedCatRecord.id &&
              normalizeText(s.name) === normalizeText(mapped.subcategoryName),
          ) || null
      }

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
      // Interpretar campo Pago se informado (Sim/Não, Pago/Pendente, True/False)
      let parsedPaid = true
      if (paidVal !== '') {
        const normPaid = normalizeText(String(paidVal))
        if (
          normPaid === 'nao' ||
          normPaid === 'não' ||
          normPaid === 'pendente' ||
          normPaid === 'falso' ||
          normPaid === 'false' ||
          normPaid === '0' ||
          normPaid === 'a pagar' ||
          normPaid === 'a receber'
        ) {
          parsedPaid = false
        }
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
        matchedCategoryName: mapped.categoryName,
        matchedCategoryId: matchedCatRecord?.id || null,
        matchedCategoryType: mapped.type,
        matchedSubcategoryName: mapped.subcategoryName,
        matchedSubcategoryId: matchedSubRecord?.id || null,
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
        isPaid: parsedPaid,
      } as any)
    })

    setParsedRows(rows)
  }

  // Switch active sheet
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName)
    if (workbook) {
      parseSheetData(workbook, sheetName, dbAccounts, dbCategories, dbSubcategories)
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
    try {
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

      // Helpers for rate limiting and backoff retry on 429 (Too Many Requests)
      const executeWithRetry = <T,>(fn: () => Promise<T>) =>
        executeSharedRetry(fn, 5, 1000, 'Importar', 10000)

      // Ensure we have real category & subcategory IDs for this control BEFORE starting import
      let freshCategories: Category[] = []
      let freshSubcategories: Subcategory[] = []

      try {
        const results = await Promise.all([
          executeWithRetry(() =>
            pb.collection('categories').getFullList<Category>({
              filter: `control_id="${currentCompany.id}"`,
            }),
          ).catch((err) => {
            console.warn('Não foi possível pré-carregar categorias:', err)
            return dbCategories
          }),
          executeWithRetry(() =>
            pb.collection('subcategories').getFullList<Subcategory>({
              filter: `control_id="${currentCompany.id}"`,
            }),
          ).catch((err) => {
            console.warn('Não foi possível pré-carregar subcategorias:', err)
            return dbSubcategories
          }),
        ])
        freshCategories = results[0]
        freshSubcategories = results[1]
      } catch (preloadErr) {
        console.warn(
          'Erro ao pré-carregar dados para importação, usando dados locais em cache:',
          preloadErr,
        )
        freshCategories = dbCategories
        freshSubcategories = dbSubcategories
      }

      const getCatId = (name: string, _type: 'despesa' | 'receita'): string => {
        // Filtrar SEMPRE apenas categorias que coincidem com o tipo da linha (_type)
        const allowed = freshCategories.filter((c) => c.type === _type)
        if (allowed.length === 0) {
          // Se não houver categorias do tipo, fallback de emergência
          return freshCategories[0]?.id || ''
        }

        // 1. Exact match by name & type
        const exactWithType = allowed.find((c) => normalizeText(c.name) === normalizeText(name))
        if (exactWithType) return exactWithType.id

        // 2. Loose/contains match strictly within allowed type
        const looseMatch = allowed.find(
          (c) =>
            normalizeText(c.name).includes(normalizeText(name)) ||
            normalizeText(name).includes(normalizeText(c.name)),
        )
        if (looseMatch) return looseMatch.id

        // 3. Fallback semântico preferencial por tipo
        if (_type === 'receita') {
          const defaultRec = allowed.find((c) => normalizeText(c.name).includes('fabricio'))
          if (defaultRec) return defaultRec.id
        } else {
          const defaultDesp = allowed.find((c) => normalizeText(c.name).includes('fabricio'))
          if (defaultDesp) return defaultDesp.id
        }

        // 4. Fallback para a primeira categoria permitida do tipo correto
        return allowed[0]?.id || ''
      }

      // Cache of subcategories so we can dynamically auto-create if missing
      const subcatsCache: Subcategory[] = [...freshSubcategories]
      const getOrCreateSubcategoryId = async (
        categoryId: string,
        subName: string,
      ): Promise<string> => {
        if (!categoryId || !subName.trim()) return ''
        const existing = subcatsCache.find(
          (s) => s.category_id === categoryId && normalizeText(s.name) === normalizeText(subName),
        )
        if (existing) return existing.id

        // Create new subcategory automatically
        try {
          const subPayload = sanitizeSubcategoryPayload({
            control_id: currentCompany.id,
            category_id: categoryId,
            name: subName.trim(),
          })
          const created = await executeWithRetry(() =>
            pb.collection('subcategories').create<Subcategory>(subPayload),
          )
          subcatsCache.push(created)
          return created.id
        } catch (err) {
          console.warn('Erro ao auto-criar subcategoria:', formatPocketBaseError(err))
          return ''
        }
      }

      // 1. Pré-processamento e deduplicação de subcategorias necessárias para criar antes do envio em massa
      const missingSubcatMap = new Map<string, { categoryId: string; subName: string }>()
      for (const row of parsedRows) {
        if (!row.isValid || !row.matchedAccount) continue
        const categoryId =
          row.matchedCategoryId || getCatId(row.matchedCategoryName, row.matchedCategoryType)
        const subName = row.matchedSubcategoryName?.trim()
        if (categoryId && subName && !row.matchedSubcategoryId) {
          const key = `${categoryId}:::${normalizeText(subName)}`
          if (!missingSubcatMap.has(key)) {
            missingSubcatMap.set(key, { categoryId, subName })
          }
        }
      }

      for (const { categoryId, subName } of missingSubcatMap.values()) {
        await getOrCreateSubcategoryId(categoryId, subName)
      }

      // 2. Preparar todas as linhas em memória (validação prévia, payloads sanitizados)
      interface PreparedRowWork {
        row: (typeof parsedRows)[0]
        categoryId: string
        subcategoryId?: string
        caseType: 'installment_explicit' | 'installment_plan' | 'single'
        // Payloads sanitizados prontos
        payloads: any[]
        balanceDeltas: Array<{ accountId: string; accountType: string; delta: number }>
      }

      const rowsToProcess: PreparedRowWork[] = []
      let completedRows = 0

      for (const row of parsedRows) {
        // Checar linhas inválidas / puladas antes do envio
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
            reason,
            type: 'skipped',
            rawDetails: row.raw,
          })
          completedRows++
          setImportProgress({ current: completedRows, total: parsedRows.length })
          continue
        }

        const categoryId =
          row.matchedCategoryId || getCatId(row.matchedCategoryName, row.matchedCategoryType)
        const subName = row.matchedSubcategoryName?.trim()
        const subcategoryId =
          row.matchedSubcategoryId ||
          (categoryId && subName
            ? subcatsCache.find(
                (s) =>
                  s.category_id === categoryId && normalizeText(s.name) === normalizeText(subName),
              )?.id
            : undefined)

        const acc = row.matchedAccount
        const isExpense = row.matchedCategoryType === 'despesa'

        if (
          row.totalInstallments &&
          row.totalInstallments > 1 &&
          row.installmentNumber !== null &&
          row.installmentNumber > 0
        ) {
          // Caso A: Parcela explícita com registro pai
          const totalInst = row.totalInstallments
          const currentInst = row.installmentNumber
          const unitAmount = row.amount
          const totalEstimatedAmount = Math.round(unitAmount * totalInst * 100) / 100

          const parentPayload = sanitizeTransactionPayload({
            control_id: currentCompany.id,
            user_id: currentUserId,
            type: row.matchedCategoryType,
            amount: totalEstimatedAmount,
            description: `${row.description} (Total: ${formatCurrency(totalEstimatedAmount)})`,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            account_id: acc.id,
            date: row.dateFormatted,
            payment_date: row.dateFormatted,
            paid: true,
            is_recurring: false,
            recurring: false,
            installment_total: totalInst,
            installment_number: 0,
            notes: `Importado de planilha: registro pai consolidado (${totalInst}x)`,
          })

          const instPayload = sanitizeTransactionPayload({
            control_id: currentCompany.id,
            user_id: currentUserId,
            type: row.matchedCategoryType,
            amount: unitAmount,
            description: `${row.description} (${currentInst}/${totalInst})`,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            account_id: acc.id,
            date: row.dateFormatted,
            payment_date: row.dateFormatted,
            paid: true,
            is_recurring: false,
            recurring: false,
            installment_total: totalInst,
            installment_number: currentInst,
            notes: `Importado de planilha: parcela ${currentInst}/${totalInst}`,
          })

          const delta =
            acc.type === 'credito'
              ? isExpense
                ? unitAmount
                : -unitAmount
              : isExpense
                ? -unitAmount
                : unitAmount

          rowsToProcess.push({
            row,
            categoryId,
            subcategoryId,
            caseType: 'installment_explicit',
            payloads: [parentPayload, instPayload],
            balanceDeltas: [{ accountId: acc.id, accountType: acc.type, delta }],
          })
        } else if (
          row.totalInstallments &&
          row.totalInstallments > 1 &&
          (!row.installmentNumber || row.installmentNumber === 0)
        ) {
          // Caso B: Parcelamento automático de 1 a N
          const totalInst = row.totalInstallments
          const baseAmount = Math.round((row.amount / totalInst) * 100) / 100
          const remainder = Math.round((row.amount - baseAmount * totalInst) * 100) / 100

          const payloads: any[] = []
          for (let inst = 1; inst <= totalInst; inst++) {
            const parcelAmount =
              inst === 1 ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount
            const instDate = addMonths(row.dateFormatted, inst - 1)
            payloads.push(
              sanitizeTransactionPayload({
                control_id: currentCompany.id,
                user_id: currentUserId,
                type: row.matchedCategoryType,
                amount: parcelAmount,
                description: `${row.description} (${inst}/${totalInst})`,
                category_id: categoryId,
                subcategory_id: subcategoryId,
                account_id: acc.id,
                date: instDate,
                payment_date: instDate,
                paid: true,
                is_recurring: false,
                recurring: false,
                installment_total: totalInst,
                installment_number: inst,
                notes: 'Importado de planilha via parcelamento automático',
              }),
            )
          }

          const delta =
            acc.type === 'credito'
              ? isExpense
                ? row.amount
                : -row.amount
              : isExpense
                ? -row.amount
                : row.amount

          rowsToProcess.push({
            row,
            categoryId,
            subcategoryId,
            caseType: 'installment_plan',
            payloads,
            balanceDeltas: [{ accountId: acc.id, accountType: acc.type, delta }],
          })
        } else {
          // Caso C: Lançamento avulso / simples
          const isPaid = (row as any).isPaid !== undefined ? (row as any).isPaid : true
          const singlePayload = sanitizeTransactionPayload({
            control_id: currentCompany.id,
            user_id: currentUserId,
            type: row.matchedCategoryType,
            amount: row.amount,
            description: row.description,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            account_id: acc.id,
            date: row.dateFormatted,
            payment_date: row.dateFormatted,
            paid: isPaid,
            is_recurring: Boolean(row.isRecurring),
            recurring: Boolean(row.isRecurring),
            recurrence_type: row.recurrenceType || undefined,
            recurrence_period: row.recurrenceType || undefined,
            installment_number: 1,
            notes: row.isRecurring
              ? `Importado de planilha (Recorrente ${row.recurrenceType || 'mensal'})`
              : 'Importado de planilha',
          })

          const delta =
            acc.type === 'credito'
              ? isExpense
                ? row.amount
                : -row.amount
              : isExpense
                ? -row.amount
                : row.amount

          rowsToProcess.push({
            row,
            categoryId,
            subcategoryId,
            caseType: 'single',
            payloads: [singlePayload],
            balanceDeltas: [{ accountId: acc.id, accountType: acc.type, delta }],
          })
        }
      }

      // Mapa para acumular deltas agregados de saldo de contas ao longo da importação bem-sucedida
      const accountBalanceDeltas = new Map<string, number>()

      // 3. Execução em pool com concorrência limitada (4) e executeWithRetry anti-429
      await runInPool(
        rowsToProcess,
        async (work) => {
          const { row, caseType, payloads, balanceDeltas } = work
          try {
            if (caseType === 'installment_explicit') {
              // Cria pai
              const parentRecord = await executeWithRetry(() =>
                pb.collection('transactions').create(payloads[0]),
              )
              summary.createdTransactions++

              // Cria parcela com vínculo ao pai
              const childPayload = {
                ...payloads[1],
                parent_transaction_id: parentRecord.id,
              }
              await executeWithRetry(() => pb.collection('transactions').create(childPayload))
              summary.createdTransactions++

              summary.importedCount++
              summary.details.push({
                row: row.rowIndex,
                description: row.description,
                status: 'imported',
                message: `Parcela ${row.installmentNumber}/${row.totalInstallments} criada com vínculo pai.`,
              })
            } else if (caseType === 'installment_plan') {
              let parentId = ''
              for (let inst = 0; inst < payloads.length; inst++) {
                const payload = { ...payloads[inst] }
                if (inst > 0 && parentId) {
                  payload.parent_transaction_id = parentId
                }
                const rec = await executeWithRetry(() =>
                  pb.collection('transactions').create(payload),
                )
                summary.createdTransactions++

                if (inst === 0) {
                  parentId = rec.id
                  try {
                    await executeWithRetry(() =>
                      pb.collection('transactions').update(rec.id, {
                        parent_transaction_id: parentId,
                      }),
                    )
                  } catch (updateErr) {
                    console.warn(
                      'Erro ao auto-vincular parent_transaction_id na parcela 1:',
                      updateErr,
                    )
                  }
                }
              }

              summary.importedCount++
              summary.details.push({
                row: row.rowIndex,
                description: row.description,
                status: 'imported',
                message: `Plano de ${row.totalInstallments} parcelas gerado com sucesso.`,
              })
            } else {
              // Single
              await executeWithRetry(() => pb.collection('transactions').create(payloads[0]))
              summary.createdTransactions++
              summary.importedCount++
              summary.details.push({
                row: row.rowIndex,
                description: row.description,
                status: 'imported',
                message: 'Importado com sucesso.',
              })
            }

            // Acumular deltas das contas afetadas
            for (const b of balanceDeltas) {
              const current = accountBalanceDeltas.get(b.accountId) || 0
              accountBalanceDeltas.set(b.accountId, current + b.delta)
            }
          } catch (err: any) {
            console.error(`Erro ao importar linha ${row.rowIndex}:`, err)
            summary.errorsCount++
            const formattedReason = is429Error(err)
              ? 'Limite de requisições do servidor atingido — reimporte esta linha ou tente novamente em instantes'
              : formatPocketBaseError(err)

            summary.details.push({
              row: row.rowIndex,
              description: row.description,
              status: 'error',
              message: formattedReason,
            })
            summary.unimportedRows.push({
              rowIndex: row.rowIndex,
              dateFormatted: row.dateFormatted,
              description: row.description || 'Sem descrição',
              amount: row.amount,
              accountRaw: row.accountRaw,
              categoryRaw: row.categoryRaw,
              reason: formattedReason,
              type: 'error',
              rawDetails: row.raw,
            })
          } finally {
            completedRows++
            setImportProgress({ current: completedRows, total: parsedRows.length })
          }
        },
        { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'Importar-Pool' },
      )

      // 4. Recálculo agregado final de saldos das contas em uma única passada concorrente
      if (accountBalanceDeltas.size > 0) {
        const deltaEntries = Array.from(accountBalanceDeltas.entries())
        await runInPool(
          deltaEntries,
          async ([accountId, delta]) => {
            try {
              const acc = await executeWithRetry(() =>
                pb.collection('accounts').getOne<{ id: string; balance: number }>(accountId),
              )
              const newBalance = Math.round(((Number(acc.balance) || 0) + delta) * 100) / 100
              await executeWithRetry(() =>
                pb.collection('accounts').update(accountId, { balance: newBalance }),
              )
            } catch (accErr) {
              console.warn(`Erro ao atualizar saldo consolidado da conta ${accountId}:`, accErr)
            }
          },
          { concurrency: 4, delayBetweenBatchesMs: 15, tag: 'Importar-SaldoConsolidado' },
        )
      }

      setImportSummary(summary)
      setIsImporting(false)
      // Reload global company state to reflect new data across Dashboard and Transactions
      try {
        await reloadCompanyData()
      } catch (reloadErr) {
        console.warn('Erro não bloqueante ao atualizar dados da empresa pós-importação:', reloadErr)
      }
    } catch (unexpectedErr: any) {
      console.error('Erro inesperado no processo de importação:', unexpectedErr)
      setErrorBanner(formatPocketBaseError(unexpectedErr))
      setIsImporting(false)
    }
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
        normalizeText(item.reason).includes(q)
      )
    })
  }, [importSummary, unimportedFilter, unimportedSearch])

  // Copy unimported lines to clipboard as structured text/CSV
  const handleCopyUnimported = (format: 'text' | 'csv' = 'text') => {
    if (!importSummary || importSummary.unimportedRows.length === 0) return

    let content = ''
    if (format === 'csv') {
      content = [
        'Linha;Data;Descrição;Valor;Conta/Meio;Categoria;Motivo;Tipo Falha',
        ...importSummary.unimportedRows.map(
          (r) =>
            `${r.rowIndex};${r.dateFormatted};"${r.description.replace(/"/g, '""')}";${r.amount};"${r.accountRaw.replace(/"/g, '""')}";"${r.categoryRaw.replace(/"/g, '""')}";"${r.reason.replace(/"/g, '""')}";${r.type === 'skipped' ? 'Pulada (Dados/Conta)' : 'Erro API'}`,
        ),
      ].join('\n')
    } else {
      content = [
        `RELATÓRIO DE LINHAS NÃO IMPORTADAS - PLANILHA: ${fileName || 'Excel'} (Aba: ${selectedSheet})`,
        `Total Não Importadas: ${importSummary.unimportedRows.length} de ${importSummary.totalRows} (${importSummary.skippedCount} dados inválidos, ${importSummary.errorsCount} erros)`,
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

    const headers = 'Linha;Data;Descrição;Valor;Conta / Meio;Categoria;Motivo;Tipo Falha\n'
    const rows = importSummary.unimportedRows
      .map(
        (r) =>
          `${r.rowIndex};${r.dateFormatted};"${r.description.replace(/"/g, '""')}";${r.amount};"${r.accountRaw.replace(/"/g, '""')}";"${r.categoryRaw.replace(/"/g, '""')}";"${r.reason.replace(/"/g, '""')}";${r.type === 'skipped' ? 'Pulada' : 'Erro API'}`,
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

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => setIsExportDialogOpen(true)}
            disabled={isExporting}
            className="rounded-xl h-10 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exportando...' : 'Exportar para Planilha (.xlsx)'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              downloadTemplateXlsx(dbAccounts, dbCategories, dbSubcategories)
              toast.success('Modelo de planilha (.xlsx) baixado com sucesso!')
            }}
            className="rounded-xl h-10 gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold">Baixar Modelo (.xlsx)</span>
          </Button>

          <Link to="/lancamentos">
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
          accept=".xlsx, .xls, .csv"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 shadow-inner">
          <Upload className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-bold text-slate-800 mb-1">
          {fileName ? fileName : 'Arraste e solte seu arquivo Excel ou CSV aqui'}
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
          Suporte completo para arquivos <strong className="text-slate-700">.xlsx</strong> e{' '}
          <strong className="text-slate-700">.csv</strong> com múltiplas abas, parcelamento e meios
          de pagamento.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-6 shadow-md shadow-indigo-600/20 font-semibold"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {fileName ? 'Trocar de Arquivo' : 'Selecionar Arquivo (.xlsx / .csv)'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              downloadTemplateXlsx(dbAccounts, dbCategories, dbSubcategories)
              toast.success('Modelo de planilha (.xlsx) baixado com sucesso!')
            }}
            className="rounded-xl h-11 px-5 border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-700 font-semibold gap-2"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span>Baixar Modelo de Planilha</span>
          </Button>
        </div>

        {/* Formats notice & secondary template link */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Formato Exato Esperado
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              downloadTemplateXlsx(dbAccounts, dbCategories, dbSubcategories)
              toast.success('Modelo .xlsx baixado!')
            }}
            className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline inline-flex items-center gap-1"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Baixar .xlsx (com abas JAN e Instruções)</span>
          </button>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              downloadTemplateCsv(dbAccounts, dbCategories, dbSubcategories)
              toast.success('Modelo .csv baixado!')
            }}
            className="text-slate-600 hover:text-slate-800 font-medium hover:underline inline-flex items-center gap-1"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Baixar versão .csv</span>
          </button>
        </div>
      </div>

      {/* Card explicativo com dicas do modelo */}
      <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 sm:p-5 text-xs text-slate-600 space-y-3">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Como preencher a planilha para importar perfeitamente</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => downloadTemplateXlsx(dbAccounts, dbCategories, dbSubcategories)}
              className="h-8 text-xs font-semibold rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Modelo .xlsx</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => downloadTemplateCsv(dbAccounts, dbCategories, dbSubcategories)}
              className="h-8 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-200/60 gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Baixar .csv</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white p-3 rounded-xl border border-slate-200/70">
            <p className="font-semibold text-slate-800 mb-1">📅 Coluna Data</p>
            <p className="text-slate-500">
              Aceita{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">18/01/2026</code> ou{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">2026-01-18</code> ou
              datas do Excel.
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/70">
            <p className="font-semibold text-slate-800 mb-1">💳 Meio de Pagamento</p>
            <p className="text-slate-500">
              Nome de uma conta ativa:{' '}
              {dbAccounts.length > 0
                ? dbAccounts
                    .slice(0, 3)
                    .map((a) => a.name)
                    .join(', ')
                : 'Neon Fabrício, Santander Fabrício Crédito'}
              .
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/70">
            <p className="font-semibold text-slate-800 mb-1">🔢 Parcelas & Recorrência</p>
            <p className="text-slate-500">
              Parcelado use{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">02/10</code> na
              coluna Parcelas. Recorrente use{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">Mensal</code>.
            </p>
          </div>
        </div>
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
                  <th className="py-3 px-4">Categoria / Subcategoria</th>
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
                      {formatDateBR(row.dateFormatted)}
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
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 w-fit">
                          <Tag className="w-3 h-3 text-indigo-500" />
                          {row.matchedCategoryName}
                        </span>
                        {row.matchedSubcategoryName && (
                          <span className="text-[11px] text-slate-500 pl-1 font-medium">
                            ↳ {row.matchedSubcategoryName}
                          </span>
                        )}
                      </div>
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
                <span className="text-[11px] text-slate-400 font-medium">Linhas da Aba</span>
                <p className="text-xl font-bold text-white mt-0.5">{importSummary.totalRows}</p>
              </div>
              <div className="bg-emerald-950/40 rounded-xl p-3 border border-emerald-800/60">
                <span className="text-[11px] text-emerald-400 font-medium">Importadas</span>
                <p className="text-xl font-bold text-emerald-300 mt-0.5">
                  {importSummary.importedCount}
                </p>
              </div>
              <div className="bg-amber-950/40 rounded-xl p-3 border border-amber-800/60">
                <span className="text-[11px] text-amber-400 font-medium">Dados Inválidos</span>
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
                    Dados Inválidos ({importSummary.skippedCount})
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
                        <th className="py-3 px-3.5">Categoria</th>
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
                              {formatDateBR(item.dateFormatted)}
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
                                  Dados Inválidos
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

              <Link to="/lancamentos">
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
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs text-slate-600">
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

      {/* Modal / Dialog de Exportação com Seleção de Período */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Download className="w-5 h-5 text-emerald-600" />
              <span>Exportar para Planilha (.xlsx)</span>
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs pt-1">
              Escolha se deseja exportar todas as transações cadastradas no controle ou apenas as de
              um período específico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Opções de período */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Período de Exportação</Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setExportPeriodType('all')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    exportPeriodType === 'all'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Todos os períodos</span>
                    {exportPeriodType === 'all' && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">Histórico completo do controle</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportPeriodType('custom')}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    exportPeriodType === 'custom'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs">Período Específico</span>
                    {exportPeriodType === 'custom' && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">Filtrar por mês ou intervalo</span>
                </button>
              </div>
            </div>

            {/* Campos de mês quando customizado */}
            {exportPeriodType === 'custom' && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label
                      htmlFor="exportStartMonth"
                      className="text-[11px] font-semibold text-slate-700 mb-1 block"
                    >
                      Mês Início
                    </Label>
                    <Input
                      id="exportStartMonth"
                      type="month"
                      value={exportStartMonth}
                      onChange={(e) => setExportStartMonth(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="exportEndMonth"
                      className="text-[11px] font-semibold text-slate-700 mb-1 block"
                    >
                      Mês Fim
                    </Label>
                    <Input
                      id="exportEndMonth"
                      type="month"
                      value={exportEndMonth}
                      onChange={(e) => setExportEndMonth(e.target.value)}
                      className="h-9 text-xs bg-white border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                  <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>
                    Para exportar apenas um único mês, selecione o mesmo mês no início e no fim.
                  </span>
                </div>
              </div>
            )}

            {/* Formato de compatibilidade */}
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex items-start gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                O arquivo gerado inclui todas as colunas necessárias para reimportação: Data,
                Descrição, Valor, Meio de Pagamento, Categoria, Subcategoria, Tipo, Parcelas,
                Recorrência e Pago.
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsExportDialogOpen(false)}
              disabled={isExporting}
              className="rounded-xl h-10 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleExportTransactions}
              disabled={isExporting}
              className="rounded-xl h-10 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold text-xs"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Planilha...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar Planilha (.xlsx)</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
