import { Navigate, Outlet, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  // While the user's controls are still being fetched we cannot know whether
  // they have access, so show a loading state instead of risking a false
  // redirect to /controles.
  if (isCompanyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  // Only validate access once we actually have the control list. An empty list
  // here means the user genuinely has no controls — redirect to /controles.
  if (controleId && userCompanies.length === 0) {
    return <Navigate to="/controles" replace />
  }

  if (controleId && userCompanies.length > 0) {
    const hasAccess = userCompanies.some((c) => c.id === controleId)
    if (!hasAccess) {
      return <Navigate to="/controles" replace />
    }
  }

  // Kick off control selection whenever the route param changes. The
  // `!== controleId` guard inside selectCompany avoids re-selecting.
  if (controleId && (!currentCompany || currentCompany.id !== controleId)) {
    selectCompany(controleId)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  if (!currentCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  return <Outlet />
}
