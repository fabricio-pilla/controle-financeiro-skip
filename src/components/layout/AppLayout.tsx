import React, { useState } from 'react'
import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import {
  LayoutDashboard,
  ReceiptText,
  CreditCard,
  FolderTree,
  Users2,
  Settings,
  Plus,
  LogOut,
  Building2,
  ChevronDown,
  Menu,
  Check,
  PlusCircle,
  ExternalLink,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CreateCompanyModal } from '@/components/companies/CreateCompanyModal'
import { TransactionModal } from '@/components/transactions/TransactionModal'
import { getInitials } from '@/lib/formatters'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth()
  const { currentCompany, userCompanies, currentRole, selectCompany } = useCompany()
  const navigate = useNavigate()
  const location = useLocation()
  const { empresaId } = useParams<{ empresaId: string }>()

  const [createCompanyOpen, setCreateCompanyOpen] = useState(false)
  const [newTxOpen, setNewTxOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const activeEmpresaId = empresaId || currentCompany?.id || ''

  const navItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: `/empresa/${activeEmpresaId}/dashboard`,
    },
    {
      label: 'Lançamentos',
      icon: ReceiptText,
      path: `/empresa/${activeEmpresaId}/lancamentos`,
    },
    {
      label: 'Contas',
      icon: CreditCard,
      path: `/empresa/${activeEmpresaId}/contas`,
    },
    {
      label: 'Categorias',
      icon: FolderTree,
      path: `/empresa/${activeEmpresaId}/categorias`,
    },
    {
      label: 'Equipe',
      icon: Users2,
      path: `/empresa/${activeEmpresaId}/equipe`,
    },
    {
      label: 'Configurações',
      icon: Settings,
      path: `/empresa/${activeEmpresaId}/configuracoes`,
    },
  ]

  const handleSelectCompany = async (targetId: string) => {
    const success = await selectCompany(targetId)
    if (success) {
      // Re-route to target company dashboard
      navigate(`/empresa/${targetId}/dashboard`)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const roleLabel = {
    owner: 'Proprietário',
    admin: 'Administrador',
    member: 'Membro',
  }[currentRole || 'member']

  // Sidebar content (shared by desktop and mobile sheet)
  const SidebarContent = () => (
    <aside className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white select-none">
      {/* Brand & Company Switcher */}
      <div className="p-4 border-b border-slate-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-all text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 text-sm shadow-md"
                  style={{ backgroundColor: currentCompany?.color || '#6366F1' }}
                >
                  {currentCompany ? getInitials(currentCompany.name) : 'EX'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {currentCompany?.name || 'Selecione a empresa'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate capitalize">
                    {currentCompany?.segment || 'Multiempresa'} • {roleLabel}
                  </p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded-xl bg-slate-900 border-slate-800 text-white p-1">
            <DropdownMenuLabel className="text-xs text-slate-400 px-2 py-1.5 font-medium">
              Minhas Empresas ({userCompanies.length})
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            {userCompanies.map((comp) => {
              const isSelected = comp.id === currentCompany?.id
              return (
                <DropdownMenuItem
                  key={comp.id}
                  onClick={() => {
                    handleSelectCompany(comp.id)
                    setMobileDrawerOpen(false)
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${
                    isSelected
                      ? 'bg-indigo-600/30 text-indigo-300 font-semibold'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: comp.color }}
                    />
                    <span className="truncate">{comp.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={() => {
                setCreateCompanyOpen(true)
                setMobileDrawerOpen(false)
              }}
              className="flex items-center gap-2 p-2 rounded-lg text-sm text-indigo-400 hover:bg-slate-800 hover:text-indigo-300 cursor-pointer font-medium"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Criar nova empresa</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                navigate('/empresas')
                setMobileDrawerOpen(false)
              }}
              className="flex items-center gap-2 p-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>Ver todas as empresas</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileDrawerOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Quick Action Button */}
      <div className="px-4 py-2">
        <Button
          onClick={() => {
            setNewTxOpen(true)
            setMobileDrawerOpen(false)
          }}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Lançamento</span>
        </Button>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/70 transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(user?.name || 'User')
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-xl bg-slate-900 border-slate-800 text-white p-1">
            <DropdownMenuItem
              onClick={() => {
                navigate('/empresas')
                setMobileDrawerOpen(false)
              }}
              className="flex items-center gap-2 p-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>Trocar de Empresa</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                navigate(`/empresa/${activeEmpresaId}/configuracoes`)
                setMobileDrawerOpen(false)
              }}
              className="flex items-center gap-2 p-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="flex items-center gap-2 p-2 rounded-lg text-sm text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair do Sistema</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900">
      {/* Desktop Fixed Sidebar 260px */}
      <div className="hidden md:flex md:w-[260px] md:flex-col md:fixed md:inset-y-0 z-30 shadow-xl">
        <SidebarContent />
      </div>

      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] border-none">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 truncate">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: currentCompany?.color || '#6366F1' }}
            />
            <span className="font-bold text-sm truncate">{currentCompany?.name || 'Finanças'}</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/empresas')}
          className="text-xs text-indigo-400 font-medium flex items-center gap-1 bg-slate-800 px-2.5 py-1.5 rounded-lg"
        >
          <span>Trocar</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-[260px] flex flex-col min-h-screen pb-20 md:pb-6">
        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">{children}</div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-slate-200 shadow-lg z-40 flex items-center justify-around px-2">
        <NavLink
          to={`/empresa/${activeEmpresaId}/dashboard`}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Início</span>
        </NavLink>

        <NavLink
          to={`/empresa/${activeEmpresaId}/lancamentos`}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <ReceiptText className="w-5 h-5" />
          <span>Extrato</span>
        </NavLink>

        {/* Center Floating Plus Button */}
        <button
          onClick={() => setNewTxOpen(true)}
          className="w-12 h-12 -mt-5 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="Novo Lançamento"
        >
          <Plus className="w-6 h-6" />
        </button>

        <NavLink
          to={`/empresa/${activeEmpresaId}/contas`}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <CreditCard className="w-5 h-5" />
          <span>Contas</span>
        </NavLink>

        <NavLink
          to={`/empresa/${activeEmpresaId}/equipe`}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <Users2 className="w-5 h-5" />
          <span>Equipe</span>
        </NavLink>
      </nav>

      {/* Global Modals */}
      <CreateCompanyModal
        open={createCompanyOpen}
        onOpenChange={setCreateCompanyOpen}
        onSuccess={(id) => navigate(`/empresa/${id}/dashboard`)}
      />

      <TransactionModal open={newTxOpen} onOpenChange={setNewTxOpen} />
    </div>
  )
}
