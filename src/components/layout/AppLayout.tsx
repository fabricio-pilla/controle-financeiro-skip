import { useState, useRef, useEffect, type ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import {
  LayoutDashboard,
  ReceiptText,
  Upload,
  CreditCard,
  FolderTree,
  Users2,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  Sparkles,
  Wallet,
  Search,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDateBR, getTxEffectiveDate } from '@/lib/formatters'
import type { Transaction } from '@/types/database'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { AiTransactionModal } from '@/components/transactions/AiTransactionModal'
import { getInitials } from '@/lib/formatters'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth()
  const { currentCompany, currentRole, canManageTransactions, searchTransactionsServer } =
    useCompany()
  const navigate = useNavigate()
  const location = useLocation()

  const [aiTxOpen, setAiTxOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Topbar global search
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false)
  const [searchResults, setSearchResults] = useState<Transaction[]>([])
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = globalSearchTerm.trim()
    if (!term || term.length < 2) {
      setSearchResults([])
      setSearchDropdownOpen(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setIsSearchingGlobal(true)
      try {
        const res = await searchTransactionsServer(term)
        if (!cancelled) {
          setSearchResults(res.slice(0, 8))
          setSearchDropdownOpen(true)
        }
      } catch (err) {
        console.warn('[AppLayout] Erro na busca global:', err)
      } finally {
        if (!cancelled) {
          setIsSearchingGlobal(false)
        }
      }
    }, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [globalSearchTerm, searchTransactionsServer])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const navItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
    },
    {
      label: 'Lançamentos',
      icon: ReceiptText,
      path: '/lancamentos',
    },
    {
      label: 'Importar',
      icon: Upload,
      path: '/importar',
    },
    {
      label: 'Contas',
      icon: CreditCard,
      path: '/contas',
    },
    {
      label: 'Categorias',
      icon: FolderTree,
      path: '/categorias',
    },
    {
      label: 'Equipe',
      icon: Users2,
      path: '/equipe',
    },
    {
      label: 'Configurações',
      icon: Settings,
      path: '/configuracoes',
    },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const roleLabel = {
    owner: 'Proprietário',
    admin: 'Administrador',
    member: 'Membro',
    viewer: 'Visualizador',
  }[currentRole || 'member']

  // Sidebar content (shared by desktop and mobile sheet)
  const SidebarContent = () => (
    <aside className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white select-none">
      {/* Brand & Fixed Single Control Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 text-sm shadow-md"
              style={{ backgroundColor: currentCompany?.color || '#3B82F6' }}
            >
              {currentCompany ? getInitials(currentCompany.name) : 'CF'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">
                {currentCompany?.name || 'Controle Financeiro'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{roleLabel}</p>
            </div>
          </div>
          <Wallet className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
        </div>
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
      {canManageTransactions && (
        <div className="px-4 py-2">
          <Button
            onClick={() => {
              setAiTxOpen(true)
              setMobileDrawerOpen(false)
            }}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl h-11 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40"
          >
            <Sparkles className="w-4 h-4" />
            <span>Novo Lançamento IA</span>
          </Button>
        </div>
      )}

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
                navigate('/configuracoes')
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
            <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: currentCompany?.color || '#3B82F6' }}
            />
            <span className="font-bold text-sm truncate">{currentCompany?.name || 'Controle'}</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-rose-400 font-medium flex items-center gap-1 bg-slate-800 px-2.5 py-1.5 rounded-lg"
          title="Sair do sistema"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-[260px] flex flex-col min-h-screen pb-20 md:pb-6">
        {/* Desktop Topbar com Busca Global */}
        <div className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white/80 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-20">
          <div ref={searchContainerRef} className="relative w-full max-w-md">
            <div className="relative">
              {isSearchingGlobal ? (
                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute left-3 top-1/2 -translate-y-1/2" />
              ) : (
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              )}
              <Input
                placeholder="Buscar lançamento em qualquer mês..."
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setSearchDropdownOpen(true)
                }}
                className="pl-9 pr-4 h-9 rounded-xl text-xs bg-slate-50/80 border-slate-200 focus:bg-white transition-colors"
              />
            </div>

            {/* Dropdown de resultados da busca remota */}
            {searchDropdownOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 max-h-80 overflow-y-auto divide-y divide-slate-100">
                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Lançamentos encontrados no servidor</span>
                  <span>{searchResults.length} resultados</span>
                </div>
                {searchResults.map((tx) => {
                  const effDate = getTxEffectiveDate(tx)
                  return (
                    <button
                      key={tx.id}
                      onClick={() => {
                        setSearchDropdownOpen(false)
                        setGlobalSearchTerm('')
                        const ym = effDate ? effDate.substring(0, 7) : 'all'
                        navigate(
                          `/lancamentos?month=${ym}&search=${encodeURIComponent(tx.description)}`,
                        )
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{tx.description}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatDateBR(effDate)} · {tx.category?.name || 'Sem categoria'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`font-bold tabular-nums ${
                            tx.type === 'receita' ? 'text-emerald-600' : 'text-slate-700'
                          }`}
                        >
                          {tx.type === 'despesa' ? '-' : '+'}
                          {formatCurrency(tx.amount)}
                        </p>
                        <span className="text-[10px] text-indigo-500 font-medium flex items-center gap-0.5 justify-end">
                          Ver extrato <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Controle:{' '}
              <strong className="text-slate-800 font-semibold">{currentCompany?.name}</strong>
            </span>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">{children}</div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-slate-200 shadow-lg z-40 flex items-center justify-around px-2">
        <NavLink
          to="/dashboard"
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
          to="/lancamentos"
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
          onClick={() => setAiTxOpen(true)}
          className="w-12 h-12 -mt-5 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="Lançamento com IA"
        >
          <Sparkles className="w-6 h-6" />
        </button>

        <NavLink
          to="/contas"
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
          to="/equipe"
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

      <AiTransactionModal open={aiTxOpen} onOpenChange={setAiTxOpen} />
    </div>
  )
}
