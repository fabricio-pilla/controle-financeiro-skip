import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import { User } from '@/types/database'
import { skipCloud } from '@/lib/skip-cloud'
import pb from '@/lib/pocketbase/client'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Track the last user id we applied to React state so we can skip
  // redundant refreshUser calls. PocketBase's authStore.onChange fires for
  // internal token/model refreshes that do not actually change the logged-in
  // user — calling setUser (and thus CompanyProvider's reloadUserCompanies)
  // on every one of those would create a re-render cascade.
  const lastUserIdRef = useRef<string | null>(null)

  const applyUser = useCallback((u: User | null) => {
    const id = u?.id ?? null
    if (id === lastUserIdRef.current) {
      // Same user — only update if there is a real content change worth it.
      // Avoid setState when nothing changed to break re-render cascades.
      setUser((prev) => (prev && prev.id === id ? prev : u))
      return
    }
    lastUserIdRef.current = id
    setUser(u)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      // Timeout de segurança para evitar que uma requisição travada/offline
      // prenda o estado de carregamento do app indefinitamente no preview
      const userPromise = skipCloud.getCurrentUser()
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
      const u = await Promise.race([userPromise, timeoutPromise])
      applyUser(u)
    } catch (e) {
      console.warn('[AuthContext] refreshUser falhou:', e)
      lastUserIdRef.current = null
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [applyUser])

  useEffect(() => {
    refreshUser()
    // Sync user state when the PocketBase auth store changes (login/logout/refresh).
    // The callback guards against redundant refreshes above, so this is safe
    // even if PocketBase fires onChange multiple times for the same session.
    const unsubscribe = pb.authStore.onChange(() => {
      refreshUser()
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const u = await skipCloud.login(email, password)
      lastUserIdRef.current = u.id
      setUser(u)
      return u
    } finally {
      setIsLoading(false)
    }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      const u = await skipCloud.register(name, email, password)
      lastUserIdRef.current = u.id
      setUser(u)
      return u
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await skipCloud.logout()
      lastUserIdRef.current = null
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
