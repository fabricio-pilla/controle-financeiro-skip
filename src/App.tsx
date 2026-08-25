import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { CompanyProvider } from '@/contexts/CompanyContext'

import Index from './pages/Index'
import ControlsSelection from './pages/CompaniesSelection'
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
  <BrowserRouter>
    <AuthProvider>
      <CompanyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" richColors />
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/" element={<Index />} />

            {/* Selection of Financial Controls */}
            <Route path="/controles" element={<ControlsSelection />} />

            {/* Protected Financial Control Routes */}
            <Route path="/controle/:controleId" element={<ProtectedCompanyRoute />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="lancamentos" element={<TransactionsPage />} />
              <Route path="importar" element={<Importar />} />
              <Route path="contas" element={<AccountsPage />} />
              <Route path="categorias" element={<CategoriesPage />} />
              <Route path="equipe" element={<TeamPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>

            {/* Fallback 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </CompanyProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
