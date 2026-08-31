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
  Transaction,
  UserRole,
  AccountType,
  TransactionType,
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
  selectCompany: (companyId: string) => Promise<boolean>
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

  // Transactions
  createTransaction: (data: {
    account_id: string
    category_id: string
    description: string
    amount: number
    type: TransactionType
    date: string
    is_recurring?: boolean
    recurrence_type?: any
    notes?: string
    responsible?: string
    installments_total?: number
  }) => Promise<Transaction>
  updateTransaction: (
    transactionId: string,
    data: Partial<Omit<Transaction, 'id' | 'control_id' | 'created_at' | 'user_id'>>,
  ) => Promise<Transaction>
  deleteTransaction: (transactionId: string) => Promise<void>

  // Team
  inviteMember: (email: string, role: UserRole) => Promise<CompanyMember>
  updateMemberRole: (memberId: string, role: UserRole) => Promise<CompanyMember>
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCompanyLoading, setIsCompanyLoading] = useState(false)

  const activeCompanyId = currentCompany?.id

  // Reload user's accessible companies
  const reloadUserCompanies = useCallback(async () => {
    if (!userId) {
      setUserCompanies([])
      setCurrentCompany(null)
      setCurrentRole(null)
      setIsLoading(false)
      return
    }
    // Flip back to loading so consumers (e.g. ProtectedCompanyRoute) know the
    // access list is being refreshed and don't redirect prematurely.
    setIsLoading(true)
    try {
      const comps = await skipCloud.getUserCompanies(userId)
      setUserCompanies(comps)
    } catch (e) {
      console.error('[CompanyContext] reloadUserCompanies falhou:', e)
      setUserCompanies([])
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    reloadUserCompanies()
  }, [reloadUserCompanies])

  // Load all data for the active company
  const reloadCompanyData = useCallback(async () => {
    if (!activeCompanyId || !userId) return
    setIsCompanyLoading(true)
    try {
      const [role, mems, accs, cats, txs, freshComp] = await Promise.all([
        skipCloud.getUserRoleInCompany(activeCompanyId, userId),
        skipCloud.getCompanyMembers(activeCompanyId),
        skipCloud.getAccounts(activeCompanyId),
        skipCloud.getCategories(activeCompanyId),
        skipCloud.getTransactions(activeCompanyId),
        skipCloud.getCompany(activeCompanyId),
      ])
      if (freshComp) setCurrentCompany(freshComp)
      setCurrentRole(role)
      setMembers(mems)
      setAccounts(accs)
      setCategories(cats)
      setTransactions(txs)
    } catch (e) {
      console.error('[CompanyContext] reloadCompanyData falhou:', e)
      throw e
    } finally {
      setIsCompanyLoading(false)
    }
  }, [activeCompanyId, userId])

  const selectCompany = useCallback(
    async (companyId: string): Promise<boolean> => {
      if (!userId) return false
      setIsCompanyLoading(true)
      try {
        const comp = await skipCloud.getCompany(companyId)
        if (!comp) return false
        const role = await skipCloud.getUserRoleInCompany(companyId, userId)
        if (!role) return false // user does not belong to this company

        setCurrentCompany(comp)
        setCurrentRole(role)

        const [mems, accs, cats, txs] = await Promise.all([
          skipCloud.getCompanyMembers(companyId),
          skipCloud.getAccounts(companyId),
          skipCloud.getCategories(companyId),
          skipCloud.getTransactions(companyId),
        ])
        setMembers(mems)
        setAccounts(accs)
        setCategories(cats)
        setTransactions(txs)
        return true
      } catch (e) {
        console.error('[CompanyContext] selectCompany falhou:', e)
        return false
      } finally {
        setIsCompanyLoading(false)
      }
    },
    [userId],
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

  // Transaction operations
  const createTransaction = useCallback(
    async (data: {
      account_id: string
      category_id: string
      description: string
      amount: number
      type: TransactionType
      date: string
      is_recurring?: boolean
      recurrence_type?: any
      notes?: string
      responsible?: string
      installments_total?: number
    }) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const tx = await skipCloud.createTransaction(currentCompany.id, data)
      await reloadCompanyData()
      return tx
    },
    [currentCompany, reloadCompanyData],
  )

  const updateTransaction = useCallback(
    async (
      transactionId: string,
      data: Partial<Omit<Transaction, 'id' | 'control_id' | 'created_at' | 'user_id'>>,
    ) => {
      const tx = await skipCloud.updateTransaction(transactionId, data)
      await reloadCompanyData()
      return tx
    },
    [reloadCompanyData],
  )

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      await skipCloud.deleteTransaction(transactionId)
      await reloadCompanyData()
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
        createTransaction,
        updateTransaction,
        deleteTransaction,
        inviteMember,
        updateMemberRole,
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
