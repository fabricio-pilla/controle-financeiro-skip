import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { PALETTE_COLORS } from '@/lib/skip-cloud'
import { toast } from 'sonner'
import { Building2, Sliders, LogOut, AlertTriangle, Loader2, Trash2, Calendar } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { sleep, executeWithRetry, runInPool, is429Error } from '@/lib/pocketbase/retry'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { currentCompany, updateCompany, reloadCompanyData, applyTransactionsBatchUpdate } =
    useCompany()
  const navigate = useNavigate()

  // Tab 1: Controle details
  const [name, setName] = useState(currentCompany?.name || '')
  const [color, setColor] = useState(currentCompany?.color || PALETTE_COLORS[0])
  const [description, setDescription] = useState(currentCompany?.description || '')
  const [isSavingCompany, setIsSavingCompany] = useState(false)

  // Tab 2: Preferences
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [dateFormat] = useState('DD/MM/YYYY')
  const [currency] = useState('BRL (R$)')

  // Tab 4: Limpeza de Dados
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false)
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('')
  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const [deleteAllProgress, setDeleteAllProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  const [deleteMonthModalOpen, setDeleteMonthModalOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number>(1)
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [isDeletingMonth, setIsDeletingMonth] = useState(false)
  const [deleteMonthProgress, setDeleteMonthProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  React.useEffect(() => {
    if (currentCompany) {
      setName(currentCompany.name)
      setColor(currentCompany.color)
      setDescription(currentCompany.description || '')
    }
  }, [currentCompany])

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome do controle.')
      return
    }

    setIsSavingCompany(true)
    try {
      await updateCompany({
        name,
        color,
        description,
      })
      toast.success('Informações do controle salvas com sucesso!')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar controle.')
    } finally {
      setIsSavingCompany(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  /**
   * Helper para buscar exaustivamente todas as transações com paginação garantida em laço
   */
  const fetchAllTransactionsByFilter = async (filter: string, tag: string) => {
    const allRecords: { id: string; account_id?: string }[] = []
    let page = 1
    const perPage = 200

    while (true) {
      const currentPage = page
      const result = await executeWithRetry(
        () =>
          pb
            .collection('transactions')
            .getList<{ id: string; account_id?: string }>(currentPage, perPage, {
              filter,
              fields: 'id,account_id',
              sort: '-created',
            }),
        7,
        1000,
        `${tag}-Pagina-${currentPage}`,
        30000,
      )

      allRecords.push(...result.items)
      if (currentPage >= result.totalPages || result.items.length === 0) {
        break
      }
      page++
    }

    return allRecords
  }

  const handleDeleteAllTransactions = async () => {
    if (deleteAllConfirmText.trim() !== 'EXCLUIR TUDO') {
      toast.error('Digite "EXCLUIR TUDO" para confirmar.')
      return
    }
    if (!currentCompany?.id) {
      toast.error('Nenhum controle selecionado.')
      return
    }

    setIsDeletingAll(true)
    setDeleteAllProgress(null)

    try {
      const companyId = currentCompany.id
      const filter = `control_id="${companyId}"`

      let totalDeletedCount = 0
      let failedDeletions = 0
      const maxSweeps = 4

      // Varredura em laço com verificação pós-exclusão
      for (let sweep = 1; sweep <= maxSweeps; sweep++) {
        // 1. Obter todas as transações com paginação garantida
        const records = await fetchAllTransactionsByFilter(filter, `Limpeza-Total-Sweep${sweep}`)

        if (records.length === 0) {
          break
        }

        if (sweep === 1) {
          setDeleteAllProgress({ current: 0, total: records.length })
          // Atualização otimista imediata na UI
          const deletedIds = records.map((r) => r.id)
          applyTransactionsBatchUpdate({ deletedIds })
        } else {
          // Atualiza progresso da rodada de re-verificação
          setDeleteAllProgress({ current: 0, total: records.length })
        }

        let completedInSweep = 0
        const sweepErrors: string[] = []

        // 2. Excluir lançamentos com taxa controlada (concorrência 2, 80ms entre requisições)
        // e retry robusto para 429/rede
        await runInPool(
          records,
          async (rec) => {
            try {
              try {
                await pb.collection('transactions').delete(rec.id)
              } catch (itemErr: any) {
                const status =
                  itemErr?.status ??
                  itemErr?.statusCode ??
                  itemErr?.response?.status ??
                  itemErr?.originalError?.status
                // Se já retornar 404, o item já foi removido (não conta como erro)
                if (status === 404) {
                  return
                }
                // Não loga no console se for erro 429 para evitar falsos positivos no monitor de runtime
                if (!is429Error(itemErr)) {
                  console.error(`Erro ao excluir transação ${rec.id}:`, itemErr)
                }
                sweepErrors.push(rec.id)
              }
            } catch (unexpectedErr: any) {
              // Garante que mesmo qualquer exceção imprevista não escape do worker
              if (!is429Error(unexpectedErr)) {
                console.warn(`Exceção não tratada ao excluir transação ${rec.id}:`, unexpectedErr)
              }
              if (!sweepErrors.includes(rec.id)) {
                sweepErrors.push(rec.id)
              }
            } finally {
              completedInSweep++
              setDeleteAllProgress({ current: completedInSweep, total: records.length })
            }
          },
          {
            concurrency: 2,
            delayBetweenBatchesMs: 80,
            maxRetries: 7,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            tag: `Limpeza-Total-Delete-Sweep${sweep}`,
          },
        )

        totalDeletedCount += completedInSweep - sweepErrors.length

        // Se todos foram removidos nesta rodada sem erros, faz uma pausa curta antes de checar sweep final
        if (sweepErrors.length === 0) {
          await sleep(300)
        } else {
          failedDeletions = sweepErrors.length
          await sleep(1000)
        }
      }

      // Verificação final do banco: checar se sobrou algum registro
      const remainingCheck = await executeWithRetry(
        () =>
          pb.collection('transactions').getList(1, 1, {
            filter,
            fields: 'id',
          }),
        5,
        1000,
        'Limpeza-Total-ChecagemFinal',
        15000,
      )

      const remainingTotal = remainingCheck.totalItems || 0

      // 3. Zerar o saldo de todas as contas do controle ativo de forma concorrente em lote único
      const accountsList = await executeWithRetry(
        () =>
          pb.collection('accounts').getFullList<{ id: string }>({
            filter: `control_id="${companyId}"`,
            fields: 'id',
          }),
        5,
        1000,
        'Limpeza-Total-Contas',
        10000,
      )

      let failedAccounts = 0
      if (accountsList.length > 0) {
        await runInPool(
          accountsList,
          async (acc) => {
            try {
              try {
                await pb.collection('accounts').update(acc.id, { balance: 0 })
              } catch (accErr) {
                if (!is429Error(accErr)) {
                  console.error(`Erro ao zerar saldo da conta ${acc.id}:`, accErr)
                }
                failedAccounts++
              }
            } catch (unexpectedAccErr) {
              if (!is429Error(unexpectedAccErr)) {
                console.warn(`Exceção não tratada ao zerar conta ${acc.id}:`, unexpectedAccErr)
              }
              failedAccounts++
            }
          },
          {
            concurrency: 2,
            delayBetweenBatchesMs: 80,
            maxRetries: 7,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            tag: 'Limpeza-Total-ZerarConta',
          },
        )
      }

      // 4. Recarregar dados do controle para sincronizar dashboard e contas
      await reloadCompanyData()

      if (remainingTotal > 0 || failedAccounts > 0) {
        toast.warning(
          `Limpeza parcial: ${remainingTotal} lançamento(s) e ${failedAccounts} conta(s) ainda não puderam ser processados devido a instabilidade/limites do servidor. Execute a limpeza novamente para finalizar os restantes.`,
          { duration: 8000 },
        )
      } else {
        toast.success('Todos os lançamentos foram removidos e os saldos das contas foram zerados.')
        setDeleteAllModalOpen(false)
        setDeleteAllConfirmText('')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover lançamentos e zerar contas.')
    } finally {
      setIsDeletingAll(false)
      setDeleteAllProgress(null)
    }
  }

  const handleDeleteMonthTransactions = async () => {
    if (!currentCompany?.id) {
      toast.error('Nenhum controle selecionado.')
      return
    }

    setIsDeletingMonth(true)
    setDeleteMonthProgress(null)

    try {
      const companyId = currentCompany.id
      const padMonth = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
      const padLastDay = String(lastDay).padStart(2, '0')
      const startDate = `${selectedYear}-${padMonth}-01`
      const endDate = `${selectedYear}-${padMonth}-${padLastDay}`
      const filter = `control_id="${companyId}" && date>="${startDate}" && date<="${endDate}"`

      let totalDeletedCount = 0
      let failedDeletions = 0
      const maxSweeps = 3

      for (let sweep = 1; sweep <= maxSweeps; sweep++) {
        // 1. Obter lançamentos do mês selecionado com paginação completa
        const records = await fetchAllTransactionsByFilter(filter, `Limpeza-Mes-Sweep${sweep}`)

        if (records.length === 0) {
          break
        }

        if (sweep === 1) {
          setDeleteMonthProgress({ current: 0, total: records.length })
          // Atualização otimista imediata na UI
          const deletedMonthIds = records.map((r) => r.id)
          applyTransactionsBatchUpdate({ deletedIds: deletedMonthIds })
        } else {
          setDeleteMonthProgress({ current: 0, total: records.length })
        }

        let completedInSweep = 0
        const sweepErrors: string[] = []

        // 2. Excluir lançamentos com concorrência 2, delay de 80ms e retry anti-429/rede
        await runInPool(
          records,
          async (rec) => {
            try {
              try {
                await pb.collection('transactions').delete(rec.id)
              } catch (itemErr: any) {
                const status =
                  itemErr?.status ??
                  itemErr?.statusCode ??
                  itemErr?.response?.status ??
                  itemErr?.originalError?.status
                if (status === 404) return
                if (!is429Error(itemErr)) {
                  console.error(`Erro ao excluir transação ${rec.id}:`, itemErr)
                }
                sweepErrors.push(rec.id)
              }
            } catch (unexpectedErr: any) {
              if (!is429Error(unexpectedErr)) {
                console.warn(`Exceção não tratada ao excluir transação ${rec.id}:`, unexpectedErr)
              }
              if (!sweepErrors.includes(rec.id)) {
                sweepErrors.push(rec.id)
              }
            } finally {
              completedInSweep++
              setDeleteMonthProgress({ current: completedInSweep, total: records.length })
            }
          },
          {
            concurrency: 2,
            delayBetweenBatchesMs: 80,
            maxRetries: 7,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            tag: `Limpeza-Mes-Delete-Sweep${sweep}`,
          },
        )

        totalDeletedCount += completedInSweep - sweepErrors.length

        if (sweepErrors.length === 0) {
          await sleep(300)
        } else {
          failedDeletions = sweepErrors.length
          await sleep(1000)
        }
      }

      // Verificação final do mês
      const remainingCheck = await executeWithRetry(
        () =>
          pb.collection('transactions').getList(1, 1, {
            filter,
            fields: 'id',
          }),
        5,
        1000,
        'Limpeza-Mes-ChecagemFinal',
        15000,
      )

      const remainingTotal = remainingCheck.totalItems || 0

      // 3. Zerar o saldo de todas as contas do controle ativo
      const accountsList = await executeWithRetry(
        () =>
          pb.collection('accounts').getFullList<{ id: string }>({
            filter: `control_id="${companyId}"`,
            fields: 'id',
          }),
        5,
        1000,
        'Limpeza-Mes-Contas',
        10000,
      )

      let failedAccounts = 0
      if (accountsList.length > 0) {
        await runInPool(
          accountsList,
          async (acc) => {
            try {
              try {
                await pb.collection('accounts').update(acc.id, { balance: 0 })
              } catch (accErr) {
                if (!is429Error(accErr)) {
                  console.error(`Erro ao zerar saldo da conta ${acc.id}:`, accErr)
                }
                failedAccounts++
              }
            } catch (unexpectedAccErr) {
              if (!is429Error(unexpectedAccErr)) {
                console.warn(`Exceção não tratada ao zerar conta ${acc.id}:`, unexpectedAccErr)
              }
              failedAccounts++
            }
          },
          {
            concurrency: 2,
            delayBetweenBatchesMs: 80,
            maxRetries: 7,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            tag: 'Limpeza-Mes-ZerarConta',
          },
        )
      }

      // 4. Recarregar dados do controle para atualizar dashboard e contas imediatamente
      await reloadCompanyData()
      const monthObj = MONTHS.find((m) => m.value === selectedMonth)
      const monthLabel = monthObj ? monthObj.label : `${selectedMonth}`
      if (remainingTotal > 0 || failedAccounts > 0) {
        toast.warning(
          `Limpeza de ${monthLabel}/${selectedYear} parcial: ${remainingTotal} lançamento(s) e ${failedAccounts} conta(s) ainda restam no servidor. Execute novamente para finalizar os restantes.`,
          { duration: 8000 },
        )
      } else {
        toast.success(
          `Lançamentos de ${monthLabel}/${selectedYear} foram removidos e os saldos das contas foram zerados.`,
        )
        setDeleteMonthModalOpen(false)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover lançamentos do mês e zerar contas.')
    } finally {
      setIsDeletingMonth(false)
      setDeleteMonthProgress(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Configurações do Controle
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gerencie dados cadastrais, preferências do ambiente e credenciais de acesso.
        </p>
      </div>

      <Tabs defaultValue="controle" className="space-y-6">
        <TabsList className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-4 max-w-xl">
          <TabsTrigger
            value="controle"
            className="rounded-xl font-semibold text-xs flex items-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Building2 className="w-4 h-4" />
            <span>Controle</span>
          </TabsTrigger>
          <TabsTrigger
            value="preferencias"
            className="rounded-xl font-semibold text-xs flex items-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Sliders className="w-4 h-4" />
            <span>Preferências</span>
          </TabsTrigger>
          <TabsTrigger
            value="sessao"
            className="rounded-xl font-semibold text-xs flex items-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <LogOut className="w-4 h-4" />
            <span>Sessão</span>
          </TabsTrigger>
          <TabsTrigger
            value="limpeza"
            className="rounded-xl font-semibold text-xs flex items-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpeza</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CONTROLE */}
        <TabsContent value="controle" className="space-y-6 focus-visible:outline-none">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Dados do Controle</h2>
            <p className="text-xs text-slate-500 mb-6">
              Esses dados identificam seu controle financeiro.
            </p>

            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="company-name" className="text-sm font-medium text-slate-700">
                  Nome do Controle *
                </Label>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl h-11"
                  required
                />
              </div>

              <div className="space-y-2 pt-1">
                <Label className="text-sm font-medium text-slate-700">Cor de Identificação</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PALETTE_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${
                        color === c
                          ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                          : 'hover:scale-105'
                      }`}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-description" className="text-sm font-medium text-slate-700">
                  Descrição
                </Label>
                <Textarea
                  id="company-description"
                  placeholder="Breve descrição do seu controle..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl min-h-[80px] resize-none"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSavingCompany}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-6 font-semibold"
                >
                  {isSavingCompany ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* TAB 2: PREFERENCIAS */}
        <TabsContent value="preferencias" className="space-y-6 focus-visible:outline-none">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900">
              Configurações Regionais & Padrões
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">Moeda Padrão</Label>
                <Input
                  value={currency}
                  disabled
                  className="rounded-xl h-11 bg-slate-50 text-slate-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Formato de Exibição de Data
                </Label>
                <Input
                  value={dateFormat}
                  disabled
                  className="rounded-xl h-11 bg-slate-50 text-slate-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <Label htmlFor="notify-toggle" className="text-sm font-bold text-slate-800">
                  Notificações por E-mail
                </Label>
                <p className="text-xs text-slate-500">
                  Receba alertas semanais sobre fechamento e balanço consolidado.
                </p>
              </div>
              <Switch
                id="notify-toggle"
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: SESSAO */}
        <TabsContent value="sessao" className="space-y-6 focus-visible:outline-none">
          {/* User Session Info */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Sessão do Usuário</h2>
            <p className="text-xs text-slate-500">
              Conectado como <strong>{user?.name}</strong> ({user?.email})
            </p>

            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="destructive"
                onClick={handleLogout}
                className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair do Sistema
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: LIMPEZA DE DADOS */}
        <TabsContent value="limpeza" className="space-y-6 focus-visible:outline-none">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-8">
            {/* Seção 1: Limpeza Total */}
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Limpeza Total de Lançamentos e Saldos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Remove permanentemente TODOS os lançamentos (receitas e despesas) e zera o saldo
                  de todas as contas deste controle financeiro. Esta ação não pode ser desfeita.
                </p>
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteAllConfirmText('')
                    setDeleteAllModalOpen(true)
                  }}
                  className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Todos os Lançamentos e Zerar Contas
                </Button>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Seção 2: Limpeza por Mês */}
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Limpeza por Mês e Saldos</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Remove todos os lançamentos de um mês específico e zera o saldo de todas as contas
                  deste controle financeiro.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                <div className="space-y-1.5">
                  <Label htmlFor="cleanup-month" className="text-sm font-medium text-slate-700">
                    Mês
                  </Label>
                  <select
                    id="cleanup-month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cleanup-year" className="text-sm font-medium text-slate-700">
                    Ano
                  </Label>
                  <Input
                    id="cleanup-year"
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value) || 2026)}
                    className="rounded-xl h-11"
                    min={2000}
                    max={2100}
                  />
                </div>
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteMonthModalOpen(true)}
                  className="rounded-xl h-11 border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-semibold"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Excluir Lançamentos do Mês e Zerar Contas
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Confirm Delete All Transactions with "EXCLUIR TUDO" text */}
      <Dialog open={deleteAllModalOpen} onOpenChange={setDeleteAllModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Limpeza Total de Lançamentos e Contas
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-1">
                  Esta ação excluirá permanentemente todos os lançamentos e zerará os saldos das
                  contas deste controle.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <p className="text-xs text-slate-600">
              Para confirmar a exclusão de todos os lançamentos e zerar o saldo de todas as contas
              do controle <strong>{currentCompany?.name}</strong>, digite exatamente{' '}
              <strong className="text-rose-600">EXCLUIR TUDO</strong> no campo abaixo:
            </p>

            <Input
              placeholder="EXCLUIR TUDO"
              value={deleteAllConfirmText}
              onChange={(e) => setDeleteAllConfirmText(e.target.value)}
              disabled={isDeletingAll}
              className="rounded-xl h-11 border-rose-300 focus-visible:ring-rose-500 font-medium"
            />

            {isDeletingAll && deleteAllProgress && (
              <div className="space-y-2 pt-2 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                  <span>Excluindo lançamentos com taxa controlada...</span>
                  <span>
                    {deleteAllProgress.current} de {deleteAllProgress.total}
                  </span>
                </div>
                <Progress
                  value={
                    deleteAllProgress.total > 0
                      ? (deleteAllProgress.current / deleteAllProgress.total) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteAllModalOpen(false)
                setDeleteAllConfirmText('')
              }}
              className="rounded-xl h-11"
              disabled={isDeletingAll}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteAllConfirmText.trim() !== 'EXCLUIR TUDO' || isDeletingAll}
              onClick={handleDeleteAllTransactions}
              className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isDeletingAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo e zerando contas...
                </>
              ) : (
                'Confirmar Exclusão Total'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Confirm Delete Month Transactions */}
      <Dialog open={deleteMonthModalOpen} onOpenChange={setDeleteMonthModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Excluir Lançamentos do Mês e Zerar Contas
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-1">
                  Confirmação de exclusão por período e zeramento de saldos.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <p className="text-sm text-slate-700">
              Tem certeza que deseja excluir todos os lançamentos de{' '}
              <strong className="text-rose-600">
                {MONTHS.find((m) => m.value === selectedMonth)?.label} de {selectedYear}
              </strong>{' '}
              e zerar o saldo de todas as contas do controle <strong>{currentCompany?.name}</strong>
              ?
            </p>
            <p className="text-xs text-slate-500">
              Esta ação removerá os lançamentos deste mês e ano e definirá o saldo de todas as
              contas como R$ 0,00.
            </p>

            {isDeletingMonth && deleteMonthProgress && (
              <div className="space-y-2 pt-2 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                  <span>Excluindo lançamentos com taxa controlada...</span>
                  <span>
                    {deleteMonthProgress.current} de {deleteMonthProgress.total}
                  </span>
                </div>
                <Progress
                  value={
                    deleteMonthProgress.total > 0
                      ? (deleteMonthProgress.current / deleteMonthProgress.total) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteMonthModalOpen(false)}
              className="rounded-xl h-11"
              disabled={isDeletingMonth}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteMonthTransactions}
              disabled={isDeletingMonth}
              className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isDeletingMonth ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo e zerando contas...
                </>
              ) : (
                'Excluir Lançamentos e Zerar Contas'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
