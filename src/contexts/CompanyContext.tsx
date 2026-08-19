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
  SegmentType,
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
    segment: SegmentType,
    color: string,
    cnpj?: string,
    description?: string,
  ) => Promise<Company>
  updateCompany: (
    data: Partial<Pick<Company, 'name' | 'cnpj' | 'segment' | 'color' | 'description'>>,
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
    data: Partial<Omit<Account, 'id' | 'company_id' | 'created_at'>>,
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
    data: Partial<Omit<Category, 'id' | 'company_id' | 'created_at'>>,
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
  }) => Promise<Transaction>
  updateTransaction: (
    transactionId: string,
    data: Partial<Omit<Transaction, 'id' | 'company_id' | 'created_at' | 'user_id'>>,
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
  const [userCompanies, setUserCompanies] = useState<Company[]>([])
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCompanyLoading, setIsCompanyLoading] = useState(false)

  // Reload user's accessible companies
  const reloadUserCompanies = useCallback(async () => {
    if (!user) {
      setUserCompanies([])
      setCurrentCompany(null)
      setCurrentRole(null)
      setIsLoading(false)
      return
    }
    try {
      const comps = await skipCloud.getUserCompanies(user.id)
      setUserCompanies(comps)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    reloadUserCompanies()
  }, [reloadUserCompanies])

  // Load all data for the active company
  const reloadCompanyData = useCallback(async () => {
    if (!currentCompany || !user) return
    setIsCompanyLoading(true)
    try {
      const [role, mems, accs, cats, txs, freshComp] = await Promise.all([
        skipCloud.getUserRoleInCompany(currentCompany.id, user.id),
        skipCloud.getCompanyMembers(currentCompany.id),
        skipCloud.getAccounts(currentCompany.id),
        skipCloud.getCategories(currentCompany.id),
        skipCloud.getTransactions(currentCompany.id),
        skipCloud.getCompany(currentCompany.id),
      ])
      if (freshComp) setCurrentCompany(freshComp)
      setCurrentRole(role)
      setMembers(mems)
      setAccounts(accs)
      setCategories(cats)
      setTransactions(txs)
    } finally {
      setIsCompanyLoading(false)
    }
  }, [currentCompany?.id, user])

  const selectCompany = async (companyId: string): Promise<boolean> => {
    if (!user) return false
    setIsCompanyLoading(true)
    try {
      const comp = await skipCloud.getCompany(companyId)
      if (!comp) return false
      const role = await skipCloud.getUserRoleInCompany(companyId, user.id)
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
    } catch {
      return false
    } finally {
      setIsCompanyLoading(false)
    }
  }

  const createCompany = async (
    name: string,
    segment: SegmentType,
    color: string,
    cnpj?: string,
    description?: string,
  ) => {
    const comp = await skipCloud.createCompany(name, segment, color, cnpj, description)
    await reloadUserCompanies()
    await selectCompany(comp.id)
    return comp
  }

  const updateCompany = async (
    data: Partial<Pick<Company, 'name' | 'cnpj' | 'segment' | 'color' | 'description'>>,
  ) => {
    if (!currentCompany) throw new Error('Nenhuma empresa selecionada.')
    const updated = await skipCloud.updateCompany(currentCompany.id, data)
    setCurrentCompany(updated)
    await reloadUserCompanies()
    return updated
  }

  const getCompanyStats = async (companyId: string) => {
    return skipCloud.getCompanyStats(companyId)
  }

  const deleteCompany = async () => {
    if (!currentCompany) throw new Error('Nenhuma empresa selecionada.')
    await skipCloud.deleteCompany(currentCompany.id)
    setCurrentCompany(null)
    setCurrentRole(null)
    await reloadUserCompanies()
  }

  // Account operations
  const createAccount = async (data: {
    name: string
    type: AccountType
    balance: number
    limit?: number
    color: string
    bank?: string
  }) => {
    if (!currentCompany) throw new Error('Nenhuma empresa selecionada.')
    const acc = await skipCloud.createAccount(currentCompany.id, data)
    await reloadCompanyData()
    return acc
  }

  const updateAccount = async (
    accountId: string,
    data: Partial<Omit<Account, 'id' | 'company_id' | 'created_at'>>,
  ) => {
    const acc = await skipCloud.updateAccount(accountId, data)
    await reloadCompanyData()
    return acc
  }

  const deleteAccount = async (accountId: string) => {
    await skipCloud.deleteAccount(accountId)
    await reloadCompanyData()
  }

  // Category operations
  const createCategory = async (data: {
    name: string
    type: TransactionType
    color: string
    icon: string
  }) => {
    if (!currentCompany) throw new Error('Nenhuma empresa selecionada.')
    const cat = await skipCloud.createCategory(currentCompany.id, data)
    await reloadCompanyData()
    return cat
  }

  const updateCategory = async (
    categoryId: string,
    data: Partial<Omit<Category, 'id' | 'company_id' | 'created_at'>>,
  ) => {
    const cat = await skipCloud.updateCategory(categoryId, data)
    await reloadCompanyData()
    return cat
  }

  const deleteCategory = async (categoryId: string) => {
    await skipCloud.deleteCategory(categoryId)
    await reloadCompanyData()
  }

  // Transaction operations
  const createTransaction = async (data: {
    account_id: string
    category_id: string
    description: string
    amount: number
    type: TransactionType
    date: string
    is_recurring?: boolean
    recurrence_type?: any
    notes?: string
  }) => {
    if (!currentCompany) throw new Error('Nenhuma empresa selecionada.')
    const tx = await skipCloud.createTransaction(currentCompany.id, data)
    await reloadCompanyData()
    return tx
  }

  const updateTransaction = async (
    transactionId: string,
    data: Partial<Omit<Transaction, 'id' | 'company_id' | 'created_at' | 'user_id'>>,
  ) => {
    const tx = await skipCloud.updateTransaction(transactionId, data)
    await reloadCompanyData()
    return tx
  }

  const deleteTransaction = async (transactionId: string) => {
    await skipCloud.deleteTransaction(transactionId)
    await reloadCompanyData()
  }

  // Team operations
  const inviteMember = async (email: string, role: UserRole) => {
    if (!currentCompany) throw new Error('Nenhuma empresa selecionada.')
    const mem = await skipCloud.inviteMember(currentCompany.id, email, role)
    await reloadCompanyData()
    return mem
  }

  const updateMemberRole = async (memberId: string, role: UserRole) => {
    const mem = await skipCloud.updateMemberRole(memberId, role)
    await reloadCompanyData()
    return mem
  }

  const removeMember = async (memberId: string) => {
    await skipCloud.removeMember(memberId)
    await reloadCompanyData()
  }

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
