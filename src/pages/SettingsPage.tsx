import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { SegmentType } from '@/types/database'
import { PALETTE_COLORS } from '@/lib/skip-cloud'
import { maskCNPJ } from '@/lib/formatters'
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
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const SEGMENTS: SegmentType[] = ['Serviços', 'Comércio', 'Indústria', 'Tecnologia', 'Outro']

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { currentCompany, userCompanies, isOwner, updateCompany, deleteCompany, selectCompany } =
    useCompany()
  const navigate = useNavigate()

  // Tab 1: Empresa details
  const [name, setName] = useState(currentCompany?.name || '')
  const [cnpj, setCnpj] = useState(currentCompany?.cnpj || '')
  const [segment, setSegment] = useState<SegmentType>(currentCompany?.segment || 'Serviços')
  const [color, setColor] = useState(currentCompany?.color || PALETTE_COLORS[0])
  const [isSavingCompany, setIsSavingCompany] = useState(false)

  // Tab 2: Preferences
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [dateFormat] = useState('DD/MM/YYYY')
  const [currency] = useState('BRL (R$)')

  // Danger Zone
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)

  React.useEffect(() => {
    if (currentCompany) {
      setName(currentCompany.name)
      setCnpj(currentCompany.cnpj || '')
      setSegment(currentCompany.segment)
      setColor(currentCompany.color)
    }
  }, [currentCompany])

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome da empresa.')
      return
    }

    setIsSavingCompany(true)
    try {
      await updateCompany({
        name,
        cnpj,
        segment,
        color,
      })
      toast.success('Informações da empresa salvas com sucesso!')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar empresa.')
    } finally {
      setIsSavingCompany(false)
    }
  }

  const handleDeleteCompany = async () => {
    if (deleteConfirmationText.trim() !== currentCompany?.name.trim()) {
      toast.error('O nome digitado não corresponde exatamente ao nome da empresa.')
      return
    }

    setIsDeletingCompany(true)
    try {
      await deleteCompany()
      toast.success('Empresa excluída com sucesso!')
      setDeleteModalOpen(false)
      navigate('/empresas')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir empresa.')
    } finally {
      setIsDeletingCompany(false)
    }
  }

  const handleSwitchCompany = async (targetId: string) => {
    const ok = await selectCompany(targetId)
    if (ok) {
      navigate(`/empresa/${targetId}/dashboard`)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Configurações da Empresa
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gerencie dados cadastrais, preferências do ambiente e credenciais de acesso.
        </p>
      </div>

      <Tabs defaultValue="empresa" className="space-y-6">
        <TabsList className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-3 max-w-md">
          <TabsTrigger
            value="empresa"
            className="rounded-xl font-semibold text-xs flex items-center gap-1.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            <Building2 className="w-4 h-4" />
            <span>Empresa</span>
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
        </TabsList>

        {/* TAB 1: EMPRESA */}
        <TabsContent value="empresa" className="space-y-6 focus-visible:outline-none">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Dados da Organização</h2>
            <p className="text-xs text-slate-500 mb-6">
              Esses dados identificam seu tenant no relatório consolidado.
            </p>

            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="company-name" className="text-sm font-medium text-slate-700">
                  Nome Fantasia / Razão Social *
                </Label>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl h-11"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company-cnpj" className="text-sm font-medium text-slate-700">
                    CNPJ
                  </Label>
                  <Input
                    id="company-cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="company-segment" className="text-sm font-medium text-slate-700">
                    Segmento de Mercado
                  </Label>
                  <Select value={segment} onValueChange={(v: SegmentType) => setSegment(v)}>
                    <SelectTrigger id="company-segment" className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {SEGMENTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <h2 className="text-base font-bold">Zona de Perigo — Exclusão da Empresa</h2>
              </div>
              <p className="text-xs text-rose-600/90 leading-relaxed">
                A exclusão desta organização apagará permanentemente todas as contas bancárias,
                categorias, lançamentos de extrato e revogará o acesso de todos os colaboradores
                associados. Esta ação <strong>não pode ser desfeita</strong>.
              </p>
              <div className="pt-2">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteModalOpen(true)}
                  className="rounded-xl h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                >
                  Excluir Empresa Definitivamente
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
            <h2 className="text-base font-bold text-slate-900">Minhas Outras Empresas</h2>
            <p className="text-xs text-slate-500">
              Alterne rapidamente para outro ambiente cadastrado no seu usuário.
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
                        <p className="text-xs text-slate-400">{comp.segment}</p>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Empresa Atual
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
                onClick={() => navigate('/empresas')}
                className="rounded-xl h-11"
              >
                <Building className="w-4 h-4 mr-2" />
                Trocar Empresa
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
      </Tabs>

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
                  Excluir Empresa
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
              exato da empresa no campo abaixo:
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
                'Confirmar Exclusão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
