import React, { useEffect } from 'react'
import { useParams, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { Loader2 } from 'lucide-react'

export function ProtectedCompanyRoute() {
  const { user, isLoading: authLoading } = useAuth()
  const { currentCompany, userCompanies, selectCompany, isCompanyLoading } = useCompany()
  const { empresaId } = useParams<{ empresaId: string }>()

  useEffect(() => {
    if (empresaId && user && (!currentCompany || currentCompany.id !== empresaId)) {
      selectCompany(empresaId)
    }
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

  // Validate if user has access to this company
  if (empresaId && userCompanies.length > 0) {
    const hasAccess = userCompanies.some((c) => c.id === empresaId)
    if (!hasAccess) {
      return <Navigate to="/empresas" replace />
    }
  }

  if (isCompanyLoading && !currentCompany) {
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
