import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { PALETTE_COLORS } from '@/lib/skip-cloud'
import { toast } from 'sonner'
import {
  Building2,
  Sliders,
  LogOut,
  AlertTriangle,
  Loader2,
  Building,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Calendar,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
  const {
    currentCompany,
    userCompanies,
    isOwner,
    updateCompany,
    deleteCompany,
    selectCompany,
    reloadCompanyData,
  } = useCompany()
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

  // Danger Zone
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)

  // Tab 4: Limpeza de Dados
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false)
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('')
  const [isDeletingAll, setIsDeletingAll] = useState(false)

  const [deleteMonthModalOpen, setDeleteMonthModalOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number>(1)
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [isDeletingMonth, setIsDeletingMonth] = useState(false)

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

  const handleDeleteCompany = async () => {
    if (deleteConfirmationText.trim() !== currentCompany?.name.trim()) {
      toast.error('O nome digitado não corresponde exatamente ao nome do controle.')
      return
    }

    setIsDeletingCompany(true)
    try {
      await deleteCompany()
      toast.success('Controle excluído com sucesso!')
      setDeleteModalOpen(false)
      navigate('/controles')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir controle.')
    } finally {
      setIsDeletingCompany(false)
    }
  }

  const handleSwitchCompany = async (targetId: string) => {
    const ok = await selectCompany(targetId)
    if (ok) {
      navigate(`/controle/${targetId}/dashboard`)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
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
    try {
      // 1. Excluir todas as transações do controle ativo
      const records = await pb.collection('transactions').getFullList({
        filter: `control_id="${currentCompany.id}"`,
        fields: 'id',
      })

      for (const rec of records) {
        await pb.collection('transactions').delete(rec.id)
      }

      // 2. Zerar o saldo de todas as contas do controle ativo
      const accountsList = await pb.collection('accounts').getFullList({
        filter: `control_id="${currentCompany.id}"`,
        fields: 'id',
      })

      for (const acc of accountsList) {
        await pb.collection('accounts').update(acc.id, { balance: 0 })
      }

      // 3. Recarregar dados do controle para atualizar dashboard e contas imediatamente
      await reloadCompanyData()
      toast.success('Todos os lançamentos foram removidos e os saldos das contas foram zerados.')
      setDeleteAllModalOpen(false)
      setDeleteAllConfirmText('')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover lançamentos e zerar contas.')
    } finally {
      setIsDeletingAll(false)
    }
  }

  const handleDeleteMonthTransactions = async () => {
    if (!currentCompany?.id) {
      toast.error('Nenhum controle selecionado.')
      return
    }

    setIsDeletingMonth(true)
    try {
      const padMonth = String(selectedMonth).padStart(2, '0')
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
      const padLastDay = String(lastDay).padStart(2, '0')
      const startDate = `${selectedYear}-${padMonth}-01`
      const endDate = `${selectedYear}-${padMonth}-${padLastDay}`

      // 1. Excluir lançamentos do mês selecionado
      const records = await pb.collection('transactions').getFullList({
        filter: `control_id="${currentCompany.id}" && date>="${startDate}" && date<="${endDate}"`,
        fields: 'id',
      })

      for (const rec of records) {
        await pb.collection('transactions').delete(rec.id)
      }

      // 2. Zerar o saldo de todas as contas do controle ativo
      const accountsList = await pb.collection('accounts').getFullList({
        filter: `control_id="${currentCompany.id}"`,
        fields: 'id',
      })

      for (const acc of accountsList) {
        await pb.collection('accounts').update(acc.id, { balance: 0 })
      }

      // 3. Recarregar dados do controle para atualizar dashboard e contas imediatamente
      await reloadCompanyData()
      const monthObj = MONTHS.find((m) => m.value === selectedMonth)
      const monthLabel = monthObj ? monthObj.label : `${selectedMonth}`
      toast.success(
        `Lançamentos de ${monthLabel}/${selectedYear} foram removidos e os saldos das contas foram zerados.`,
      )
      setDeleteMonthModalOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover lançamentos do mês e zerar contas.')
    } finally {
      setIsDeletingMonth(false)
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

          {/* Danger Zone (Owner Only) */}
          {isOwner && (
            <div className="bg-rose-50/50 border border-rose-200 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-rose-700">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h2 className="text-base font-bold">Zona de Perigo — Exclusão do Controle</h2>
              </div>
              <p className="text-xs text-rose-600/90 leading-relaxed">
                A exclusão deste controle apagará permanentemente todas as contas bancárias,
                categorias, lançamentos de extrato e revogará o acesso de todos os colaboradores
                associados. Esta ação <strong>não pode ser desfeita</strong>.
              </p>
              <div className="pt-2">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteModalOpen(true)}
                  className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Excluir Controle Definitivamente
                </Button>
              </div>
            </div>
          )}
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
          {/* Switch Company Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Meus Outros Controles</h2>
            <p className="text-xs text-slate-500">
              Alterne rapidamente para outro controle cadastrado no seu usuário.
            </p>

            <div className="space-y-2.5">
              {userCompanies.map((comp) => {
                const isCurrent = comp.id === currentCompany?.id
                return (
                  <div
                    key={comp.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: comp.color }}
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{comp.name}</p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Controle Atual
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSwitchCompany(comp.id)}
                        className="rounded-xl h-8 text-xs font-semibold"
                      >
                        <span>Acessar</span>
                        <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* User Session Info */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Sessão do Usuário</h2>
            <p className="text-xs text-slate-500">
              Conectado como <strong>{user?.name}</strong> ({user?.email})
            </p>

            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/controles')}
                className="rounded-xl h-11"
              >
                <Building className="w-4 h-4 mr-2" />
                Trocar Controle
              </Button>
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
              className="rounded-xl h-11 border-rose-300 focus-visible:ring-rose-500 font-medium"
            />
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

      {/* Modal Confirm Delete Company with Type-Name Security */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Excluir Controle
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-1">
                  Esta operação é irreversível. Todos os lançamentos e contas serão destruídos.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <p className="text-xs text-slate-600">
              Para confirmar a exclusão de <strong>{currentCompany?.name}</strong>, digite o nome
              exato do controle no campo abaixo:
            </p>

            <Input
              placeholder={currentCompany?.name}
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="rounded-xl h-11 border-rose-300 focus-visible:ring-rose-500 font-medium"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-xl h-11"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deleteConfirmationText.trim() !== currentCompany?.name.trim() || isDeletingCompany
              }
              onClick={handleDeleteCompany}
              className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isDeletingCompany ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Controle Definitivamente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
