import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { AppLayout } from './AppLayout'

/**
 * Guards routes that require an active financial control (tenant) selected.
 *
 * - If not authenticated -> redirect to "/".
 * - If the user's control list is still loading -> show a spinner. We CANNOT
 *   check `userCompanies.length > 0` while loading, because an empty list
 *   during loading would produce a false "no access" redirect.
 * - Once the list is loaded, if currentCompany is not yet populated or if
 *   the route has a different controleId, selectCompany is triggered in a
 *   safe useEffect to prevent "Cannot update a component (`CompanyProvider`)
 *   while rendering a different component (`ProtectedCompanyRoute`)".
 * - Render <Outlet/> inside AppLayout once selected.
 */
export default function ProtectedCompanyRoute() {
  const { user, isLoading: authLoading } = useAuth()
  const { currentCompany, isLoading: isCompanyLoading, selectCompany } = useCompany()
  const { controleId } = useParams<{ controleId: string }>()

  // Evitar chamadas concorrentes/redundantes a selectCompany
  const selectingTargetRef = useRef<string | null>(null)

  const needsSpecificControl = Boolean(
    controleId && (!currentCompany || currentCompany.id !== controleId),
  )
  const needsDefaultControl = Boolean(!controleId && !currentCompany)
  const needsSelection = Boolean(
    user && !authLoading && !isCompanyLoading && (needsSpecificControl || needsDefaultControl),
  )

  useEffect(() => {
    if (!needsSelection) {
      selectingTargetRef.current = null
      return
    }

    const targetKey = controleId || '__default__'
    if (selectingTargetRef.current === targetKey) {
      return
    }

    selectingTargetRef.current = targetKey
    selectCompany(controleId).finally(() => {
      if (selectingTargetRef.current === targetKey) {
        selectingTargetRef.current = null
      }
    })
  }, [needsSelection, controleId, selectCompany])

  // Adicionar um estado de timeout local para evitar spinner eterno se a rede falhar
  const [loadTimedOut, setLoadTimedOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadTimedOut(true)
    }, 6000)
    return () => clearTimeout(timer)
  }, [])

  if (authLoading || isCompanyLoading) {
    if (loadTimedOut) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Conectando ao sistema...</h2>
            <p className="text-xs text-slate-500">
              O carregamento está demorando mais do que o normal. Você pode tentar recarregar ou
              voltar para a página inicial.
            </p>
            <div className="pt-2 flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Recarregar página
              </button>
              <a
                href="/"
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 inline-block"
              >
                Ir para início
              </a>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  // Se ainda estiver precisando selecionar um controle, exibe loader com segurança ou aviso de fallback
  if (needsSpecificControl || !currentCompany) {
    if (loadTimedOut) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 text-center space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Controle financeiro não localizado</h2>
            <p className="text-xs text-slate-500">
              Não foi possível carregar os dados deste controle financeiro no momento. Verifique sua
              conexão e tente novamente.
            </p>
            <div className="pt-2 flex gap-2 justify-center">
              <button
                onClick={() => {
                  setLoadTimedOut(false)
                  selectCompany(controleId)
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Tentar novamente
              </button>
              <a
                href="/"
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 inline-block"
              >
                Ir para início
              </a>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
