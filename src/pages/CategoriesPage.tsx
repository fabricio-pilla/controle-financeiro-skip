import React, { useState, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { CategoryModal } from '@/components/categories/CategoryModal'
import { SubcategoryModal } from '@/components/categories/SubcategoryModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { formatCurrency } from '@/lib/formatters'
import { Category, Subcategory, TransactionType } from '@/types/database'
import { toast } from 'sonner'
import {
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FolderTree,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function CategoriesPage() {
  const {
    categories,
    subcategories,
    transactions,
    deleteCategory,
    deleteSubcategory,
    canManageFinance,
  } = useCompany()

  const [activeTab, setActiveTab] = useState<TransactionType>('despesa')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [catToDelete, setCatToDelete] = useState<Category | null>(null)

  // Subcategory modal & delete states
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [subModalCat, setSubModalCat] = useState<Category | null>(null)
  const [selectedSub, setSelectedSub] = useState<Subcategory | null>(null)
  const [confirmDeleteSubOpen, setConfirmDeleteSubOpen] = useState(false)
  const [subToDelete, setSubToDelete] = useState<Subcategory | null>(null)

  // Expanded categories accordion state (default all expanded)
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCats((prev) => ({
      ...prev,
      [catId]: prev[catId] === undefined ? false : !prev[catId],
    }))
  }

  // Calculate statistics per category and per subcategory
  const { categoryStats, subcategoryStats } = useMemo(() => {
    const catStats: Record<string, { count: number; totalAmount: number }> = {}
    const subStats: Record<string, { count: number; totalAmount: number }> = {}

    transactions.forEach((tx) => {
      // Ignorar registros pai de parcelamento
      const isParent =
        (tx.installment_number === 0 || tx.installment_number === undefined) &&
        (tx.installments_total || 0) > 0
      if (isParent) return

      if (tx.category_id) {
        if (!catStats[tx.category_id]) {
          catStats[tx.category_id] = { count: 0, totalAmount: 0 }
        }
        catStats[tx.category_id].count += 1
        catStats[tx.category_id].totalAmount += tx.amount
      }

      if (tx.subcategory_id) {
        if (!subStats[tx.subcategory_id]) {
          subStats[tx.subcategory_id] = { count: 0, totalAmount: 0 }
        }
        subStats[tx.subcategory_id].count += 1
        subStats[tx.subcategory_id].totalAmount += tx.amount
      }
    })

    return { categoryStats: catStats, subcategoryStats: subStats }
  }, [transactions])

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'despesa'),
    [categories],
  )

  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'receita'),
    [categories],
  )

  // Group subcategories by category_id
  const subcategoriesByCategory = useMemo(() => {
    const map: Record<string, Subcategory[]> = {}
    subcategories.forEach((sub) => {
      if (!map[sub.category_id]) map[sub.category_id] = []
      map[sub.category_id].push(sub)
    })
    return map
  }, [subcategories])

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
    const subCount = subcategoriesByCategory[cat.id]?.length || 0
    if (subCount > 0) {
      toast.error(
        `Esta categoria possui ${subCount} subcategoria(s). Exclua as subcategorias antes de excluir a categoria.`,
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

  // Subcategory handlers
  const handleOpenCreateSubcategory = (cat: Category) => {
    setSubModalCat(cat)
    setSelectedSub(null)
    setSubModalOpen(true)
  }

  const handleEditSubcategory = (cat: Category, sub: Subcategory) => {
    setSubModalCat(cat)
    setSelectedSub(sub)
    setSubModalOpen(true)
  }

  const handleDeleteSubcategoryPrompt = (sub: Subcategory) => {
    const usage = subcategoryStats[sub.id]?.count || 0
    if (usage > 0) {
      toast.error(
        `Esta subcategoria não pode ser excluída pois possui ${usage} lançamento(s) vinculado(s).`,
      )
      return
    }
    setSubToDelete(sub)
    setConfirmDeleteSubOpen(true)
  }

  const confirmDeleteSubcategory = async () => {
    if (!subToDelete) return
    try {
      await deleteSubcategory(subToDelete.id)
      toast.success('Subcategoria excluída com sucesso!')
      setSubToDelete(null)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir subcategoria.')
    }
  }

  const renderCategoryList = (list: Category[], type: TransactionType) => {
    return (
      <div className="space-y-4">
        {list.map((cat) => {
          const stats = categoryStats[cat.id] || { count: 0, totalAmount: 0 }
          const catSubs = subcategoriesByCategory[cat.id] || []
          const isExpanded = expandedCats[cat.id] !== false // default expanded

          return (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200"
            >
              {/* Category Header Card */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
                    style={{ backgroundColor: cat.color }}
                  >
                    <DynamicIcon name={cat.icon || 'Tag'} className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                        {cat.name}
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600 border border-slate-200">
                        {catSubs.length} {catSubs.length === 1 ? 'subcategoria' : 'subcategorias'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>
                        {stats.count} {stats.count === 1 ? 'lançamento' : 'lançamentos'}
                      </span>
                      <span>•</span>
                      <span>
                        Total:{' '}
                        <strong
                          className={
                            type === 'despesa'
                              ? 'text-rose-600 font-semibold'
                              : 'text-emerald-600 font-semibold'
                          }
                        >
                          {formatCurrency(stats.totalAmount)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {canManageFinance && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCreateSubcategory(cat)}
                        className="rounded-xl h-9 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Subcategoria</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cat)}
                        className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-lg"
                        title="Editar categoria"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePrompt(cat)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                        title="Excluir categoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleCategoryExpand(cat.id)}
                    className="h-8 w-8 text-slate-500 hover:text-slate-800 rounded-lg"
                    title={isExpanded ? 'Recolher subcategorias' : 'Expandir subcategorias'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Subcategories Accordion Content */}
              {isExpanded && (
                <div className="p-4 bg-white space-y-3">
                  {catSubs.length === 0 ? (
                    <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                      <FolderTree className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-medium">
                        Nenhuma subcategoria cadastrada para {cat.name}.
                      </p>
                      {canManageFinance && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleOpenCreateSubcategory(cat)}
                          className="text-xs text-indigo-600 hover:underline mt-1 font-semibold p-0 h-auto"
                        >
                          + Adicionar primeira subcategoria
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {catSubs.map((sub) => {
                        const subStat = subcategoryStats[sub.id] || { count: 0, totalAmount: 0 }
                        const effectiveColor = sub.color || cat.color
                        const effectiveIcon = sub.icon || cat.icon || 'Tag'

                        return (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300 transition-all group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs shrink-0 shadow-sm"
                                style={{ backgroundColor: effectiveColor }}
                              >
                                <DynamicIcon name={effectiveIcon} className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-xs text-slate-800 truncate">
                                  {sub.name}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                  <span>{subStat.count} lanç.</span>
                                  <span>•</span>
                                  <span
                                    className={`font-semibold tabular-nums ${
                                      type === 'despesa' ? 'text-rose-600' : 'text-emerald-600'
                                    }`}
                                  >
                                    {formatCurrency(subStat.totalAmount)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {canManageFinance && (
                              <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditSubcategory(cat, sub)}
                                  className="h-7 w-7 text-slate-400 hover:text-indigo-600 rounded-md"
                                  title="Editar subcategoria"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteSubcategoryPrompt(sub)}
                                  className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-md"
                                  title="Excluir subcategoria"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Add subcategory button block */}
                      {canManageFinance && (
                        <button
                          onClick={() => handleOpenCreateSubcategory(cat)}
                          className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-slate-500 hover:text-indigo-600 text-xs font-semibold transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nova Subcategoria</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Create category button card */}
        {canManageFinance && (
          <button
            onClick={handleOpenCreate}
            className="w-full border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-slate-900">Criar Nova Categoria Principal</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Crie uma categoria para agrupar novas subcategorias
            </p>
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
          {renderCategoryList(expenseCategories, 'despesa')}
        </TabsContent>

        <TabsContent value="receita" className="focus-visible:outline-none">
          {renderCategoryList(incomeCategories, 'receita')}
        </TabsContent>
      </Tabs>

      {/* Category Modal */}
      <CategoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        category={selectedCat}
        defaultType={activeTab}
      />

      {/* Subcategory Modal */}
      <SubcategoryModal
        open={subModalOpen}
        onOpenChange={setSubModalOpen}
        category={subModalCat}
        subcategory={selectedSub}
      />

      {/* Confirm Delete Category Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir Categoria"
        description={`Tem certeza que deseja excluir a categoria "${catToDelete?.name}"?`}
        confirmText="Excluir Categoria"
        variant="danger"
        onConfirm={confirmDelete}
      />

      {/* Confirm Delete Subcategory Dialog */}
      <ConfirmDialog
        open={confirmDeleteSubOpen}
        onOpenChange={setConfirmDeleteSubOpen}
        title="Excluir Subcategoria"
        description={`Tem certeza que deseja excluir a subcategoria "${subToDelete?.name}"?`}
        confirmText="Excluir Subcategoria"
        variant="danger"
        onConfirm={confirmDeleteSubcategory}
      />
    </div>
  )
}
