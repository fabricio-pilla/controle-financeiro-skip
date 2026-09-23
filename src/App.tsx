import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { CompanyProvider } from '@/contexts/CompanyContext'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import TransactionsPage from './pages/TransactionsPage'
import Importar from './pages/Importar'
import AccountsPage from './pages/AccountsPage'
import CategoriesPage from './pages/CategoriesPage'
import TeamPage from './pages/TeamPage'
import SettingsPage from './pages/SettingsPage'
import NotFound from './pages/NotFound'

import ProtectedCompanyRoute from './components/layout/ProtectedCompanyRoute'

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" richColors />
            <Routes>
              {/* Public Authentication Route */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/register" element={<Navigate to="/" replace />} />

              {/* Selection of Financial Controls */}
              {/* Redirecionamento de rotas legadas de seleção */}
              <Route path="/controles" element={<Navigate to="/dashboard" replace />} />

              {/* Protected Financial Control Routes (Rotas Diretas sem seleção de múltiplos controles) */}
              <Route element={<ProtectedCompanyRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/lancamentos" element={<TransactionsPage />} />
                <Route path="/importar" element={<Importar />} />
                <Route path="/contas" element={<AccountsPage />} />
                <Route path="/categorias" element={<CategoriesPage />} />
                <Route path="/equipe" element={<TeamPage />} />
                <Route path="/configuracoes" element={<SettingsPage />} />
              </Route>

              {/* Compatibilidade retroativa para URLs antigas com prefixo /controle/:controleId */}
              <Route path="/controle/:controleId" element={<ProtectedCompanyRoute />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Navigate to="/dashboard" replace />} />
                <Route path="lancamentos" element={<Navigate to="/lancamentos" replace />} />
                <Route path="importar" element={<Navigate to="/importar" replace />} />
                <Route path="contas" element={<Navigate to="/contas" replace />} />
                <Route path="categorias" element={<Navigate to="/categorias" replace />} />
                <Route path="equipe" element={<Navigate to="/equipe" replace />} />
                <Route path="configuracoes" element={<Navigate to="/configuracoes" replace />} />
              </Route>

              {/* Fallback 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
)

export default App
