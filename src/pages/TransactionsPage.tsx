import React, { useState, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { TransactionModal } from '@/components/transactions/TransactionModal'
import { AiTransactionModal } from '@/components/transactions/AiTransactionModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { formatCurrency, formatDateBR } from '@/lib/formatters'
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
  ChevronLeft,
  ChevronRight,
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
} from 'lucide-react'
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

export default function TransactionsPage() {
  const {
    transactions,
    accounts,
    categories,
    deleteTransaction,
    setTransactionsPaidStatus,
    canManageTransactions,
  } = useCompany()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<
    'all' | 'a_vista' | 'parcelado' | 'recorrente'
  >('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all') // 'all' or 'YYYY-MM'
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Sorting state
  const [sortField, setSortField] = useState<
    'date' | 'description' | 'category' | 'account' | 'amount' | 'paid'
  >('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Selection state for batch actions
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)

  // Available unique month/year options from all transactions
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>()
    transactions.forEach((tx) => {
      if (tx.date) {
        const ym = tx.date.substring(0, 7) // "YYYY-MM"
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
      return {
        value: ym,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      }
    })
  }, [transactions])

  // Filtered transactions (ignoring parent installment records)
  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      // Ignore parent installment records (installment_number=0 && installment_total>0)
      const isParent =
        (tx.installment_number === 0 || tx.installment_number === undefined) &&
        (tx.installments_total || 0) > 0
      if (isParent) return false

      // Month filter
      if (monthFilter !== 'all') {
        if (!tx.date || !tx.date.startsWith(monthFilter)) {
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
      // Parcelado: installments_total > 1 (ou installment info presente com total > 1 ou parent_transaction_id)
      // Recorrente: is_recurring/recurring true ou recurrence_type preenchido
      // À vista: o restante
      if (paymentTypeFilter !== 'all') {
        const isInstallment =
          (tx.installments_total !== undefined && tx.installments_total > 1) ||
          Boolean(tx.parent_transaction_id)

        const isRecurring = Boolean(
          tx.is_recurring ||
          tx.recurring ||
          (tx.recurrence_type && tx.recurrence_type.trim() !== ''),
        )

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

  // Sorted list according to selected column header
  const sortedTransactions = useMemo(() => {
    const list = [...filteredList]
    list.sort((a, b) => {
      let comparison = 0
      if (sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
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
      setSortDirection(field === 'date' ? 'desc' : 'asc')
    }
    setCurrentPage(1)
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

  // Pagination
  const totalPages = Math.ceil(sortedTransactions.length / pageSize) || 1
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedTransactions.slice(start, start + pageSize)
  }, [sortedTransactions, currentPage])

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
    setConfirmDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!txToDelete) return
    try {
      await deleteTransaction(txToDelete.id)
      toast.success('Lançamento excluído com sucesso!')
      setTxToDelete(null)
      setSelectedIds((prev) => prev.filter((id) => id !== txToDelete.id))
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir lançamento.')
    }
  }

  // Toggle single item paid status
  const handleTogglePaid = async (tx: Transaction, e?: React.MouseEvent) => {
    e?.stopPropagation()
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
    setIsBulkUpdating(true)
    try {
      await setTransactionsPaidStatus(selectedIds, newPaidStatus)
      toast.success(
        `${selectedIds.length} lançamento(s) marcado(s) como ${
          newPaidStatus ? 'pago(s) / recebido(s)' : 'pendente(s)'
        }!`,
      )
      setSelectedIds([])
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao alterar status dos lançamentos selecionados.')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  // Select all / deselect all
  const handleSelectAll = () => {
    const currentPageIds = paginatedTransactions.map((t) => t.id)
    const allSelected = currentPageIds.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])))
    }
  }

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
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
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAiModalOpen(true)}
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
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar descrição ou categoria..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9 rounded-xl h-10 text-sm"
            />
          </div>

          {/* Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(v: any) => {
              setTypeFilter(v)
              setCurrentPage(1)
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
              setCurrentPage(1)
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
              setCurrentPage(1)
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
              setCurrentPage(1)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          {/* Month Selector Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <Select
              value={monthFilter}
              onValueChange={(v) => {
                setMonthFilter(v)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="rounded-xl h-10 text-sm">
                <SelectValue placeholder="Filtrar por Mês" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-64">
                <SelectItem value="all">Todos os Meses</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter (Pago / Recebido / Pendente) */}
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
            <Select
              value={statusFilter}
              onValueChange={(v: any) => {
                setStatusFilter(v)
                setCurrentPage(1)
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
                    paginatedTransactions.length > 0 &&
                    paginatedTransactions.every((t) => selectedIds.includes(t.id))
                  }
                  onChange={handleSelectAll}
                  aria-label="Selecionar todos os lançamentos da página"
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
            {paginatedTransactions.map((tx) => {
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
                      {Boolean(
                        (tx.installments_total && tx.installments_total > 1) ||
                        (tx.parent_transaction_id &&
                          tx.installments_total &&
                          tx.installments_total > 1),
                      ) && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                          title={`Parcela ${tx.installment_number || 1} de ${tx.installments_total}`}
                        >
                          <Package className="w-3 h-3 text-amber-600" />
                          <span>
                            {tx.installment_number || 1}/{tx.installments_total}
                          </span>
                        </span>
                      )}
                    </div>
                    {tx.notes && (
                      <p className="text-xs text-slate-400 font-normal mt-0.5">{tx.notes}</p>
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
                      </span>
                      {tx.subcategory && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <span className="text-slate-400">↳</span>
                          <span>{tx.subcategory.name}</span>
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
                    </div>
                  </td>
                </tr>
              )
            })}

            {paginatedTransactions.length === 0 && (
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
        {paginatedTransactions.map((tx) => {
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
                      {Boolean(
                        (tx.installments_total && tx.installments_total > 1) ||
                        (tx.parent_transaction_id &&
                          tx.installments_total &&
                          tx.installments_total > 1),
                      ) && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                          title="Parcela"
                        >
                          <Package className="w-2.5 h-2.5 text-amber-600" />
                          <span>
                            {tx.installment_number || 1}/{tx.installments_total}
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

        {paginatedTransactions.length === 0 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-400">
            Nenhum lançamento encontrado.
          </div>
        )}
      </div>
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">
            Página <strong className="text-slate-800">{currentPage}</strong> de{' '}
            <strong className="text-slate-800">{totalPages}</strong> ({filteredList.length}{' '}
            lançamentos)
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-xl h-8 px-2.5 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl h-8 px-2.5 text-xs"
            >
              Próxima
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Modal (Create/Edit) */}
      <TransactionModal open={modalOpen} onOpenChange={setModalOpen} transaction={selectedTx} />

      {/* AI Transaction Modal */}
      <AiTransactionModal open={aiModalOpen} onOpenChange={setAiModalOpen} />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir Lançamento"
        description={`Tem certeza que deseja excluir o lançamento "${txToDelete?.description}" no valor de ${formatCurrency(
          txToDelete?.amount || 0,
        )}? O saldo da conta vinculada será reajustado automaticamente.`}
        confirmText="Excluir"
        variant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
