import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
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
  isTransactionsLoading: boolean

  // Month-based transaction loading & cache
  loadTransactionsForMonth: (
    monthStr: string,
    options?: { force?: boolean },
  ) => Promise<Transaction[]>
  loadTransactionsForMonths: (months: string[]) => Promise<Transaction[]>
  loadAllTransactions: (options?: { force?: boolean }) => Promise<Transaction[]>
  searchTransactionsServer: (term: string) => Promise<Transaction[]>
  invalidateTransactionsCache: () => void

  // Permissions helpers
  isOwner: boolean
  isAdmin: boolean
  isViewer: boolean
  canManageTeam: boolean
  canManageSettings: boolean
  canManageFinance: boolean // accounts, categories
  canManageTransactions: boolean // members, admins, owners (not viewers)

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
  deleteAccount: (accountId: string) => Promise<{ softDeleted: boolean }>
  restoreAccount: (accountId: string) => Promise<Account>

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
  deleteCategory: (categoryId: string) => Promise<{ softDeleted: boolean }>
  restoreCategory: (categoryId: string) => Promise<Category>

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
  deleteSubcategory: (subcategoryId: string) => Promise<{ softDeleted: boolean }>
  restoreSubcategory: (subcategoryId: string) => Promise<Subcategory>

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
    installment_total?: number
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
      currentPassword?: string
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
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false)

  // Cache em memória de transações por mês: Record<"YYYY-MM", Transaction[]>
  // e flag para checar se todos os meses já foram carregados
  const monthCacheRef = useRef<Map<string, Transaction[]>>(new Map())
  const allLoadedRef = useRef<boolean>(false)
  // Cache de metadados prontos para evitar requisições repetidas ao buscar transações
  const metadataCacheRef = useRef<{
    accounts: Record<string, Account>
    categories: Record<string, Category>
    subcategories: Record<string, Subcategory>
    users: Record<string, User>
  }>({
    accounts: {},
    categories: {},
    subcategories: {},
    users: {},
  })

  // Sincroniza metadataCacheRef sempre que contas/categorias/membros mudarem
  useEffect(() => {
    const accMap: Record<string, Account> = {}
    accounts.forEach((a) => {
      accMap[a.id] = a
    })
    const catMap: Record<string, Category> = {}
    categories.forEach((c) => {
      catMap[c.id] = c
    })
    const subMap: Record<string, Subcategory> = {}
    subcategories.forEach((s) => {
      subMap[s.id] = s
    })
    const userMap: Record<string, User> = {}
    members.forEach((m) => {
      if (m.user?.id) {
        userMap[m.user.id] = m.user
      } else if (m.user_id) {
        userMap[m.user_id] = {
          id: m.user_id,
          email: m.email || m.invited_email || '',
          name: m.email || '',
          created_at: m.created_at,
        }
      }
    })
    metadataCacheRef.current = {
      accounts: accMap,
      categories: catMap,
      subcategories: subMap,
      users: userMap,
    }
  }, [accounts, categories, subcategories, members])

  const activeCompanyId = currentCompany?.id

  const ACTIVE_CONTROL_KEY = 'cf_active_control_id'

  const invalidateTransactionsCache = useCallback(() => {
    monthCacheRef.current.clear()
    allLoadedRef.current = false
  }, [])

  // Helper para mesclar transações novas na lista do estado sem duplicatas
  const mergeTransactionsIntoState = useCallback((newTxs: Transaction[]) => {
    setTransactions((prev) => {
      const map = new Map<string, Transaction>()
      // Coloca existentes
      prev.forEach((t) => map.set(t.id, t))
      // Atualiza / insere novos
      newTxs.forEach((t) => map.set(t.id, t))
      const combined = Array.from(map.values())
      // Ordenação decrescente por data/criação como padrão da lista de dados
      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      return combined
    })
  }, [])

  // Reconstrói a lista de transações como a UNIÃO de todos os meses presentes no
  // cache de meses. Usado pela sincronização em segundo plano para nunca substituir
  // o que o usuário está vendo (mesma regra do loadAllTransactions).
  const rebuildTransactionsFromMonthCache = useCallback(() => {
    const combined: Transaction[] = []
    const seen = new Set<string>()
    monthCacheRef.current.forEach((monthTxs) => {
      monthTxs.forEach((t) => {
        if (seen.has(t.id)) return
        seen.add(t.id)
        combined.push(t)
      })
    })
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setTransactions(combined)
    return combined
  }, [])

  // Carrega transações de um mês específico ("YYYY-MM") usando cache
  const loadTransactionsForMonth = useCallback(
    async (monthStr: string, options?: { force?: boolean }): Promise<Transaction[]> => {
      if (!activeCompanyId) return []
      if (!options?.force && monthCacheRef.current.has(monthStr)) {
        return monthCacheRef.current.get(monthStr)!
      }

      setIsTransactionsLoading(true)
      try {
        const txs = await skipCloud.getTransactions(activeCompanyId, {
          month: monthStr,
          caches: metadataCacheRef.current,
        })
        monthCacheRef.current.set(monthStr, txs)
        mergeTransactionsIntoState(txs)
        return txs
      } catch (err) {
        console.warn(`[CompanyContext] Falha ao carregar mês ${monthStr}:`, err)
        return []
      } finally {
        setIsTransactionsLoading(false)
      }
    },
    [activeCompanyId, mergeTransactionsIntoState],
  )

  // Carrega transações de múltiplos meses em paralelo
  const loadTransactionsForMonths = useCallback(
    async (months: string[]): Promise<Transaction[]> => {
      if (!activeCompanyId || months.length === 0) return []
      const uncached = months.filter((m) => !monthCacheRef.current.has(m))
      if (uncached.length === 0) {
        const all: Transaction[] = []
        months.forEach((m) => {
          const cached = monthCacheRef.current.get(m)
          if (cached) all.push(...cached)
        })
        return all
      }

      setIsTransactionsLoading(true)
      try {
        const results = await Promise.all(
          uncached.map((m) =>
            skipCloud
              .getTransactions(activeCompanyId, {
                month: m,
                caches: metadataCacheRef.current,
              })
              .then((txs) => {
                monthCacheRef.current.set(m, txs)
                return txs
              })
              .catch(() => [] as Transaction[]),
          ),
        )
        const flattened = results.flat()
        mergeTransactionsIntoState(flattened)

        const all: Transaction[] = []
        months.forEach((m) => {
          const cached = monthCacheRef.current.get(m)
          if (cached) all.push(...cached)
        })
        return all
      } finally {
        setIsTransactionsLoading(false)
      }
    },
    [activeCompanyId, mergeTransactionsIntoState],
  )

  // Carrega todos os lançamentos (quando o usuário escolhe "Todos os Meses" ou exportação)
  const loadAllTransactions = useCallback(
    async (options?: { force?: boolean }): Promise<Transaction[]> => {
      if (!activeCompanyId) return []
      if (!options?.force && allLoadedRef.current) {
        return transactions
      }

      setIsTransactionsLoading(true)
      try {
        const txs = await skipCloud.getTransactions(activeCompanyId, {
          all: true,
          caches: metadataCacheRef.current,
        })
        allLoadedRef.current = true
        // Popula cache de meses com os dados recebidos
        const byMonth = new Map<string, Transaction[]>()
        txs.forEach((tx) => {
          const eff = tx.payment_date || tx.date
          if (eff && eff.length >= 7) {
            const ym = eff.substring(0, 7)
            if (/^\d{4}-\d{2}$/.test(ym)) {
              if (!byMonth.has(ym)) byMonth.set(ym, [])
              byMonth.get(ym)!.push(tx)
            }
          }
        })
        byMonth.forEach((list, ym) => {
          monthCacheRef.current.set(ym, list)
        })

        setTransactions(txs)
        return txs
      } catch (err) {
        console.warn('[CompanyContext] Falha ao carregar todos os lançamentos:', err)
        return transactions
      } finally {
        setIsTransactionsLoading(false)
      }
    },
    [activeCompanyId, transactions],
  )

  // Busca remota de lançamentos por descrição ou anotações (server-side)
  const searchTransactionsServer = useCallback(
    async (term: string): Promise<Transaction[]> => {
      if (!activeCompanyId || !term.trim()) return []
      setIsTransactionsLoading(true)
      try {
        const txs = await skipCloud.getTransactions(activeCompanyId, {
          search: term.trim(),
          caches: metadataCacheRef.current,
        })
        mergeTransactionsIntoState(txs)
        return txs
      } catch (err) {
        console.warn('[CompanyContext] Falha ao buscar transações no servidor:', err)
        return []
      } finally {
        setIsTransactionsLoading(false)
      }
    },
    [activeCompanyId, mergeTransactionsIntoState],
  )

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
      invalidateTransactionsCache()
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const cachedControlId =
        typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_CONTROL_KEY) : null
      let targetComp: Company | null = null

      // Paraleliza resolução do controle: se houver cachedControlId, busca ambos em paralelo com fallback rápido
      if (cachedControlId) {
        try {
          const [cachedRes, singleRes] = await Promise.allSettled([
            Promise.race([
              skipCloud.getCompany(cachedControlId),
              new Promise<null>((r) => setTimeout(() => r(null), 3000)),
            ]),
            Promise.race([
              skipCloud.getSingleCompany(userId),
              new Promise<null>((r) => setTimeout(() => r(null), 3500)),
            ]),
          ])
          targetComp =
            (cachedRes.status === 'fulfilled' ? cachedRes.value : null) ||
            (singleRes.status === 'fulfilled' ? singleRes.value : null)
        } catch {
          targetComp = null
        }
      } else {
        try {
          targetComp = await Promise.race([
            skipCloud.getSingleCompany(userId),
            new Promise<null>((r) => setTimeout(() => r(null), 3500)),
          ])
        } catch {
          targetComp = null
        }
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

        // Limpa cache se mudou de controle
        invalidateTransactionsCache()

        // Determina o mês corrente no boot ("YYYY-MM")
        const now = new Date()
        const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        // Carrega papel e metadados do controle uma única vez em paralelo,
        // buscando transações apenas do mês corrente no boot
        const [role, mems, accs, cats, subcats, currentMonthTxs] = await Promise.all([
          skipCloud.getUserRoleInCompany(targetComp.id, userId).catch(() => 'owner' as UserRole),
          skipCloud.getCompanyMembers(targetComp.id).catch(() => [] as CompanyMember[]),
          skipCloud.getAccounts(targetComp.id).catch(() => [] as Account[]),
          skipCloud.getCategories(targetComp.id).catch(() => [] as Category[]),
          skipCloud.getSubcategories(targetComp.id).catch(() => [] as Subcategory[]),
          skipCloud
            .getTransactions(targetComp.id, { month: currentYm })
            .catch(() => [] as Transaction[]),
        ])

        setCurrentRole(role || 'owner')
        setMembers(mems || [])
        setAccounts(accs || [])
        setCategories(cats || [])
        setSubcategories(subcats || [])
        setTransactions(currentMonthTxs || [])
        monthCacheRef.current.set(currentYm, currentMonthTxs || [])
      } else {
        setUserCompanies([])
        setCurrentCompany(null)
        setCurrentRole(null)
      }
    } catch (e) {
      console.warn('[CompanyContext] reloadUserCompanies encontrou erro:', e)
      setUserCompanies([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, invalidateTransactionsCache])

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
        const [targetRes, singleRes] = await Promise.allSettled([
          skipCloud.getCompany(targetControlId),
          skipCloud.getSingleCompany(userId),
        ])
        resolvedComp =
          (targetRes.status === 'fulfilled' ? targetRes.value : null) ||
          (singleRes.status === 'fulfilled' ? singleRes.value : null)
      } else {
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

      // Captura ANTES de invalidar: meses já conhecidos localmente (carregados por
      // navegação/busca/etc.) precisam continuar no cache para a lista reconstruída
      // manter o que o usuário está vendo.
      const cachedMonths = Array.from(monthCacheRef.current.keys())
      invalidateTransactionsCache()
      const now = new Date()
      const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const monthsToFetch = Array.from(new Set([currentYm, ...cachedMonths]))

      const [role, mems, accs, cats, subcats, ...monthResults] = await Promise.all([
        skipCloud.getUserRoleInCompany(finalControlId, userId).catch(() => null),
        skipCloud.getCompanyMembers(finalControlId).catch(() => [] as CompanyMember[]),
        skipCloud.getAccounts(finalControlId).catch(() => [] as Account[]),
        skipCloud.getCategories(finalControlId).catch(() => [] as Category[]),
        skipCloud.getSubcategories(finalControlId).catch(() => [] as Subcategory[]),
        ...monthsToFetch.map((ym) =>
          skipCloud
            .getTransactions(finalControlId, { month: ym })
            .then((monthTxs) => [ym, monthTxs] as const)
            .catch(() => [ym, [] as Transaction[]] as const),
        ),
      ])

      setCurrentCompany(resolvedComp)
      setUserCompanies([resolvedComp])
      if (role) setCurrentRole(role)
      setMembers(mems || [])
      setAccounts(accs || [])
      setCategories(cats || [])
      setSubcategories(subcats || [])
      monthResults.forEach(([ym, monthTxs]) => {
        monthCacheRef.current.set(ym, monthTxs)
      })
      // União de TODOS os meses em cache (não só o mês corrente), preservando o que o
      // usuário está vendo — inclusive quando está em outro mês ou "Todos os Meses".
      rebuildTransactionsFromMonthCache()
    } catch {
      // Falha silenciosa sem expor 404/erros no console
    } finally {
      setIsCompanyLoading(false)
    }
  }, [
    activeCompanyId,
    currentCompany?.id,
    userId,
    invalidateTransactionsCache,
    rebuildTransactionsFromMonthCache,
  ])

  const selectCompany = useCallback(
    async (companyId?: string): Promise<boolean> => {
      if (!userId) return false
      setIsCompanyLoading(true)
      try {
        const cachedControlId =
          typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_CONTROL_KEY) : null
        const targetId = companyId || cachedControlId || currentCompany?.id
        let comp: Company | null = null

        if (targetId) {
          const [byTarget, singleRes] = await Promise.allSettled([
            skipCloud.getCompany(targetId),
            skipCloud.getSingleCompany(userId),
          ])
          comp =
            (byTarget.status === 'fulfilled' ? byTarget.value : null) ||
            (singleRes.status === 'fulfilled' ? singleRes.value : null)
        } else {
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
        invalidateTransactionsCache()

        const now = new Date()
        const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        const [mems, accs, cats, subcats, txs] = await Promise.all([
          skipCloud.getCompanyMembers(comp.id).catch(() => [] as CompanyMember[]),
          skipCloud.getAccounts(comp.id).catch(() => [] as Account[]),
          skipCloud.getCategories(comp.id).catch(() => [] as Category[]),
          skipCloud.getSubcategories(comp.id).catch(() => [] as Subcategory[]),
          skipCloud.getTransactions(comp.id, { month: currentYm }).catch(() => [] as Transaction[]),
        ])
        setMembers(mems || [])
        setAccounts(accs || [])
        setCategories(cats || [])
        setSubcategories(subcats || [])
        setTransactions(txs || [])
        monthCacheRef.current.set(currentYm, txs || [])
        return true
      } catch {
        return false
      } finally {
        setIsCompanyLoading(false)
      }
    },
    [userId, currentCompany?.id, invalidateTransactionsCache],
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
      const res = await skipCloud.deleteAccount(accountId)
      await reloadCompanyData()
      return res
    },
    [reloadCompanyData],
  )

  const restoreAccount = useCallback(
    async (accountId: string) => {
      const res = await skipCloud.restoreAccount(accountId)
      await reloadCompanyData()
      return res
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
      const res = await skipCloud.deleteCategory(categoryId)
      await reloadCompanyData()
      return res
    },
    [reloadCompanyData],
  )

  const restoreCategory = useCallback(
    async (categoryId: string) => {
      const res = await skipCloud.restoreCategory(categoryId)
      await reloadCompanyData()
      return res
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
      const res = await skipCloud.deleteSubcategory(subcategoryId)
      await reloadCompanyData()
      return res
    },
    [reloadCompanyData],
  )

  const restoreSubcategory = useCallback(
    async (subcategoryId: string) => {
      const res = await skipCloud.restoreSubcategory(subcategoryId)
      await reloadCompanyData()
      return res
    },
    [reloadCompanyData],
  )

  // Transaction operations
  const createTransaction = useCallback(
    async (
      data: {
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
        installment_total?: number
      },
      options?: { skipReload?: boolean },
    ) => {
      if (!currentCompany) throw new Error('Nenhum controle selecionado.')
      const tx = await skipCloud.createTransaction(currentCompany.id, data)
      // Garante que o mês da transação criada (data efetiva) esteja no cache antes da
      // sincronização em segundo plano — assim a união de meses preserva o que o
      // usuário está vendo, inclusive meses fora do corrente.
      const effYmd = String(tx.payment_date || tx.date || '').substring(0, 7)
      if (effYmd && /^\d{4}-\d{2}$/.test(effYmd) && !monthCacheRef.current.has(effYmd)) {
        try {
          const monthTxs = await skipCloud.getTransactions(currentCompany.id, {
            month: effYmd,
            caches: metadataCacheRef.current,
          })
          monthCacheRef.current.set(effYmd, monthTxs)
        } catch {
          // Fallback silencioso: sem o mês, a união ainda mantém os demais
        }
      }
      // Invalida cache de meses pois nova transação foi persistida
      invalidateTransactionsCache()
      // Instant insertion in local state so UI updates immediately without waiting for reload
      setTransactions((prev) => {
        const next = [tx, ...prev.filter((t) => t.id !== tx.id)]
        next.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        return next
      })
      if (!options?.skipReload) {
        // Run light background sync to refresh account balances and stats without delaying caller
        reloadCompanyData().catch(() => {
          // Fallback silencioso
        })
      }
      return tx
    },
    [currentCompany, invalidateTransactionsCache, reloadCompanyData],
  )

  const applyTransactionsBatchUpdate = useCallback(
    (mutation: { updated?: Transaction[]; created?: Transaction[]; deletedIds?: string[] }) => {
      invalidateTransactionsCache()
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
    [invalidateTransactionsCache],
  )

  const updateTransaction = useCallback(
    async (
      transactionId: string,
      data: Partial<Omit<Transaction, 'id' | 'control_id' | 'created_at' | 'user_id'>>,
      options?: { skipReload?: boolean },
    ) => {
      invalidateTransactionsCache()
      // Optimistic update in local state for instantaneous UI response
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? { ...t, ...data } : t)))
      const tx = await skipCloud.updateTransaction(transactionId, data)
      setTransactions((prev) => prev.map((t) => (t.id === transactionId ? tx : t)))
      // Garante que o mês da data efetiva (antiga e nova) esteja no cache antes da
      // sincronização — a união de meses preserva o que o usuário está vendo.
      if (currentCompany) {
        const monthsToEnsure = new Set<string>()
        const prevTx = transactions.find((t) => t.id === transactionId)
        const prevEff = String(prevTx?.payment_date || prevTx?.date || '').substring(0, 7)
        const newEff = String(tx.payment_date || tx.date || '').substring(0, 7)
        if (prevEff && /^\d{4}-\d{2}$/.test(prevEff)) monthsToEnsure.add(prevEff)
        if (newEff && /^\d{4}-\d{2}$/.test(newEff)) monthsToEnsure.add(newEff)
        for (const ym of monthsToEnsure) {
          if (monthCacheRef.current.has(ym)) continue
          try {
            const monthTxs = await skipCloud.getTransactions(currentCompany.id, {
              month: ym,
              caches: metadataCacheRef.current,
            })
            monthCacheRef.current.set(ym, monthTxs)
          } catch {
            // Fallback silencioso
          }
        }
      }
      if (!options?.skipReload) {
        // Sync accounts / totals in background without blocking caller
        reloadCompanyData().catch(() => {
          // Fallback silencioso
        })
      }
      return tx
    },
    [currentCompany, transactions, invalidateTransactionsCache, reloadCompanyData],
  )

  const deleteTransaction = useCallback(
    async (transactionId: string, options?: { skipReload?: boolean }) => {
      invalidateTransactionsCache()
      // Optimistic local deletion
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
      await skipCloud.deleteTransaction(transactionId)
      // Garante que o mês da transação excluída (data efetiva) permaneça no cache
      // antes da sincronização — a união de meses preserva o que está na tela.
      if (currentCompany) {
        const deletedTx = transactions.find((t) => t.id === transactionId)
        const delEff = String(deletedTx?.payment_date || deletedTx?.date || '').substring(0, 7)
        if (delEff && /^\d{4}-\d{2}$/.test(delEff) && !monthCacheRef.current.has(delEff)) {
          try {
            const monthTxs = await skipCloud.getTransactions(currentCompany.id, {
              month: delEff,
              caches: metadataCacheRef.current,
            })
            monthCacheRef.current.set(delEff, monthTxs)
          } catch {
            // Fallback silencioso
          }
        }
      }
      if (!options?.skipReload) {
        reloadCompanyData().catch(() => {
          // Fallback silencioso
        })
      }
    },
    [currentCompany, transactions, invalidateTransactionsCache, reloadCompanyData],
  )

  const setTransactionsPaidStatus = useCallback(
    async (transactionIds: string[], paid: boolean, options?: { skipReload?: boolean }) => {
      invalidateTransactionsCache()
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
    [currentCompany, transactions, invalidateTransactionsCache, reloadCompanyData],
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
        currentPassword?: string
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
  const isViewer = currentRole === 'viewer'
  const canManageTeam = isOwner || isAdmin
  const canManageSettings = isOwner || isAdmin
  const canManageFinance = isOwner || isAdmin
  const canManageTransactions = Boolean(currentRole) && !isViewer // Viewers cannot create/edit/delete

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
        isViewer,
        isTransactionsLoading,
        loadTransactionsForMonth,
        loadTransactionsForMonths,
        loadAllTransactions,
        searchTransactionsServer,
        invalidateTransactionsCache,
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
        restoreAccount,
        createCategory,
        updateCategory,
        deleteCategory,
        restoreCategory,
        createSubcategory,
        updateSubcategory,
        deleteSubcategory,
        restoreSubcategory,
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
