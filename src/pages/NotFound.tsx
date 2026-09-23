/* 404 Page - Displays when a user attempts to access a non-existent route - translate to the language of the user */
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.warn('[NotFound] Rota não encontrada acessada:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
        <h1 className="text-5xl font-black text-indigo-600">404</h1>
        <h2 className="text-xl font-bold text-slate-900">Página não encontrada</h2>
        <p className="text-sm text-slate-500">O endereço acessado não existe ou foi movido.</p>
        <div className="pt-2">
          <a
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-600/20"
          >
            Voltar para o Início
          </a>
        </div>
      </div>
    </div>
  )
}

export default NotFound
