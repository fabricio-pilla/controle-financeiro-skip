import React, { useEffect } from 'react'
import { useParams, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { Loader2 } from 'lucide-react'

export function ProtectedCompanyRoute() {
  const { user, isLoading: authLoading } = useAuth()
  const { currentCompany, userCompanies, selectCompany, isCompanyLoading, isLoading } = useCompany()
  const { empresaId } = useParams<{ empresaId: string }>()

  // Kick off company selection whenever the route param changes and we have a
  // logged-in user. `selectCompany` is now a stable callback, but we still
  // include currentCompany.id so we do not re-select the company we are
  // already on — the `!== empresaId` guard inside handles that.
  useEffect(() => {
    if (!empresaId || !user) return
    if (currentCompany && currentCompany.id === empresaId) return
    selectCompany(empresaId)
  }, [empresaId, user, currentCompany, selectCompany])

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

  // While the user's companies are still being fetched we cannot know whether
  // they have access to this company, so show a loading state instead of
  // risking a false redirect to /empresas. `isLoading` is the CompanyContext
  // loading flag for the user's company LIST — it stays true until the list
  // finishes loading, even if the list is empty, preventing premature
  // redirects caused by `userCompanies.length > 0` checks.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    )
  }

  // Only validate access once we actually have the company list. The
  // `isLoading` guard above already covers the loading case, so an empty list
  // here means the user genuinely has no companies — redirect to /empresas.
  if (empresaId && userCompanies.length > 0) {
    const hasAccess = userCompanies.some((c) => c.id === empresaId)
    if (!hasAccess) {
      return <Navigate to="/empresas" replace />
    }
  }

  if (isCompanyLoading && (!currentCompany || currentCompany.id !== empresaId)) {
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
