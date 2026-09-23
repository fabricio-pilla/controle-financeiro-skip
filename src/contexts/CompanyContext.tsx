import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import {
  Company,
  CompanyMember,
  Account,
  Category,
  Subcategory,
  Transaction,
  UserRole,
  AccountType,
  TransactionType,
  User,
} from '@/types/database'
import { skipCloud } from '@/lib/skip-cloud'
import { useAuth } from './AuthContext'

interface CompanyContextType {
  currentCompany: Company | null
  userCompanies: Company[]
  currentRole: UserRole | null
  members: CompanyMember[]
  accounts: Account[]
  categories: Category[]
  subcategories: Subcategory[]
  transactions: Transaction[]
  isLoading: boolean
  isCompanyLoading: boolean

  // Permissions helpers
  isOwner: boolean
  isAdmin: boolean
  canManageTeam: boolean
  canManageSettings: boolean
  canManageFinance: boolean // accounts, categories
  canManageTransactions: boolean // members, admins, owners

  // Actions
  selectCompany: (companyId?: string) => Promise<boolean>
  reloadCompanyData: () => Promise<void>
  reloadUserCompanies: () => Promise<void>
  createCompany: (
    name: string,
    color: string,
    ownerEmail: string,
    description?: string,
  ) => Promise<Company>
  updateCompany: (
    data: Partial<Pick<Company, 'name' | 'color' | 'description'>>,
  ) => Promise<Company>
  getCompanyStats: (companyId: string) => Promise<{
    membersCount: number
    balance: number
    income: number
    expense: number
    transactionsCount: number
  }>
  deleteCompany: () => Promise<void>

  // Accounts
  createAccount: (data: {
    name: string
    type: AccountType
    balance: number
    limit?: number
    color: string
    bank?: string
    due_day?: number
    closing_day?: number
    is_primary?: boolean
  }) => Promise<Account>
  updateAccount: (
    accountId: string,
    data: Partial<Omit<Account, 'id' | 'control_id' | 'created_at'>>,
  ) => Promise<Account>
  deleteAccount: (accountId: string) => Promise<void>

  // Categories
  createCategory: (data: {
    name: string
    type: TransactionType
    color: string
    icon: string
  }) => Promise<Category>
  updateCategory: (
    categoryId: string,
    data: Partial<Omit<Category, 'id' | 'control_id' | 'created_at'>>,
  ) => Promise<Category>
  deleteCategory: (categoryId: string) => Promise<void>

  // Subcategories
  createSubcategory: (data: {
    category_id: string
    name: string
    color?: string
    icon?: string
  }) => Promise<Subcategory>
  updateSubcategory: (
    subcategoryId: string,
    data: Partial<Omit<Subcategory, 'id' | 'control_id' | 'created_at' | 'category'>>,
  ) => Promise<Subcategory>
  deleteSubcategory: (subcategoryId: string) => Promise<void>

  // Transactions
  createTransaction: (data: {
    account_id: string
    category_id: string
    subcategory_id?: string
    description: string
    amount: number
    type: TransactionType
    date: string
    payment_date?: string
    paid?: boolean
    is_recurring?: boolean
    recurrence_type?: any
    notes?: string
    installments_total?: number
  }) => Promise<Transaction>
  updateTransaction: (
    transactionId: string,
    data: Partial<Omit<Transaction, 'id' | 'control_id' | 'created_at' | 'user_id'>>,
    options?: { skipReload?: boolean },
  ) => Promise<Transaction>
  deleteTransaction: (transactionId: string, options?: { skipReload?: boolean }) => Promise<void>
  setTransactionsPaidStatus: (
    transactionIds: string[],
    paid: boolean,
    options?: { skipReload?: boolean },
  ) => Promise<Transaction[]>
  applyTransactionsBatchUpdate: (mutation: {
    updated?: Transaction[]
    created?: Transaction[]
    deletedIds?: string[]
  }) => void

  // Team
  inviteMember: (email: string, role: UserRole) => Promise<CompanyMember>
  updateMemberRole: (memberId: string, role: UserRole) => Promise<CompanyMember>
  updateMemberProfile: (
    targetUserId: string,
    data: {
      name?: string
      password?: string
      avatarFile?: File | null
    },
  ) => Promise<User>
  removeMember: (memberId: string) => Promise<void>
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // Stable primitive identity — used as effect/callback dependency so we never
  // re-run because the `user` object reference changed without the id changing.
  const userId = user?.id

  const [userCompanies, setUserCompanies] = useState<Company[]>([])
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCompanyLoading, setIsCompanyLoading] = useState(false)

  const activeCompanyId = currentCompany?.id

  const ACTIVE_CONTROL_KEY = 'cf_active_control_id'

  // Carrega sempre o controle único principal da aplicação
  const reloadUserCompanies = useCallback(async () => {
    if (!userId) {
      setUserCompanies([])
      setCurrentCompany(null)
      setCurrentRole(null)
      setMembers([])
      setAccounts([])
      setCategories([])
      setSubcategories([])
      setTransactions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const cachedControlId =
        typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_CONTROL_KEY) : null
      let targetComp: Company | null = null

      if (cachedControlId) {
        targetComp = await skipCloud.getCompany(cachedControlId)
      }

      if (!targetComp) {
        targetComp = await skipCloud.getSingleCompany(userId)
      }

      if (targetComp) {
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(ACTIVE_CONTROL_KEY, targetComp.id)
          }
        } catch {
          // Fallback silencioso para storage indisponível
        }

        setUserCompanies([targetComp])
        setCurrentCompany(targetComp)

        // Carrega papel e dados do controle único
        const [role, mems, accs, cats, subcats, txs] = await Promise.all([
          skipCloud.getUserRoleInCompany(targetComp.id, userId),
          skipCloud.getCompanyMembers(targetComp.id),
          skipCloud.getAccounts(targetComp.id),
          skipCloud.getCategories(targetComp.id),
          skipCloud.getSubcategories(targetComp.id),
          skipCloud.getTransactions(targetComp.id),
        ])

        setCurrentRole(role || 'owner')
        setMembers(mems)
        setAccounts(accs)
        setCategories(cats)
        setSubcategories(subcats)
        setTransactions(txs)
      } else {
        setUserCompanies([])
        setCurrentCompany(null)
        setCurrentRole(null)
      }
    } catch {
      setUserCompanies([])
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    reloadUserCompanies()
  }, [reloadUserCompanies])

  // Load all data for the active company
  const reloadCompanyData = useCallback(async () => {
    const cachedControlId =
      typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_CONTROL_KEY) : null
    const targetControlId = activeCompanyId || currentCompany?.id || cachedControlId
    if (!userId) return
    setIsCompanyLoading(true)
    try {
      let resolvedComp: Company | null = null
      if (targetControlId) {
        resolvedComp = await skipCloud.getCompany(targetControlId)
      }
      if (!resolvedComp) {
        resolvedComp = await skipCloud.getSingleCompany(userId)
      }
      if (!resolvedComp) return

      const finalControlId = resolvedComp.id
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(ACTIVE_CONTROL_KEY, finalControlId)
        }
      } catch {
        // Fallback silencioso
      }

      const [role, mems, accs, cats, subcats, txs] = await Promise.all([
        skipCloud.getUserRoleInCompany(finalControlId, userId),
        skipCloud.getCompanyMembers(finalControlId),
        skipCloud.getAccounts(finalControlId),
        skipCloud.getCategories(finalControlId),
        skipCloud.getSubcategories(finalControlId),
        skipCloud.getTransactions(finalControlId),
      ])

      setCurrentCompany(resolvedComp)
      setUserCompanies([resolvedComp])
      if (role) setCurrentRole(role)
      setMembers(mems)
      setAccounts(accs)
      setCategories(cats)
      setSubcategories(subcats)
      setTransactions(txs)
    } catch {
      // Falha silenciosa sem expor 404/erros no console
    } finally {
      setIsCompanyLoading(false)
    }
  }, [activeCompanyId, currentCompany?.id, userId])

  const selectCompany = useCallback(
    async (companyId?: string): Promise<boolean> => {
      if (!userId) return false
      setIsCompanyLoading(true)
      try {
        const cachedControlId =
          typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_CONTROL_KEY) : null
        const targetId = companyId || currentCompany?.id || cachedControlId
        let comp: Company | null = null

        if (targetId) {
          comp = await skipCloud.getCompany(targetId)
        }
        if (!comp) {
          comp = await skipCloud.getSingleCompany(userId)
        }

        if (!comp) return false

        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(ACTIVE_CONTROL_KEY, comp.id)
          }
        } catch {
          // Fallback silencioso
        }

        const role = await skipCloud.getUserRoleInCompany(comp.id, userId)

        setCurrentCompany(comp)
        setUserCompanies([comp])
        setCurrentRole(role || 'owner')

        const [mems, accs, cats, subcats, txs] = await Promise.all([
          skipCloud.getCompanyMembers(comp.id),
          skipCloud.getAccounts(comp.id),
          skipCloud.getCategories(comp.id),
          skipCloud.getSubcategories(comp.id),
          skipCloud.getTransactions(comp.id),
        ])
        setMembers(mems)
        setAccounts(accs)
        setCategories(cats)
        setSubcategories(subcats)
        setTransactions(txs)
        return true
      } catch {
        return false
      } finally {
        setIsCompanyLoading(false)
      }
    },
    [userId, currentCompany?.id],
  )

  const createCompany = useCallback(
    async (name: string, color: string, ownerEmail: string, description?: string) => {
      const comp = await skipCloud.createCompany(name, color, ownerEmail, description)
      // Do NOT select the new company: it belongs to the informed owner, not
      // necessarily the current admin. Just refresh the list of companies the
      // current user can see.
      await reloadUserCompanies()
      return comp
    },
    [reloadUserCompanies],
  )

  const updateCompany = useCallback(
    async (data: Partial<Pick<Company, 'name' | 'color' | 'description'>>) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const updated = await skipCloud.updateCompany(currentCompany.id, data)
      setCurrentCompany(updated)
      await reloadUserCompanies()
      return updated
    },
    [currentCompany, reloadUserCompanies],
  )

  const getCompanyStats = useCallback((companyId: string) => {
    return skipCloud.getCompanyStats(companyId)
  }, [])

  const deleteCompany = useCallback(async () => {
    if (!currentCompany) throw new Error('Nenhum controle selecionado.')
    await skipCloud.deleteCompany(currentCompany.id)
    setCurrentCompany(null)
    setCurrentRole(null)
    await reloadUserCompanies()
  }, [currentCompany, reloadUserCompanies])

  // Account operations
  const createAccount = useCallback(
    async (data: {
      name: string
      type: AccountType
      balance: number
      limit?: number
      color: string
      bank?: string
      due_day?: number
      closing_day?: number
      is_primary?: boolean
    }) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const acc = await skipCloud.createAccount(currentCompany.id, data)
      await reloadCompanyData()
      return acc
    },
    [currentCompany, reloadCompanyData],
  )

  const updateAccount = useCallback(
    async (accountId: string, data: Partial<Omit<Account, 'id' | 'control_id' | 'created_at'>>) => {
      const acc = await skipCloud.updateAccount(accountId, data)
      await reloadCompanyData()
      return acc
    },
    [reloadCompanyData],
  )

  const deleteAccount = useCallback(
    async (accountId: string) => {
      await skipCloud.deleteAccount(accountId)
      await reloadCompanyData()
    },
    [reloadCompanyData],
  )

  // Category operations
  const createCategory = useCallback(
    async (data: { name: string; type: TransactionType; color: string; icon: string }) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const cat = await skipCloud.createCategory(currentCompany.id, data)
      await reloadCompanyData()
      return cat
    },
    [currentCompany, reloadCompanyData],
  )

  const updateCategory = useCallback(
    async (
      categoryId: string,
      data: Partial<Omit<Category, 'id' | 'control_id' | 'created_at'>>,
    ) => {
      const cat = await skipCloud.updateCategory(categoryId, data)
      await reloadCompanyData()
      return cat
    },
    [reloadCompanyData],
  )

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      await skipCloud.deleteCategory(categoryId)
      await reloadCompanyData()
    },
    [reloadCompanyData],
  )

  // Subcategory operations
  const createSubcategory = useCallback(
    async (data: { category_id: string; name: string; color?: string; icon?: string }) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const sub = await skipCloud.createSubcategory(currentCompany.id, data)
      await reloadCompanyData()
      return sub
    },
    [currentCompany, reloadCompanyData],
  )

  const updateSubcategory = useCallback(
    async (
      subcategoryId: string,
      data: Partial<Omit<Subcategory, 'id' | 'control_id' | 'created_at' | 'category'>>,
    ) => {
      const sub = await skipCloud.updateSubcategory(subcategoryId, data)
      await reloadCompanyData()
      return sub
    },
    [reloadCompanyData],
  )

  const deleteSubcategory = useCallback(
    async (subcategoryId: string) => {
      await skipCloud.deleteSubcategory(subcategoryId)
      await reloadCompanyData()
    },
    [reloadCompanyData],
  )

  // Transaction operations
  const createTransaction = useCallback(
    async (data: {
      account_id: string
      category_id: string
      subcategory_id?: string
      description: string
      amount: number
      type: TransactionType
      date: string
      payment_date?: string
      paid?: boolean
      is_recurring?: boolean
      recurrence_type?: any
      notes?: string
      installments_total?: number
    }) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const tx = await skipCloud.createTransaction(currentCompany.id, data)
      await reloadCompanyData()
      return tx
    },
    [currentCompany, reloadCompanyData],
  )

  const applyTransactionsBatchUpdate = useCallback(
    (mutation: { updated?: Transaction[]; created?: Transaction[]; deletedIds?: string[] }) => {
      setTransactions((prev) => {
        const deletedSet = new Set(mutation.deletedIds || [])
        const updatedMap = new Map((mutation.updated || []).map((t) => [t.id, t]))

        let list = prev
          .filter((t) => !deletedSet.has(t.id))
          .map((t) => (updatedMap.has(t.id) ? updatedMap.get(t.id)! : t))

        if (mutation.created && mutation.created.length > 0) {
          list = [...mutation.created, ...list]
        }
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        return list
      })
    },
    [],
  )

  const updateTransaction = useCallback(
    async (
      transactionId: string,
      data: Partial<Omit<Transaction, 'id' | 'control_id' | 'created_at' | 'user_id'>>,
      options?: { skipReload?: boolean },
    ) => {
      // Optimistic update in local state for instantaneous UI response
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, ...data } : t)))
      const tx = await skipCloud.updateTransaction(transactionId, data)
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? tx : t)))
      if (!options?.skipReload) {
        // Sync accounts / totals in background without blocking caller
        reloadCompanyData().catch(() => {
          // Fallback silencioso
        })
      }
      return tx
    },
    [reloadCompanyData],
  )

  const deleteTransaction = useCallback(
    async (transactionId: string, options?: { skipReload?: boolean }) => {
      // Optimistic local deletion
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
      await skipCloud.deleteTransaction(transactionId)
      if (!options?.skipReload) {
        reloadCompanyData().catch(() => {
          // Fallback silencioso
        })
      }
    },
    [reloadCompanyData],
  )

  const setTransactionsPaidStatus = useCallback(
    async (transactionIds: string[], paid: boolean, options?: { skipReload?: boolean }) => {
      const idSet = new Set(transactionIds)
      // Instant optimistic update
      setTransactions((prev) => prev.map((t) => (idSet.has(t.id) ? { ...t, paid } : t)))
      const updated = await skipCloud.setTransactionsPaidStatus(transactionIds, paid)
      // Update with server returned items
      if (updated.length > 0) {
        const updatedMap = new Map(updated.map((u) => [u.id, u]))
        setTransactions((prev) =>
          prev.map((t) => (updatedMap.has(t.id) ? updatedMap.get(t.id)! : t)),
        )
      }
      if (!options?.skipReload) {
        // Run light background sync to refresh account balances without delaying the UI
        reloadCompanyData().catch(() => {
          // Fallback silencioso
        })
      }
      return updated
    },
    [reloadCompanyData],
  )

  // Team operations
  const inviteMember = useCallback(
    async (email: string, role: UserRole) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const mem = await skipCloud.inviteMember(currentCompany.id, email, role)
      await reloadCompanyData()
      return mem
    },
    [currentCompany, reloadCompanyData],
  )

  const updateMemberRole = useCallback(
    async (memberId: string, role: UserRole) => {
      const mem = await skipCloud.updateMemberRole(memberId, role)
      await reloadCompanyData()
      return mem
    },
    [reloadCompanyData],
  )

  const updateMemberProfile = useCallback(
    async (
      targetUserId: string,
      data: {
        name?: string
        password?: string
        avatarFile?: File | null
      },
    ) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const updatedUser = await skipCloud.updateMemberProfile(currentCompany.id, targetUserId, data)
      await reloadCompanyData()
      return updatedUser
    },
    [currentCompany, reloadCompanyData],
  )

  const removeMember = useCallback(
    async (memberId: string) => {
      await skipCloud.removeMember(memberId)
      await reloadCompanyData()
    },
    [reloadCompanyData],
  )

  // Permission calculation
  const isOwner = currentRole === 'owner'
  const isAdmin = currentRole === 'admin'
  const canManageTeam = isOwner || isAdmin
  const canManageSettings = isOwner || isAdmin
  const canManageFinance = isOwner || isAdmin
  const canManageTransactions = Boolean(currentRole) // All active members

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        userCompanies,
        currentRole,
        members,
        accounts,
        categories,
        subcategories,
        transactions,
        isLoading,
        isCompanyLoading,
        isOwner,
        isAdmin,
        canManageTeam,
        canManageSettings,
        canManageFinance,
        canManageTransactions,
        selectCompany,
        reloadCompanyData,
        reloadUserCompanies,
        createCompany,
        updateCompany,
        getCompanyStats,
        deleteCompany,
        createAccount,
        updateAccount,
        deleteAccount,
        createCategory,
        updateCategory,
        deleteCategory,
        createSubcategory,
        updateSubcategory,
        deleteSubcategory,
        createTransaction,
        updateTransaction,
        deleteTransaction,
        setTransactionsPaidStatus,
        applyTransactionsBatchUpdate,
        inviteMember,
        updateMemberRole,
        updateMemberProfile,
        removeMember,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany deve ser usado dentro de um CompanyProvider')
  }
  return context
}
