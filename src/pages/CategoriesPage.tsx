import React, { useState, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { CategoryModal } from '@/components/categories/CategoryModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { formatCurrency } from '@/lib/formatters'
import { Category, TransactionType } from '@/types/database'
import { toast } from 'sonner'
import { Plus, ArrowUpRight, ArrowDownRight, Edit2, Trash2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function CategoriesPage() {
  const { categories, transactions, deleteCategory, canManageFinance } = useCompany()

  const [activeTab, setActiveTab] = useState<TransactionType>('despesa')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [catToDelete, setCatToDelete] = useState<Category | null>(null)

  // Calculate statistics per category
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalAmount: number }> = {}

    transactions.forEach((tx) => {
      if (!stats[tx.category_id]) {
        stats[tx.category_id] = { count: 0, totalAmount: 0 }
      }
      stats[tx.category_id].count += 1
      stats[tx.category_id].totalAmount += tx.amount
    })

    return stats
  }, [transactions])

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'despesa'),
    [categories],
  )

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'receita'),
    [categories],
  )

  const handleEdit = (cat: Category) => {
    setSelectedCat(cat)
    setModalOpen(true)
  }

  const handleOpenCreate = () => {
    setSelectedCat(null)
    setModalOpen(true)
  }

  const handleDeletePrompt = (cat: Category) => {
    const usage = categoryStats[cat.id]?.count || 0
    if (usage > 0) {
      toast.error(
        `Esta categoria não pode ser excluída pois possui ${usage} lançamento(s) vinculado(s).`,
      )
      return
    }
    setCatToDelete(cat)
    setConfirmDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!catToDelete) return
    try {
      await deleteCategory(catToDelete.id)
      toast.success('Categoria excluída com sucesso!')
      setCatToDelete(null)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir categoria.')
    }
  }

  const renderCategoryGrid = (list: Category[], type: TransactionType) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {list.map((cat) => {
          const stats = categoryStats[cat.id] || { count: 0, totalAmount: 0 }

          return (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: cat.color }}
                  >
                    <DynamicIcon name={cat.icon || 'Tag'} className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{cat.name}</h3>
                    <span className="text-xs text-slate-400">
                      {stats.count} {stats.count === 1 ? 'lançamento' : 'lançamentos'}
                    </span>
                  </div>
                </div>

                {canManageFinance && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(cat)}
                      className="h-7 w-7 text-slate-400 hover:text-indigo-600 rounded-lg"
                      title="Editar categoria"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePrompt(cat)}
                      className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Excluir categoria"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Total movimentado:</span>
                <span
                  className={`font-bold tabular-nums ${
                    type === 'despesa' ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {formatCurrency(stats.totalAmount)}
                </span>
              </div>
            </div>
          )
        })}

        {/* Create category button card */}
        {canManageFinance && (
          <button
            onClick={handleOpenCreate}
            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-all duration-200 hover:-translate-y-0.5 min-h-[130px]"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-slate-900">Nova Categoria</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Categorias de Lançamento
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Classificação contábil e orçamentária dos seus centros de custo e fontes de receita.
          </p>
        </div>

        {canManageFinance ? (
          <Button
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-4 font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Categoria</span>
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Apenas Administradores podem gerenciar categorias</span>
          </div>
        )}
      </div>

      {/* Tabs Despesas / Receitas */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TransactionType)}
        className="space-y-6"
      >
        <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-200 shadow-sm max-w-md">
          <TabsList className="grid grid-cols-2 w-full bg-slate-100 rounded-xl p-1">
            <TabsTrigger
              value="despesa"
              className="flex items-center gap-2 rounded-lg font-semibold text-xs data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm"
            >
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
              <span>Despesas ({expenseCategories.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="receita"
              className="flex items-center gap-2 rounded-lg font-semibold text-xs data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              <span>Receitas ({incomeCategories.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="despesa" className="focus-visible:outline-none">
          {renderCategoryGrid(expenseCategories, 'despesa')}
        </TabsContent>

        <TabsContent value="receita" className="focus-visible:outline-none">
          {renderCategoryGrid(incomeCategories, 'receita')}
        </TabsContent>
      </Tabs>

      {/* Category Modal */}
      <CategoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        category={selectedCat}
        defaultType={activeTab}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir Categoria"
        description={`Tem certeza que deseja excluir a categoria "${catToDelete?.name}"?`}
        confirmText="Excluir Categoria"
        variant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
