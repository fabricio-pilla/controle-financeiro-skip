import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Página legada de seleção de múltiplos controles.
 * Como o app opera exclusivamente com um controle único permanente,
 * qualquer acesso a esta tela é automaticamente redirecionado ao /dashboard.
 */
export default function ControlsSelection() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/dashboard', { replace: true })
  }, [navigate])

  return null
}
