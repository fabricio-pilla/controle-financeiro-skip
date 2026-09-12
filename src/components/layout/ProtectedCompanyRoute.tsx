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
 * - Once the list is loaded, if the requested control is not in the list,
 *   redirect to /controles.
 * - Otherwise, kick off `selectCompany(controleId)` when the route param
 *   changes, then render <Outlet/> for the nested routes once selected.
 */
export default function ProtectedCompanyRoute() {
  const { user, isLoading: authLoading } = useAuth()
  const { currentCompany, userCompanies, isLoading: isCompanyLoading, selectCompany } = useCompany()
  const { controleId } = useParams<{ controleId: string }>()

  if (authLoading || isCompanyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  // Se a rota tiver controleId diferente do controle principal atual,
  // ou se currentCompany ainda não estiver carregado, seleciona o controle principal
  if (controleId && (!currentCompany || currentCompany.id !== controleId)) {
    selectCompany(controleId)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  if (!currentCompany) {
    // Tenta selecionar automaticamente o único controle existente
    selectCompany()
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
