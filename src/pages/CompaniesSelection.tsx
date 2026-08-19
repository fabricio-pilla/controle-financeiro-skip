import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { CreateCompanyModal } from '@/components/companies/CreateCompanyModal'
import { Button } from '@/components/ui/button'
import { formatCurrency, getGreeting, getInitials } from '@/lib/formatters'
import { Building2, Plus, ArrowRight, Users, LogOut, Sparkles, Wallet, Loader2 } from 'lucide-react'

interface CompanyStats {
  membersCount: number
  balance: number
  income: number
  expense: number
  transactionsCount: number
}

export default function CompaniesSelection() {
  const { user, logout } = useAuth()
  const { userCompanies, selectCompany, isLoading, getCompanyStats } = useCompany()
  const navigate = useNavigate()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const [statsMap, setStatsMap] = useState<Record<string, CompanyStats>>({})

  // Load aggregated stats (members count + saldo) for each company card
  useEffect(() => {
    let active = true
    const loadStats = async () => {
      const entries = await Promise.all(
        userCompanies.map(async (comp) => {
          const s = await getCompanyStats(comp.id)
          return [comp.id, s] as const
        }),
      )
      if (!active) return
      const next: Record<string, CompanyStats> = {}
      entries.forEach(([id, s]) => {
        next[id] = s
      })
      setStatsMap(next)
    }
    if (userCompanies.length > 0) {
      loadStats()
    } else {
      setStatsMap({})
    }
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCompanies])

  const handleSelectCompany = async (companyId: string) => {
    setNavigatingId(companyId)
    const ok = await selectCompany(companyId)
    if (ok) {
      navigate(`/empresa/${companyId}/dashboard`)
    } else {
      setNavigatingId(null)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-8 md:p-12">
      {/* Header Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between pb-8 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">Finanças Multiempresa</h1>
            <p className="text-xs text-slate-500 mt-1">Skip Cloud Multi-tenant</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              {user ? getInitials(user.name) : 'U'}
            </div>
            <span className="text-sm font-medium text-slate-700">{user?.name}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="rounded-xl text-slate-600 hover:text-rose-600 border-slate-300"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            <span>Sair</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto my-auto py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-indigo-600 text-sm font-semibold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Painel Multi-tenant</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {getGreeting(user?.name)} Selecione uma empresa
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Escolha qual ambiente empresarial você deseja gerenciar ou registre uma nova
            organização. Você só vê as empresas vinculadas ao seu e-mail.
          </p>
        </div>

        {/* Company Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Carregando suas empresas...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userCompanies.map((comp) => {
              const isTarget = navigatingId === comp.id
              const stats = statsMap[comp.id]
              return (
                <div
                  key={comp.id}
                  onClick={() => handleSelectCompany(comp.id)}
                  className={`group relative bg-white border border-slate-200 hover:border-indigo-400 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[230px] ${
                    isTarget ? 'opacity-60 scale-95' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-md group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: comp.color || '#6366F1' }}
                      >
                        {getInitials(comp.name)}
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {comp.segment}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {comp.name}
                    </h3>
                    {comp.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {comp.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{stats ? `${stats.membersCount} membro(s)` : 'Carregando...'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{stats ? formatCurrency(stats.balance) : '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-sm font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                      <span>Acessar</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Create New Company Card */}
            <button
              onClick={() => setCreateModalOpen(true)}
              className="group min-h-[230px] border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 hover:shadow-md hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform mb-3">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-indigo-950">Criar Nova Empresa</h3>
              <p className="text-xs text-indigo-700/80 mt-1 max-w-[200px]">
                Adicione uma nova empresa ou filial com plano de contas e categorias automáticas.
              </p>
            </button>
          </div>
        )}

        {!isLoading && userCompanies.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-slate-500 mb-4">
              Você ainda não possui empresas vinculadas ao seu e-mail.
            </p>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Criar primeira empresa
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto pt-8 border-t border-slate-200 text-center text-xs text-slate-400">
        Skip Cloud Multi-tenant Architecture • Todos os dados isolados por Company ID
      </footer>

      {/* Create Company Modal */}
      <CreateCompanyModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          // The newly created company belongs to the informed owner, not
          // necessarily the current admin — so we only close the modal and
          // refresh the list (handled by reloadUserCompanies in the context).
          setCreateModalOpen(false)
        }}
      />
    </div>
  )
}
