import { useEffect, useRef } from 'react'
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

  // Se ainda estiver precisando selecionar um controle, exibe loader com segurança
  if (needsSpecificControl || !currentCompany) {
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
