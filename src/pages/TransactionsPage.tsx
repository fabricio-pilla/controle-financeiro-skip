import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import { TransactionModal } from '@/components/transactions/TransactionModal'
import { AiTransactionModal } from '@/components/transactions/AiTransactionModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  RecurrencePropagationModal,
  PropagationChoice,
} from '@/components/transactions/RecurrencePropagationModal'
import { CloseMonthModal } from '@/components/dashboard/CloseMonthModal'
import {
  isInstallmentTransaction,
  isRecurringTransaction,
  findInstallmentGroup,
  findRecurringSeries,
  deleteTransactionWithPropagation,
  isParentTransaction,
} from '@/lib/transaction-propagation'
import { sleep } from '@/lib/pocketbase/retry'
import pb from '@/lib/pocketbase/client'
import { cleanDescription } from '@/lib/recurring-generation'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { formatCurrency, formatDateBR, getTxEffectiveDate } from '@/lib/formatters'
import { cleanNotesForDisplay } from '@/lib/ai-learning-tracker'
import { Transaction, TransactionType } from '@/types/database'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Repeat,
  Package,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Calendar,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { MonthNavigator } from '@/components/common/MonthNavigator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function TransactionsPage() {
  const {
    currentCompany,
    transactions,
    accounts,
    categories,
    deleteTransaction,
    setTransactionsPaidStatus,
    applyTransactionsBatchUpdate,
    isOwner,
    isAdmin,
    isViewer,
    canManageTransactions,
    reloadCompanyData,
    loadTransactionsForMonth,
    loadAllTransactions,
    invalidateTransactionsCache,
    searchTransactionsServer,
  } = useCompany()
  const { user: currentUser } = useAuth()

  const canManageSingleTx = useCallback(
    (tx: Transaction) => {
      if (isViewer) return false
      if (isOwner || isAdmin) return true
      if (currentUser?.id && tx.user_id && tx.user_id === currentUser.id) return true
      // Se não tem user_id vinculado ou o usuário for membro regular, restringe
      return false
    },
    [isViewer, isOwner, isAdmin, currentUser],
  )

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<
    'all' | 'a_vista' | 'parcelado' | 'recorrente'
  >('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [searchParams] = useSearchParams()

  const [accountFilter, setAccountFilter] = useState<string>(() => {
    return searchParams.get('account') || 'all'
  })
  const [categoryFilter, setCategoryFilter] = useState<string>(() => {
    return searchParams.get('category') || 'all'
  })
  // Default month filter to current month ("YYYY-MM") or from search param
  const currentMonthStr = useMemo(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  }, [])

  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const paramMonth = searchParams.get('month')
    if (paramMonth) return paramMonth
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  }) // 'all' or 'YYYY-MM' (default to current month)

  // Atualizar filtros se os query params mudarem
  useEffect(() => {
    const cat = searchParams.get('category')
    if (cat) setCategoryFilter(cat)
    const m = searchParams.get('month')
    if (m) setMonthFilter(m)
    const acc = searchParams.get('account')
    if (acc) setAccountFilter(acc)
    const status = searchParams.get('status')
    if (status === 'paid' || status === 'pending' || status === 'all') {
      setStatusFilter(status)
    }
    const type = searchParams.get('type')
    if (type === 'receita' || type === 'despesa' || type === 'all') {
      setTypeFilter(type)
    }
    const q = searchParams.get('search')
    if (q) {
      setSearchTerm(q)
    }
  }, [searchParams])

  // Sorting state (padrão: crescente por Data da menor para a maior)
  const [sortField, setSortField] = useState<
    'date' | 'description' | 'category' | 'account' | 'amount' | 'paid'
  >('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Selection state for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  // Close Month Modal state
  const [closeMonthOpen, setCloseMonthOpen] = useState(false)

  // Modals state com callbacks estáveis
  const [modalOpen, setModalOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const handleOpenAiModal = React.useCallback(() => {
    setAiModalOpen(true)
  }, [])

  const handleCloseAiModal = React.useCallback((open: boolean) => {
    setAiModalOpen(open)
  }, [])
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deletePropagationOpen, setDeletePropagationOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isGeneratingRecurring, setIsGeneratingRecurring] = useState(false)
  const [generationStepLabel, setGenerationStepLabel] = useState<string | null>(null)
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false)
  const [isLoadingMonth, setIsLoadingMonth] = useState(false)
  const [isSearchingServer, setIsSearchingServer] = useState(false)

  // Efeito 1: Carrega dados do mês selecionado (ou todos) no servidor via CompanyContext (com cache)
  useEffect(() => {
    let cancelled = false
    const fetchMonth = async () => {
      setIsLoadingMonth(true)
      try {
        if (monthFilter === 'all') {
          await loadAllTransactions()
        } else if (/^\d{4}-\d{2}$/.test(monthFilter)) {
          await loadTransactionsForMonth(monthFilter)
        }
      } catch (err) {
        console.warn('[TransactionsPage] Erro ao carregar mês selecionado:', err)
      } finally {
        if (!cancelled) {
          setIsLoadingMonth(false)
        }
      }
    }

    fetchMonth()
    return () => {
      cancelled = true
    }
  }, [monthFilter, loadTransactionsForMonth, loadAllTransactions])

  // Efeito 2: Busca no servidor por descrição caso o usuário digite um termo de busca
  // e o termo não seja vazio (debounce de 400ms). Os resultados são mesclados no
  // CompanyContext por searchTransactionsServer, mas a LISTA continua respeitando o
  // filtro de mês selecionado (filteredList aplica monthFilter). A busca NUNCA altera
  // o mês selecionado: "Todos os Meses" só é ativado por escolha manual do usuário.
  useEffect(() => {
    const trimmed = searchTerm.trim()
    if (!trimmed || trimmed.length < 2) return

    let cancelled = false
    const timer = setTimeout(async () => {
      setIsSearchingServer(true)
      try {
        // Busca remota apenas para trazer lançamentos do mês selecionado que ainda
        // não estejam em cache/local. Resultados de outros meses são mesclados no
        // contexto, porém filtrados fora da lista pelo monthFilter.
        const results = await searchTransactionsServer(trimmed)
        if (!cancelled && results.length > 0 && monthFilter !== 'all') {
          const inSelectedMonth = results.some((r) => {
            const eff = getTxEffectiveDate(r)
            return eff && eff.startsWith(monthFilter)
          })
          if (inSelectedMonth) {
            // Garante que o cache do mês selecionado contenha as ocorrências encontradas
            await loadTransactionsForMonth(monthFilter)
          }
        }
      } catch (err) {
        console.warn('[TransactionsPage] Erro na busca remota:', err)
      } finally {
        if (!cancelled) {
          setIsSearchingServer(false)
        }
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchTerm, monthFilter, searchTransactionsServer, loadTransactionsForMonth])

  // Available unique month/year options (garante pelo menos os últimos 12 meses + próximos 12 meses + meses com transações)
  // Baseado na data efetiva de pagamento (payment_date com fallback para date)
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    monthSet.add(currentMonthStr)

    // Gera janela padrão de 12 meses atrás até 12 meses à frente para o usuário navegar livremente
    const today = new Date()
    const curYear = today.getFullYear()
    const curMonth = today.getMonth() // 0-11
    for (let offset = -12; offset <= 12; offset++) {
      const d = new Date(curYear, curMonth + offset, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthSet.add(ym)
    }

    transactions.forEach((tx) => {
      // Ignorar registros pai na lista de meses disponíveis
      if (isParentTransaction(tx)) return
      const effDate = getTxEffectiveDate(tx)
      if (effDate) {
        const ym = effDate.substring(0, 7) // "YYYY-MM"
        if (/^\d{4}-\d{2}$/.test(ym)) {
          monthSet.add(ym)
        }
      }
    })
    const sorted = Array.from(monthSet).sort().reverse()
    return sorted.map((ym) => {
      const [year, month] = ym.split('-')
      const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
      const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      const isCurrent = ym === currentMonthStr
      return {
        value: ym,
        label: `${label.charAt(0).toUpperCase() + label.slice(1)}${isCurrent ? ' (Atual)' : ''}`,
      }
    })
  }, [transactions, currentMonthStr])

  // Filtered transactions (ignoring parent installment records)
  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      // Ignore parent installment records (installment_number=0 && installment_total>0)
      if (isParentTransaction(tx)) return false

      // Month filter (baseado na data de pagamento com fallback para data da compra)
      if (monthFilter !== 'all') {
        const effDate = getTxEffectiveDate(tx)
        if (!effDate || !effDate.startsWith(monthFilter)) {
          return false
        }
      }

      // Status filter (paid / pending)
      if (statusFilter !== 'all') {
        const isPaid = tx.paid !== false
        if (statusFilter === 'paid' && !isPaid) return false
        if (statusFilter === 'pending' && isPaid) return false
      }

      // Search
      if (searchTerm.trim()) {
        const matchesDesc = tx.description.toLowerCase().includes(searchTerm.toLowerCase().trim())
        const matchesCat = tx.category?.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
        const matchesSub = tx.subcategory?.name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase().trim())
        const matchesNotes = tx.notes?.toLowerCase().includes(searchTerm.toLowerCase().trim())
        if (!matchesDesc && !matchesCat && !matchesSub && !matchesNotes) return false
      }
      // Type
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false
      // Account
      if (accountFilter !== 'all' && tx.account_id !== accountFilter) return false
      // Category
      if (categoryFilter !== 'all' && tx.category_id !== categoryFilter) return false

      // Payment Type Filter (À vista, Parcelado, Recorrente)
      // Parcelado: estritamente transações parceladas (isInstallmentTransaction), nunca recorrentes
      // Recorrente: transações recorrentes (isRecurringTransaction)
      // À vista: o restante (nem parcelado nem recorrente)
      if (paymentTypeFilter !== 'all') {
        const isInstallment = isInstallmentTransaction(tx)
        const isRecurring = isRecurringTransaction(tx)

        if (paymentTypeFilter === 'parcelado') {
          if (!isInstallment) return false
        } else if (paymentTypeFilter === 'recorrente') {
          if (!isRecurring) return false
        } else if (paymentTypeFilter === 'a_vista') {
          if (isInstallment || isRecurring) return false
        }
      }

      return true
    })
  }, [
    transactions,
    searchTerm,
    typeFilter,
    paymentTypeFilter,
    statusFilter,
    accountFilter,
    categoryFilter,
    monthFilter,
  ])

  // Sorted list according to selected column header (mantém ordenação crescente por payment_date com fallback para date quando sortField === 'date')
  const sortedTransactions = useMemo(() => {
    const list = [...filteredList]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === 'date') {
        const dateA = getTxEffectiveDate(a)
        const dateB = getTxEffectiveDate(b)
        comparison = dateA.localeCompare(dateB)
      } else if (sortField === 'description') {
        comparison = a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' })
      } else if (sortField === 'category') {
        const catA = a.category?.name || ''
        const catB = b.category?.name || ''
        comparison = catA.localeCompare(catB, 'pt-BR', { sensitivity: 'base' })
      } else if (sortField === 'account') {
        const accA = a.account?.name || ''
        const accB = b.account?.name || ''
        comparison = accA.localeCompare(accB, 'pt-BR', { sensitivity: 'base' })
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount
      } else if (sortField === 'paid') {
        const paidA = a.paid !== false ? 1 : 0
        const paidB = b.paid !== false ? 1 : 0
        comparison = paidA - paidB
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
    return list
  }, [filteredList, sortField, sortDirection])

  const handleSort = (
    field: 'date' | 'description' | 'category' | 'account' | 'amount' | 'paid',
  ) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      // Se clicar em Data, ordenação inicial é crescente ('asc')
      setSortDirection('asc')
    }
  }
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    )
  }, [categories])

  // Summary of filtered items including Paid vs Pending stats
  const summaryTotals = useMemo(() => {
    let income = 0
    let expense = 0
    let incomePaid = 0
    let incomePending = 0
    let expensePaid = 0
    let expensePending = 0

    filteredList.forEach((tx) => {
      const isPaid = tx.paid !== false
      if (tx.type === 'receita') {
        income += tx.amount
        if (isPaid) incomePaid += tx.amount
        else incomePending += tx.amount
      } else {
        expense += tx.amount
        if (isPaid) expensePaid += tx.amount
        else expensePending += tx.amount
      }
    })

    return {
      income,
      expense,
      balance: income - expense,
      incomePaid,
      incomePending,
      expensePaid,
      expensePending,
      netPaid: incomePaid - expensePaid,
      netPending: incomePending - expensePending,
    }
  }, [filteredList])

  const handleEdit = (tx: Transaction) => {
    setSelectedTx(tx)
    setModalOpen(true)
  }

  const handleOpenCreate = () => {
    setSelectedTx(null)
    setModalOpen(true)
  }

  const handleDeletePrompt = (tx: Transaction) => {
    setTxToDelete(tx)
    const isInst = isInstallmentTransaction(tx)
    const isRec = isRecurringTransaction(tx)
    if (isInst || isRec) {
      setDeletePropagationOpen(true)
    } else {
      setConfirmDeleteOpen(true)
    }
  }

  const confirmDelete = async () => {
    if (!txToDelete) return
    setIsDeleting(true)
    try {
      await deleteTransaction(txToDelete.id)
      toast.success('Lançamento excluído com sucesso!')
      setSelectedIds((prev) => prev.filter((id) => id !== txToDelete.id))
      setTxToDelete(null)
      setConfirmDeleteOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir lançamento.')
    } finally {
      setIsDeleting(false)
    }
  }

  const confirmPropagationDelete = async (choice: PropagationChoice) => {
    if (!txToDelete) return
    setIsDeleting(true)
    try {
      const { deletedIds: targetIds } = await deleteTransactionWithPropagation({
        transaction: txToDelete,
        allTransactions: transactions,
        choice,
      })

      // Immediate UI update without waiting for heavy reload
      applyTransactionsBatchUpdate({ deletedIds: targetIds })

      toast.success(
        choice === 'all'
          ? 'Todos os registros vinculados foram excluídos com sucesso!'
          : choice === 'future'
            ? 'Este e os próximos registros foram excluídos com sucesso!'
            : 'Lançamento excluído com sucesso!',
      )
      setSelectedIds((prev) => prev.filter((id) => !targetIds.includes(id)))
      setTxToDelete(null)
      setDeletePropagationOpen(false)

      // Background sync to update balances
      reloadCompanyData().catch((e) =>
        console.warn('[confirmPropagationDelete] Background sync error:', e),
      )
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir lançamentos.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Toggle single item paid status
  const handleTogglePaid = async (tx: Transaction, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!canManageSingleTx(tx)) {
      toast.error('Você não tem permissão para alterar o status deste lançamento.')
      return
    }
    const newStatus = !(tx.paid !== false)
    try {
      await setTransactionsPaidStatus([tx.id], newStatus)
      const label =
        tx.type === 'receita'
          ? newStatus
            ? 'Recebido'
            : 'Pendente'
          : newStatus
            ? 'Pago'
            : 'Pendente'
      toast.success(`Lançamento marcado como ${label.toLowerCase()}!`)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao alterar status do lançamento.')
    }
  }

  // Bulk toggle status
  const handleBulkStatusChange = async (newPaidStatus: boolean) => {
    if (selectedIds.length === 0) return
    if (isViewer) {
      toast.error('Visualizadores não têm permissão para alterar lançamentos.')
      return
    }
    // Filtrar apenas lançamentos que o usuário tem permissão para alterar
    const permittedTxs = transactions.filter(
      (t) => selectedIds.includes(t.id) && canManageSingleTx(t),
    )
    if (permittedTxs.length === 0) {
      toast.error('Você não tem permissão para alterar os lançamentos selecionados.')
      return
    }
    const idsToUpdate = permittedTxs.map((t) => t.id)
    const count = idsToUpdate.length
    setIsBulkUpdating(true)
    setSelectedIds([]) // deselect immediately for fluid UI
    try {
      await setTransactionsPaidStatus(idsToUpdate, newPaidStatus)
      toast.success(
        `${count} lançamento(s) marcado(s) como ${
          newPaidStatus ? 'pago(s) / recebido(s)' : 'pendente(s)'
        }!`,
      )
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao alterar status dos lançamentos selecionados.')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  // Select all / deselect all across all filtered transactions
  const handleSelectAll = () => {
    const allFilteredIds = filteredList.map((t) => t.id)
    const allSelected =
      allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])))
    }
  }

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Lançamentos recorrentes do mês atual para servir como sementes da geração
  const currentMonthRecurringSeeds = useMemo(() => {
    if (!currentCompany?.id) return []
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const currentYM = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

    const companyTxs = transactions.filter((t) => t.control_id === currentCompany.id)
    return companyTxs.filter((t) => {
      if (!t.date) return false
      const cleanDateOnly = String(t.date).split(/[T\s]/)[0]
      if (!cleanDateOnly.startsWith(currentYM)) return false

      const isRec = Boolean(
        t.is_recurring ||
        t.recurring ||
        (t.recurrence_type && String(t.recurrence_type).trim() !== '') ||
        Boolean((t as any).recurrence_period && String((t as any).recurrence_period).trim() !== ''),
      )
      if (!isRec) return false
      if (
        (Number(t.installment_number) === 0 || t.installment_number === undefined) &&
        Number(t.installments_total || (t as any).installment_total || 0) > 1
      ) {
        return false
      }
      return true
    })
  }, [transactions, currentCompany?.id])

  // Abertura do diálogo de confirmação ao clicar no botão
  const handleOpenGenerateConfirm = () => {
    if (!currentCompany?.id) {
      toast.error('Nenhum controle selecionado.')
      return
    }

    if (currentMonthRecurringSeeds.length === 0) {
      // Verificar se há sementes em meses passados para alertar ou permitir
      const hasAnySeed = transactions.some((t) => {
        if (t.control_id !== currentCompany.id) return false
        const isRec = Boolean(
          t.is_recurring ||
          t.recurring ||
          (t.recurrence_type && String(t.recurrence_type).trim() !== '') ||
          Boolean(
            (t as any).recurrence_period && String((t as any).recurrence_period).trim() !== '',
          ),
        )
        return isRec
      })
      if (!hasAnySeed) {
        toast.info('Nenhum lançamento recorrente configurado para gerar.', {
          duration: 6000,
        })
        return
      }
    }

    setConfirmGenerateOpen(true)
  }

  // Executa a geração efetiva após confirmação no diálogo
  const handleConfirmAndGenerate = async () => {
    setConfirmGenerateOpen(false)
    await executeGenerateNext12Months()
  }

  // Gerar ocorrências dos próximos 12 meses EXCLUSIVAMENTE para transações recorrentes
  // Não gera parcelas de lançamentos parcelados - Execução Atômica no Backend Skip Cloud
  const executeGenerateNext12Months = async () => {
    if (!currentCompany?.id) {
      toast.error('Nenhum controle selecionado.')
      return
    }
    if (!canManageTransactions) {
      toast.error('Você não tem permissão para gerar lançamentos recorrentes.')
      return
    }

    setIsGeneratingRecurring(true)
    setGenerationStepLabel('Processando no servidor...')
    const toastId = toast.loading('Gerando recorrências no servidor...')

    try {
      const resp = await pb.send('/backend/v1/custom/generate-recurring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          control_id: currentCompany.id,
        }),
      })

      toast.dismiss(toastId)

      if (!resp || resp.success === false) {
        throw new Error(resp?.message || 'Falha ao gerar recorrências.')
      }

      const totalCreated = Number(resp.totalCreated ?? resp.createdCount ?? 0)
      const alreadyExistingCount = Number(resp.alreadyExistingCount || 0)
      const createdIncomeCount = Number(resp.createdIncomeCount || 0)
      const createdExpenseCount = Number(resp.createdExpenseCount || 0)

      if (totalCreated === 0) {
        if (resp.message && resp.message.includes('Nenhum')) {
          toast.info(resp.message, { duration: 6000 })
        } else {
          toast.info('As recorrências futuras já existiam — nada a gerar.', {
            duration: 6000,
          })
        }
      } else {
        const countLabel =
          totalCreated === 1 ? '1 recorrência gerada' : `${totalCreated} recorrências geradas`
        const mixedSummary =
          alreadyExistingCount > 0
            ? `${totalCreated} geradas, ${alreadyExistingCount} ${
                alreadyExistingCount === 1 ? 'mês já existia' : 'meses já existiam'
              }`
            : countLabel

        const detailSuffix = ` (${createdIncomeCount} receita(s), ${createdExpenseCount} despesa(s))`
        toast.success(`${mixedSummary}${detailSuffix}.`, {
          duration: 7500,
        })
      }

      // Invalidar o cache e recarregar o mês atual e dados da empresa
      invalidateTransactionsCache()
      if (monthFilter !== 'all') {
        await loadTransactionsForMonth(monthFilter)
      } else {
        await loadAllTransactions()
      }
      reloadCompanyData().catch((err) => {
        console.warn('[executeGenerateNext12Months] Erro ao recarregar dados da empresa:', err)
      })
    } catch (err: any) {
      toast.dismiss(toastId)
      console.error('[executeGenerateNext12Months] Erro:', err)
      toast.error(err?.message || 'Erro ao gerar lançamentos recorrentes no servidor.')
    } finally {
      setIsGeneratingRecurring(false)
      setGenerationStepLabel(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Lançamentos Financeiros
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Registro detalhado de todas as receitas e despesas do controle.
          </p>
        </div>

        {canManageTransactions && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setCloseMonthOpen(true)}
              variant="outline"
              title="Revisar pendências e quitar mês anterior em lote"
              className="rounded-xl h-11 px-3.5 font-semibold border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center gap-2 transition-colors"
            >
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="hidden lg:inline">Fechar Mês</span>
              <span className="lg:hidden">Fechar</span>
            </Button>
            <Button
              onClick={handleOpenGenerateConfirm}
              disabled={isGeneratingRecurring}
              variant="outline"
              title="Gera as ocorrências dos próximos 12 meses para os lançamentos recorrentes"
              className="rounded-xl h-11 px-3.5 font-semibold border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center gap-2 transition-colors"
            >
              {isGeneratingRecurring ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              ) : (
                <RefreshCw className="w-4 h-4 text-indigo-500" />
              )}
              {isGeneratingRecurring && generationStepLabel ? (
                <span className="text-xs font-bold text-indigo-600">{generationStepLabel}</span>
              ) : (
                <>
                  <span className="hidden lg:inline">Gerar recorrentes próximos 12 meses</span>
                  <span className="lg:hidden">Recorrentes (12m)</span>
                </>
              )}
            </Button>
            <Button
              onClick={handleOpenAiModal}
              variant="outline"
              className="rounded-xl h-11 px-4 font-semibold border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Lançamento com IA</span>
              <span className="sm:hidden">IA</span>
            </Button>
            <Button
              onClick={handleOpenCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-4 font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Lançamento</span>
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            {isSearchingServer ? (
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute left-3 top-1/2 -translate-y-1/2" />
            ) : (
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            )}
            <Input
              placeholder="Buscar descrição ou categoria..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
              }}
              className="pl-9 rounded-xl h-10 text-sm"
            />
            {searchTerm.trim() && monthFilter !== 'all' && (
              <span className="absolute -bottom-4 left-0 text-[10px] text-indigo-600 font-medium whitespace-nowrap">
                Buscando em {monthFilter.split('-').reverse().join('/')}
              </span>
            )}
          </div>

          {/* Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(v: any) => {
              setTypeFilter(v)
            }}
          >
            <SelectTrigger className="rounded-xl h-10 text-sm">
              <SelectValue placeholder="Tipo de transação" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="receita">Apenas Receitas</SelectItem>
              <SelectItem value="despesa">Apenas Despesas</SelectItem>
            </SelectContent>
          </Select>

          {/* Account Filter */}
          <Select
            value={accountFilter}
            onValueChange={(v) => {
              setAccountFilter(v)
            }}
          >
            <SelectTrigger className="rounded-xl h-10 text-sm">
              <SelectValue placeholder="Filtrar por conta" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas as Contas</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v)
            }}
          >
            <SelectTrigger className="rounded-xl h-10 text-sm">
              <SelectValue placeholder="Filtrar por categoria" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {sortedCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type === 'despesa' ? 'Despesa' : 'Receita'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Payment Type Filter (Tipo de Pagamento) */}
          <Select
            value={paymentTypeFilter}
            onValueChange={(v: any) => {
              setPaymentTypeFilter(v)
            }}
          >
            <SelectTrigger className="rounded-xl h-10 text-sm">
              <SelectValue placeholder="Tipo de pagamento" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos os tipos de pagamento</SelectItem>
              <SelectItem value="a_vista">À vista</SelectItem>
              <SelectItem value="parcelado">Parcelado</SelectItem>
              <SelectItem value="recorrente">Recorrente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Filter Row (Month and Status) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 pt-2 border-t border-slate-100 items-center">
          {/* Month Calendar Navigation */}
          <div className="flex items-center gap-2">
            <MonthNavigator
              value={monthFilter}
              onChange={(nextMonth) => {
                setMonthFilter(nextMonth)
              }}
              isLoading={isLoadingMonth}
              className="w-full justify-between"
            />
          </div>

          {/* Status Filter (Pago / Recebido / Pendente) */}
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
            <Select
              value={statusFilter}
              onValueChange={(v: any) => {
                setStatusFilter(v)
              }}
            >
              <SelectTrigger className="rounded-xl h-10 text-sm">
                <SelectValue placeholder="Status de Pagamento" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todos os Status (Pago e Pendente)</SelectItem>
                <SelectItem value="paid">Apenas Pagos / Recebidos</SelectItem>
                <SelectItem value="pending">Apenas Pendentes (A Pagar / A Receber)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Totals Summary of filtered results with Paid vs Pending Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Despesas Pagas */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-900">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-emerald-700 uppercase font-semibold">
                  Já Pago (Despesas)
                </p>
                <p className="text-sm font-bold">{formatCurrency(summaryTotals.expensePaid)}</p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              Quitado
            </span>
          </div>

          {/* Despesas Pendentes (Falta Pagar) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-amber-800 uppercase font-bold">
                  Falta Pagar (Pendente)
                </p>
                <p className="text-sm font-bold text-amber-950">
                  {formatCurrency(summaryTotals.expensePending)}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              A vencer
            </span>
          </div>

          {/* Receitas Recebidas vs Pendentes */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50/70 border border-sky-100 text-sky-900">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-sky-700 uppercase font-semibold">
                  Receitas Recebidas
                </p>
                <p className="text-sm font-bold">{formatCurrency(summaryTotals.incomePaid)}</p>
                {summaryTotals.incomePending > 0 && (
                  <p className="text-[10px] text-sky-600">
                    + {formatCurrency(summaryTotals.incomePending)} a receber
                  </p>
                )}
              </div>
            </div>
            <span className="text-[10px] font-medium text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">
              Total {formatCurrency(summaryTotals.income)}
            </span>
          </div>

          {/* Saldo Líquido Realizado vs Previsto */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">
                  Saldo Realizado
                </p>
                <p
                  className={`text-sm font-bold tabular-nums ${
                    summaryTotals.netPaid >= 0 ? 'text-indigo-600' : 'text-rose-600'
                  }`}
                >
                  {formatCurrency(summaryTotals.netPaid)}
                </p>
                <p className="text-[10px] text-slate-400">
                  Total Geral: {formatCurrency(summaryTotals.balance)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-900 text-white p-3.5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5 text-sm font-medium">
            <span className="bg-indigo-800 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-200">
              {selectedIds.length} selecionado(s)
            </span>
            <span>Ações em lote para os lançamentos selecionados:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={isBulkUpdating}
              onClick={() => handleBulkStatusChange(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold h-9 px-3.5 shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Marcar como Pago / Recebido
            </Button>
            <Button
              size="sm"
              disabled={isBulkUpdating}
              onClick={() => handleBulkStatusChange(false)}
              className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold h-9 px-3.5 shadow-sm"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Marcar como Pendente
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="text-indigo-200 hover:text-white hover:bg-indigo-800 rounded-xl text-xs h-9 px-2.5"
            >
              Desmarcar todos
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {/* Checkbox column */}
              <th className="py-3.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={
                    filteredList.length > 0 && filteredList.every((t) => selectedIds.includes(t.id))
                  }
                  onChange={handleSelectAll}
                  aria-label="Selecionar todos os lançamentos"
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>

              {/* Status Paid / Pending Column */}
              <th
                onClick={() => handleSort('paid')}
                className="py-3.5 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {sortField === 'paid' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>

              {/* Date Column */}
              <th
                onClick={() => handleSort('date')}
                className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Data</span>
                  {sortField === 'date' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>

              {/* Description Column */}
              <th
                onClick={() => handleSort('description')}
                className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Descrição</span>
                  {sortField === 'description' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>

              {/* Category Column */}
              <th
                onClick={() => handleSort('category')}
                className="py-3.5 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Categoria</span>
                  {sortField === 'category' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>

              {/* Account Column */}
              <th
                onClick={() => handleSort('account')}
                className="py-3.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Conta</span>
                  {sortField === 'account' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>

              {/* Type Column */}
              <th className="py-3.5 px-3">Tipo</th>

              {/* Amount Column */}
              <th
                onClick={() => handleSort('amount')}
                className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Valor</span>
                  {sortField === 'amount' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>

              <th className="py-3.5 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {sortedTransactions.map((tx) => {
              const isExpense = tx.type === 'despesa'
              const isPaid = tx.paid !== false
              const isSelected = selectedIds.includes(tx.id)

              return (
                <tr
                  key={tx.id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isSelected ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  {/* Selection Checkbox */}
                  <td className="py-3.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleToggleSelectOne(tx.id, e as any)}
                      aria-label={`Selecionar lançamento ${tx.description}`}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>

                  {/* Status Toggle Button */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePaid(tx, e)}
                      title={
                        isPaid
                          ? isExpense
                            ? 'Clique para marcar como Pendente (a pagar)'
                            : 'Clique para marcar como Pendente (a receber)'
                          : isExpense
                            ? 'Clique para marcar como Pago'
                            : 'Clique para marcar como Recebido'
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shadow-xs ${
                        isPaid
                          ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          : 'bg-amber-100/80 text-amber-800 border border-amber-300 hover:bg-amber-200'
                      }`}
                    >
                      {isPaid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{isExpense ? 'Pago' : 'Recebido'}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>Pendente</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-3 text-xs whitespace-nowrap">
                    <div className="font-semibold text-slate-700">{formatDateBR(tx.date)}</div>
                    {tx.payment_date && tx.payment_date !== tx.date && (
                      <div
                        className="text-[11px] text-indigo-600 font-medium flex items-center gap-1 mt-0.5"
                        title="Data de pagamento / vencimento na fatura"
                      >
                        <span className="text-slate-400">pgto:</span>
                        <span>{formatDateBR(tx.payment_date)}</span>
                      </div>
                    )}
                  </td>

                  {/* Description */}
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={isPaid ? '' : 'text-slate-800'}>{tx.description}</span>
                      {tx.is_recurring && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200"
                          title={`Recorrente (${tx.recurrence_type ? tx.recurrence_type.charAt(0).toUpperCase() + tx.recurrence_type.slice(1) : 'Mensal'})`}
                        >
                          <Repeat className="w-3 h-3 text-sky-600" />
                          <span>
                            {tx.recurrence_type
                              ? tx.recurrence_type.charAt(0).toUpperCase() +
                                tx.recurrence_type.slice(1)
                              : 'Recorrente'}
                          </span>
                        </span>
                      )}
                      {isInstallmentTransaction(tx) && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                          title={`Parcela ${tx.installment_number || 1} de ${tx.installments_total || (tx as any).installment_total || 1}`}
                        >
                          <Package className="w-3 h-3 text-amber-600" />
                          <span>
                            {tx.installment_number || 1}/
                            {tx.installments_total || (tx as any).installment_total || 1}
                          </span>
                        </span>
                      )}
                    </div>
                    {cleanNotesForDisplay(tx.notes) && (
                      <p className="text-xs text-slate-400 font-normal mt-0.5">
                        {cleanNotesForDisplay(tx.notes)}
                      </p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${tx.category?.color || '#6366F1'}15`,
                          color: tx.category?.color || '#6366F1',
                        }}
                      >
                        <DynamicIcon name={tx.category?.icon || 'Tag'} className="w-3 h-3" />
                        {tx.category?.name || 'Geral'}
                        {(tx.category?.active === false || tx.category?.is_archived) && (
                          <span className="text-[9px] text-slate-400 font-normal">(inativa)</span>
                        )}
                      </span>
                      {tx.subcategory && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <span className="text-slate-400">↳</span>
                          <span>{tx.subcategory.name}</span>
                          {(tx.subcategory.active === false || tx.subcategory.is_archived) && (
                            <span className="text-[9px] text-slate-400 font-normal">(inativa)</span>
                          )}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Account */}
                  <td className="py-3.5 px-3 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tx.account?.color || '#94a3b8' }}
                      />
                      {tx.account?.name || 'Conta'}
                      {(tx.account?.active === false || tx.account?.is_archived) && (
                        <span className="text-[9px] text-slate-400 font-normal">(inativa)</span>
                      )}
                    </span>
                  </td>

                  {/* Type */}
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isExpense
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}
                    >
                      {isExpense ? (
                        <ArrowDownRight className="w-3 h-3" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3" />
                      )}
                      {isExpense ? 'Despesa' : 'Receita'}
                    </span>
                  </td>

                  {/* Amount */}
                  <td
                    className={`py-3.5 px-4 text-right font-bold tabular-nums ${
                      isExpense ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {isExpense ? '- ' : '+ '}
                    {formatCurrency(tx.amount)}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canManageSingleTx(tx) ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(tx)}
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 rounded-lg"
                            title="Editar lançamento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePrompt(tx)}
                            className="h-8 w-8 text-slate-500 hover:text-rose-600 rounded-lg"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <span
                          className="text-[11px] text-slate-400 italic px-2 py-1 select-none"
                          title={
                            isViewer
                              ? 'Visualizadores não podem editar ou excluir lançamentos.'
                              : 'Você só pode editar ou excluir lançamentos criados por você mesmo.'
                          }
                        >
                          Apenas leitura
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

            {sortedTransactions.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-slate-400">
                  Nenhum lançamento encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Mobile Card List View */}
      <div className="md:hidden space-y-3">
        {sortedTransactions.map((tx) => {
          const isExpense = tx.type === 'despesa'
          const isPaid = tx.paid !== false
          const isSelected = selectedIds.includes(tx.id)

          return (
            <div
              key={tx.id}
              className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm transition-all ${
                isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {/* Select Checkbox for Mobile */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleToggleSelectOne(tx.id, e as any)}
                    className="w-4 h-4 mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />

                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5"
                    style={{ backgroundColor: tx.category?.color || '#6366F1' }}
                  >
                    <DynamicIcon name={tx.category?.icon || 'Tag'} className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm text-slate-900 leading-snug">
                        {tx.description}
                      </p>
                      {tx.is_recurring && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200"
                          title="Recorrente"
                        >
                          <Repeat className="w-2.5 h-2.5 text-sky-600" />
                          <span>
                            {tx.recurrence_type
                              ? tx.recurrence_type.charAt(0).toUpperCase() +
                                tx.recurrence_type.slice(1)
                              : 'Recorrente'}
                          </span>
                        </span>
                      )}
                      {isInstallmentTransaction(tx) && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                          title={`Parcela ${tx.installment_number || 1} de ${tx.installments_total || (tx as any).installment_total || 1}`}
                        >
                          <Package className="w-2.5 h-2.5 text-amber-600" />
                          <span>
                            {tx.installment_number || 1}/
                            {tx.installments_total || (tx as any).installment_total || 1}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                      <span>{formatDateBR(tx.date)}</span>
                      {tx.payment_date && tx.payment_date !== tx.date && (
                        <span className="text-indigo-600 font-semibold text-[11px] bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                          Pgto: {formatDateBR(tx.payment_date)}
                        </span>
                      )}
                      <span>•</span>
                      <span className="truncate">{tx.account?.name || 'Conta'}</span>
                      {tx.category && (
                        <>
                          <span>•</span>
                          <span className="text-slate-700 font-medium truncate">
                            {tx.category.name}
                            {tx.subcategory && (
                              <span className="text-slate-500"> → {tx.subcategory.name}</span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      isExpense ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {isExpense ? '- ' : '+ '}
                    {formatCurrency(tx.amount)}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    {canManageSingleTx(tx) ? (
                      <>
                        <button
                          onClick={() => handleEdit(tx)}
                          className="p-1 text-slate-400 hover:text-indigo-600"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(tx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Leitura</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Action in Mobile Card */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => handleTogglePaid(tx, e)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isPaid
                      ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100/80 text-amber-800 border border-amber-300'
                  }`}
                >
                  {isPaid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      <span>{isExpense ? 'Pago' : 'Recebido'}</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 text-amber-700" />
                      <span>Pendente (clique p/ quitar)</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-400 font-medium">
                  {isExpense ? 'Despesa' : 'Receita'}
                </span>
              </div>
            </div>
          )
        })}

        {sortedTransactions.length === 0 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-400">
            Nenhum lançamento encontrado.
          </div>
        )}
      </div>

      {/* Diálogo de confirmação para gerar recorrentes próximos 12 meses */}
      <Dialog open={confirmGenerateOpen} onOpenChange={setConfirmGenerateOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Gerar Recorrentes dos Próximos 12 Meses
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Confirmação de geração em lote de lançamentos futuros
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-slate-600">
            {currentMonthRecurringSeeds.length > 0 ? (
              <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-indigo-950 space-y-1.5">
                <p className="font-semibold text-indigo-900 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">
                    {currentMonthRecurringSeeds.length}
                  </span>
                  {currentMonthRecurringSeeds.length === 1
                    ? '1 lançamento recorrente encontrado no mês atual.'
                    : `${currentMonthRecurringSeeds.length} lançamentos recorrentes encontrados no mês atual.`}
                </p>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  Serão geradas as próximas 12 recorrências de cada lançamento, a partir do mês
                  seguinte, preservando categoria, conta e vencimentos originais.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                Nenhum lançamento recorrente encontrado no mês atual para usar como base.
              </div>
            )}

            <p className="text-xs text-slate-500">
              O processo é <strong>idempotente</strong>: ocorrências que já existirem nos meses
              futuros não serão duplicadas.
            </p>
          </div>

          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmGenerateOpen(false)}
              className="rounded-xl h-11"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmAndGenerate}
              disabled={currentMonthRecurringSeeds.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 font-semibold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Modal (Create/Edit) */}
      <TransactionModal open={modalOpen} onOpenChange={setModalOpen} transaction={selectedTx} />

      {/* AI Transaction Modal */}
      <AiTransactionModal open={aiModalOpen} onOpenChange={handleCloseAiModal} />

      {/* Confirm Delete Dialog (lançamentos simples) */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir Lançamento"
        description={`Tem certeza que deseja excluir o lançamento "${txToDelete?.description}" no valor de ${formatCurrency(
          txToDelete?.amount || 0,
        )}? O saldo da conta vinculada será reajustado automaticamente.`}
        confirmText={isDeleting ? 'Excluindo...' : 'Excluir'}
        variant="danger"
        onConfirm={confirmDelete}
      />

      {/* Recurrence & Installment Propagation Delete Dialog */}
      {txToDelete && (
        <RecurrencePropagationModal
          open={deletePropagationOpen}
          onOpenChange={setDeletePropagationOpen}
          mode="delete"
          isInstallment={isInstallmentTransaction(txToDelete)}
          isRecurring={isRecurringTransaction(txToDelete)}
          currentInstallment={
            txToDelete.installment_number ||
            parseInt(txToDelete.description?.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/)?.[1] || '1', 10)
          }
          totalInstallments={
            txToDelete.installments_total ||
            (txToDelete as any).installment_total ||
            parseInt(txToDelete.description?.match(/\(\s*(\d+)\s*\/\s*(\d+)\s*\)/)?.[2] || '1', 10)
          }
          onConfirm={confirmPropagationDelete}
          isSubmitting={isDeleting}
        />
      )}

      {/* Modal Fechar o Mês */}
      <CloseMonthModal
        open={closeMonthOpen}
        onOpenChange={setCloseMonthOpen}
        transactions={transactions}
        targetMonthYm={(() => {
          const d = new Date()
          const yr = d.getFullYear()
          const mo = d.getMonth()
          const pYr = mo === 0 ? yr - 1 : yr
          const pMo = mo === 0 ? 12 : mo
          return `${pYr}-${String(pMo).padStart(2, '0')}`
        })()}
        targetMonthLabel={(() => {
          const monthNames = [
            'Janeiro',
            'Fevereiro',
            'Março',
            'Abril',
            'Maio',
            'Junho',
            'Julho',
            'Agosto',
            'Setembro',
            'Outubro',
            'Novembro',
            'Dezembro',
          ]
          const d = new Date()
          const yr = d.getFullYear()
          const mo = d.getMonth()
          const pYr = mo === 0 ? yr - 1 : yr
          const pMo = mo === 0 ? 12 : mo
          return `${monthNames[pMo - 1]} de ${pYr}`
        })()}
        canManageTransactions={canManageTransactions}
        onBatchMarkPaid={async (ids) => {
          await setTransactionsPaidStatus(ids, true)
        }}
        onSingleMarkPaid={async (id) => {
          await setTransactionsPaidStatus([id], true)
        }}
      />
    </div>
  )
}
