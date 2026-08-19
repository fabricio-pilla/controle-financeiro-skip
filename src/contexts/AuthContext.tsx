import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '@/types/database'
import { skipCloud } from '@/lib/skip-cloud'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string) => Promise<User>
  register: (name: string, email: string) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const u = await skipCloud.getCurrentUser()
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const login = async (email: string) => {
    setIsLoading(true)
    try {
      const u = await skipCloud.login(email)
      setUser(u)
      return u
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (name: string, email: string) => {
    setIsLoading(true)
    try {
      const u = await skipCloud.register(name, email)
      setUser(u)
      return u
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      await skipCloud.logout()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

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
