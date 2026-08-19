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
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function TransactionsPage() {
  const { transactions, accounts, categories, deleteTransaction, canManageTransactions } =
    useCompany()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)

  // Filtered transactions
  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      // Search
      if (searchTerm.trim()) {
        const matchesDesc = tx.description.toLowerCase().includes(searchTerm.toLowerCase().trim())
        const matchesNotes = tx.notes?.toLowerCase().includes(searchTerm.toLowerCase().trim())
        if (!matchesDesc && !matchesNotes) return false
      }
      // Type
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false
      // Account
      if (accountFilter !== 'all' && tx.account_id !== accountFilter) return false
      // Category
      if (categoryFilter !== 'all' && tx.category_id !== categoryFilter) return false

      return true
    })
  }, [transactions, searchTerm, typeFilter, accountFilter, categoryFilter])

  // Summary of filtered items
  const summaryTotals = useMemo(() => {
    let income = 0
    let expense = 0
    filteredList.forEach((tx) => {
      if (tx.type === 'receita') income += tx.amount
      else expense += tx.amount
    })
    return {
      income,
      expense,
      balance: income - expense,
    }
  }, [filteredList])

  // Pagination
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredList.slice(start, start + pageSize)
  }, [filteredList, currentPage])

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
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir lançamento.')
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
            Registro detalhado de todas as receitas e despesas da empresa.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por descrição..."
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
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name} ({cat.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Totals Summary of filtered results */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-800">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <div>
              <p className="text-[10px] text-emerald-600 uppercase font-semibold">Total Receitas</p>
              <p className="text-sm font-bold">{formatCurrency(summaryTotals.income)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50/70 border border-rose-100 text-rose-800">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <div>
              <p className="text-[10px] text-rose-600 uppercase font-semibold">Total Despesas</p>
              <p className="text-sm font-bold">{formatCurrency(summaryTotals.expense)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100/80 border border-slate-200 text-slate-800">
            <Filter className="w-4 h-4 text-slate-600" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Saldo do Filtro</p>
              <p
                className={`text-sm font-bold tabular-nums ${
                  summaryTotals.balance >= 0 ? 'text-indigo-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(summaryTotals.balance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Data</th>
              <th className="py-3.5 px-4">Descrição</th>
              <th className="py-3.5 px-4">Categoria</th>
              <th className="py-3.5 px-4">Conta</th>
              <th className="py-3.5 px-4">Tipo</th>
              <th className="py-3.5 px-4 text-right">Valor</th>
              <th className="py-3.5 px-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {paginatedTransactions.map((tx) => {
              const isExpense = tx.type === 'despesa'
              return (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                    {formatDateBR(tx.date)}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{tx.description}</span>
                      {tx.is_recurring && (
                        <span
                          className="p-1 rounded bg-slate-100 text-slate-500"
                          title="Recorrente"
                        >
                          <Repeat className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    {tx.notes && (
                      <p className="text-xs text-slate-400 font-normal mt-0.5">{tx.notes}</p>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
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
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tx.account?.color || '#94a3b8' }}
                      />
                      {tx.account?.name || 'Conta'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
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
                  <td
                    className={`py-3.5 px-4 text-right font-bold tabular-nums ${
                      isExpense ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {isExpense ? '- ' : '+ '}
                    {formatCurrency(tx.amount)}
                  </td>
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
                <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
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
          return (
            <div
              key={tx.id}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: tx.category?.color || '#6366F1' }}
                >
                  <DynamicIcon name={tx.category?.icon || 'Tag'} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{formatDateBR(tx.date)}</span>
                    <span>•</span>
                    <span className="truncate">{tx.account?.name}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 ml-3">
                <p
                  className={`text-sm font-bold tabular-nums ${
                    isExpense ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {isExpense ? '- ' : '+ '}
                  {formatCurrency(tx.amount)}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <button
                    onClick={() => handleEdit(tx)}
                    className="p-1 text-slate-400 hover:text-indigo-600"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeletePrompt(tx)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
