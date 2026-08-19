import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  TrendingUp,
  ShieldCheck,
  Building2,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Layers,
  Users,
} from 'lucide-react'

export default function Index() {
  const { user, login, register, isLoading } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<'login' | 'register'>('login')

  // Login form state
  const [loginEmail, setLoginEmail] = useState('carlos@empresa.com.br')
  const [loginPassword, setLoginPassword] = useState('12345678')
  const [loginError, setLoginError] = useState('')

  // Register form state
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regError, setRegError] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if already logged in
  if (user && !isLoading) {
    return <Navigate to="/empresas" replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')

    if (!loginEmail.trim() || !loginEmail.includes('@')) {
      setLoginError('Informe um e-mail corporativo válido.')
      return
    }
    if (!loginPassword) {
      setLoginError('Informe a senha de acesso.')
      return
    }

    setIsSubmitting(true)
    try {
      await login(loginEmail, loginPassword)
      toast.success('Login realizado com sucesso! Bem-vindo de volta.')
      navigate('/empresas')
    } catch (err: any) {
      setLoginError(err?.message || 'Falha ao realizar login.')
      toast.error('Não foi possível entrar no sistema.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')

    if (!regName.trim()) {
      setRegError('Informe o seu nome completo.')
      return
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Informe um e-mail válido.')
      return
    }
    if (regPassword.length < 8) {
      setRegError('A senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (regPassword !== regConfirm) {
      setRegError('As senhas não coincidem.')
      return
    }

    setIsSubmitting(true)
    try {
      await register(regName, regEmail, regPassword)
      toast.success('Conta criada com sucesso! Bem-vindo ao Skip Gestão.')
      navigate('/empresas')
    } catch (err: any) {
      setRegError(err?.message || 'Falha ao criar conta.')
      toast.error('Erro ao cadastrar usuário.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Visual Hero Section (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Abstract background decorative elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        {/* Top Header/Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-white text-indigo-600 flex items-center justify-center font-black text-xl shadow-lg shadow-black/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Finanças Multiempresa</h1>
            <p className="text-xs text-indigo-200">Skip Cloud Multi-tenant Finance</p>
          </div>
        </div>

        {/* Floating Interactive Mock Cards */}
        <div className="my-auto py-12 space-y-6 relative z-10">
          <div className="max-w-md">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-indigo-100 backdrop-blur-sm mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              Isolamento Total por Tenant
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              Controle financeiro de todas as suas empresas em um só lugar.
            </h2>
            <p className="text-indigo-100/80 text-sm mt-3 leading-relaxed">
              Alterne instantaneamente entre múltiplas empresas, gerencie colaboradores com
              permissões granulares, contas bancárias e relatórios em tempo real.
            </p>
          </div>

          {/* Floating UI Cards */}
          <div className="grid grid-cols-1 gap-4 max-w-md pt-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex items-center justify-between shadow-xl animate-float">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-indigo-200">Faturamento Consolidado</p>
                  <p className="text-lg font-bold text-white">R$ 142.850,00</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg">
                +18.4% este mês
              </span>
            </div>

            <div
              className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex items-center justify-between shadow-xl animate-float"
              style={{ animationDelay: '2s' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-indigo-200">Empresas Conectadas</p>
                  <p className="text-sm font-semibold text-white">Nexus Tech & Aurora Design</p>
                </div>
              </div>
              <Users className="w-5 h-5 text-indigo-200" />
            </div>
          </div>
        </div>

        {/* Footer Feature Bullets */}
        <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6 relative z-10 text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Multiempresa Real</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Skip Cloud Auth</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Papéis e Permissões</span>
          </div>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 lg:p-16">
        <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
          {/* Mobile Logo Branding */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Finanças Multiempresa</h1>
              <p className="text-xs text-slate-500">Gestão empresarial integrada</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {tab === 'login' ? 'Acessar o Painel' : 'Criar Nova Conta'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {tab === 'login'
                ? 'Entre com suas credenciais corporativas para gerenciar seus negócios.'
                : 'Cadastre-se para criar sua empresa ou aceitar convites pendentes.'}
            </p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
              <TabsTrigger value="login" className="rounded-lg font-medium text-sm">
                Entrar
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg font-medium text-sm">
                Criar conta
              </TabsTrigger>
            </TabsList>

            {/* TAB: LOGIN */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                    {loginError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-sm font-medium text-slate-700">
                    E-mail Corporativo
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu.nome@empresa.com.br"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="rounded-xl h-11"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-sm font-medium text-slate-700">
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info('Recuperação de senha ainda não implementada nesta demo.')
                      }
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="rounded-xl h-11"
                    required
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl h-12 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Autenticando...</span>
                      </>
                    ) : (
                      <>
                        <span>Entrar no Sistema</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-4 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900">
                  <p className="font-semibold text-indigo-950 mb-1">Dica de Demonstração:</p>
                  <p>
                    Use <strong>carlos@empresa.com.br</strong> / senha <strong>12345678</strong>{' '}
                    para acessar como Proprietário da Nexus Soluções e Aurora Comércio com dados
                    preenchidos. Use <strong>lucas@empresa.com.br</strong> /{' '}
                    <strong>12345678</strong> como Membro da Nexus e Administrador da Aurora.
                  </p>
                </div>
              </form>
            </TabsContent>

            {/* TAB: REGISTER */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium">
                    {regError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="reg-name" className="text-sm font-medium text-slate-700">
                    Nome Completo
                  </Label>
                  <Input
                    id="reg-name"
                    placeholder="Ex: João da Silva"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="rounded-xl h-11"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-sm font-medium text-slate-700">
                    E-mail Corporativo
                  </Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="joao@minhaempresa.com.br"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="rounded-xl h-11"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pwd" className="text-sm font-medium text-slate-700">
                      Senha
                    </Label>
                    <Input
                      id="reg-pwd"
                      type="password"
                      placeholder="Mínimo 6 dígitos"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="rounded-xl h-11"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm" className="text-sm font-medium text-slate-700">
                      Confirmar Senha
                    </Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      placeholder="Repita a senha"
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      className="rounded-xl h-11"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl h-12 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Criando conta...</span>
                      </>
                    ) : (
                      <>
                        <span>Criar Conta e Acessar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
