/**
 * Skip Cloud (PocketBase) data service.
 *
 * All data is persisted server-side and isolated per financial control
 * (tenant) through the `control_id` field. Collections reflect the personal
 * finance schema: `financial_controls`, `control_members`, etc.
 */
import {
  User,
  Company,
  CompanyMember,
  Account,
  Category,
  Subcategory,
  Transaction,
  AccountType,
  TransactionType,
  UserRole,
} from '@/types/database'
import pb from '@/lib/pocketbase/client'

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Moradia', color: '#EF4444', icon: 'Home' },
  { name: 'Alimentação', color: '#F97316', icon: 'Utensils' },
  { name: 'Transporte', color: '#F59E0B', icon: 'Car' },
  { name: 'Saúde', color: '#EC4899', icon: 'Heart' },
  { name: 'Educação', color: '#8B5CF6', icon: 'Book' },
  { name: 'Lazer', color: '#06B6D4', icon: 'Gamepad2' },
  { name: 'Compras', color: '#6366F1', icon: 'ShoppingBag' },
  { name: 'Assinaturas', color: '#10B981', icon: 'Repeat' },
  { name: 'Utilidades', color: '#3B82F6', icon: 'Zap' },
  { name: 'Outros', color: '#64748B', icon: 'MoreHorizontal' },
]

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salário', color: '#10B981', icon: 'Briefcase' },
  { name: 'Freelance', color: '#06B6D4', icon: 'Laptop' },
  { name: 'Investimentos', color: '#8B5CF6', icon: 'TrendingUp' },
  { name: 'Reembolsos', color: '#F59E0B', icon: 'Undo2' },
  { name: 'Outros', color: '#64748B', icon: 'PlusCircle' },
]

export const PALETTE_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#3B82F6', // Blue
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avatarUrl(userId: string): string {
  // deterministic avatar from user id
  const seed = (userId || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 50
  return `https://img.usecurling.com/ppl/medium?seed=${seed}`
}

function mapUser(m: any): User {
  return {
    id: m.id,
    name: m.name || '',
    email: m.email || '',
    avatar: m.avatar || avatarUrl(m.id),
    created_at: m.created || new Date().toISOString(),
  }
}

function mapCompany(r: any): Company {
  return {
    id: r.id,
    name: r.name || '',
    color: r.color || '#6366F1',
    description: r.description || undefined,
    created_at: r.created || new Date().toISOString(),
    owner_id: r.owner_id || '',
    owner_email: r.owner_email || undefined,
  }
}

function mapMember(r: any, usersCache?: Record<string, User>): CompanyMember {
  const user: User | undefined = r.expand?.user_id
    ? mapUser(r.expand.user_id)
    : usersCache?.[r.user_id]
  return {
    id: r.id,
    control_id: r.control_id || '',
    user_id: r.user_id || '',
    email: r.email || '',
    role: (r.role as UserRole) || 'member',
    status: (r.status as 'active' | 'pending') || 'active',
    invited_email: r.invited_email || r.email || undefined,
    created_at: r.created || new Date().toISOString(),
    user,
  }
}

function mapAccount(r: any): Account {
  return {
    id: r.id,
    control_id: r.control_id || '',
    name: r.name || '',
    type: (r.type as AccountType) || 'banco',
    balance: Number(r.balance) || 0,
    limit: r.limit !== undefined && r.limit !== null ? Number(r.limit) : undefined,
    color: r.color || '#6366F1',
    bank: r.bank || undefined,
    created_at: r.created || new Date().toISOString(),
  }
}

function mapCategory(r: any): Category {
  return {
    id: r.id,
    control_id: r.control_id || '',
    name: r.name || '',
    type: (r.type as TransactionType) || 'despesa',
    color: r.color || '#6366F1',
    icon: r.icon || 'Tag',
    is_default: Boolean(r.is_default),
    created_at: r.created || new Date().toISOString(),
  }
}

function mapSubcategory(r: any, categoriesCache?: Record<string, Category>): Subcategory {
  const cat = r.expand?.category_id
    ? mapCategory(r.expand.category_id)
    : categoriesCache?.[r.category_id]
  return {
    id: r.id,
    control_id: r.control_id || '',
    category_id: r.category_id || '',
    name: r.name || '',
    color: r.color || undefined,
    icon: r.icon || undefined,
    created_at: r.created || new Date().toISOString(),
    category: cat,
  }
}

function mapTransaction(
  r: any,
  accountsCache?: Record<string, Account>,
  categoriesCache?: Record<string, Category>,
  usersCache?: Record<string, User>,
  subcategoriesCache?: Record<string, Subcategory>,
): Transaction {
  const acc = r.expand?.account_id ? mapAccount(r.expand.account_id) : accountsCache?.[r.account_id]
  const cat = r.expand?.category_id
    ? mapCategory(r.expand.category_id)
    : categoriesCache?.[r.category_id]
  const subcat = r.expand?.subcategory_id
    ? mapSubcategory(r.expand.subcategory_id, categoriesCache)
    : subcategoriesCache?.[r.subcategory_id]
  const user = r.expand?.user_id ? mapUser(r.expand.user_id) : usersCache?.[r.user_id]
  return {
    id: r.id,
    control_id: r.control_id || '',
    account_id: r.account_id || '',
    category_id: r.category_id || '',
    subcategory_id: r.subcategory_id || undefined,
    user_id: r.user_id || '',
    description: r.description || '',
    amount: Number(r.amount) || 0,
    type: (r.type as TransactionType) || 'despesa',
    date: r.date || new Date().toISOString().split('T')[0],
    paid: r.paid !== undefined ? Boolean(r.paid) : true,
    is_recurring:
      r.is_recurring !== undefined
        ? Boolean(r.is_recurring)
        : r.recurring !== undefined
          ? Boolean(r.recurring)
          : false,
    recurring:
      r.is_recurring !== undefined
        ? Boolean(r.is_recurring)
        : r.recurring !== undefined
          ? Boolean(r.recurring)
          : false,
    recurrence_type: r.recurrence_type || r.recurrence_period || undefined,
    installments_total:
      r.installment_total !== undefined && r.installment_total !== null
        ? Number(r.installment_total)
        : r.installments_total !== undefined && r.installments_total !== null
          ? Number(r.installments_total)
          : undefined,
    installment_number:
      r.installment_number !== undefined && r.installment_number !== null
        ? Number(r.installment_number)
        : undefined,
    parent_transaction_id: r.parent_transaction_id || undefined,
    notes: r.notes || undefined,
    responsible: r.responsible || undefined,
    created_at: r.created || new Date().toISOString(),
    account: acc,
    category: cat,
    subcategory: subcat,
    user,
  }
}

function pbErr(e: any): Error {
  const data = e?.response?.data || e?.data
  const msgs: string[] = []
  if (data && typeof data === 'object') {
    Object.keys(data).forEach((k) => {
      const v = data[k]
      if (v && v.message) msgs.push(`${k}: ${v.message}`)
      else if (typeof v === 'string') msgs.push(`${k}: ${v}`)
    })
  }
  if (msgs.length) return new Error(msgs.join(' | '))
  return new Error(e?.message || 'Erro ao comunicar com o servidor.')
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class SkipCloudService {
  // --- AUTH ---
  async getCurrentUser(): Promise<User | null> {
    if (!pb.authStore.isValid) return null
    const model = pb.authStore.model as any
    if (!model) return null
    return mapUser(model)
  }

  async login(email: string, password: string): Promise<User> {
    try {
      const auth = await pb
        .collection('users')
        .authWithPassword(email.trim().toLowerCase(), password)
      return mapUser(auth.record)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async register(name: string, email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase()

    // --- Invite-only: a new user CANNOT register without a pending invitation ---
    let hasPendingInvite = false
    try {
      const pending = await pb.collection('control_members').getFullList({
        filter: `email="${normalizedEmail}" && status="pending"`,
      })
      hasPendingInvite = pending.length > 0
    } catch {
      // If the query itself fails, fail safe by blocking registration
    }
    if (!hasPendingInvite) {
      throw new Error(
        'Este e-mail não possui convite pendente. Solicite um convite ao proprietário de um controle financeiro.',
      )
    }

    try {
      const record = await pb.collection('users').create({
        name: name.trim(),
        email: normalizedEmail,
        password,
        passwordConfirm: password,
      })
      // Auto-activate any pending invitations for this email
      try {
        const pending = await pb.collection('control_members').getFullList({
          filter: `email="${normalizedEmail}" && status="pending"`,
        })
        for (const m of pending) {
          await pb.collection('control_members').update(m.id, {
            user_id: record.id,
            status: 'active',
          })
        }
      } catch {
        // ignore invite activation errors
      }
      const auth = await pb.collection('users').authWithPassword(normalizedEmail, password)
      return mapUser(auth.record)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async logout(): Promise<void> {
    pb.authStore.clear()
  }

  // --- FINANCIAL CONTROLS ---
  async getUserCompanies(userId: string): Promise<Company[]> {
    try {
      const members = await pb.collection('control_members').getFullList({
        filter: `user_id="${userId}" && status="active"`,
      })
      const controlIds = members.map((m: any) => m.control_id).filter(Boolean)
      if (controlIds.length === 0) return []
      const orFilter = controlIds.map((id: string) => `id="${id}"`).join(' || ')
      const comps = await pb.collection('financial_controls').getFullList({ filter: orFilter })
      return comps.map(mapCompany)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async getCompany(companyId: string): Promise<Company | null> {
    try {
      const r = await pb.collection('financial_controls').getOne(companyId)
      return mapCompany(r)
    } catch {
      return null
    }
  }

  async createCompany(
    name: string,
    color: string,
    ownerEmail: string,
    description?: string,
  ): Promise<Company> {
    const normalizedEmail = ownerEmail.trim().toLowerCase()
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Informe um e-mail válido para o responsável do controle.')
    }
    try {
      // Create the financial control
      const comp = await pb.collection('financial_controls').create({
        name: name.trim(),
        color,
        description: description?.trim() || '',
        owner_id: pb.authStore.model?.id || '',
        owner_email: normalizedEmail,
      })
      const companyId = comp.id

      // Find or create the owner user by email
      let ownerUserId = ''
      const existingUsers = await pb.collection('users').getList(1, 1, {
        filter: `email="${normalizedEmail}"`,
      })
      if (existingUsers.items.length > 0) {
        ownerUserId = existingUsers.items[0].id
      } else {
        const newOwner = await pb.collection('users').create({
          name: normalizedEmail.split('@')[0].replace(/[._-]+/g, ' '),
          email: normalizedEmail,
          password: '12345678',
          passwordConfirm: '12345678',
        })
        ownerUserId = newOwner.id
      }

      // Link owner as member
      await pb.collection('control_members').create({
        control_id: companyId,
        user_id: ownerUserId,
        email: normalizedEmail,
        invited_email: normalizedEmail,
        role: 'owner',
        status: 'active',
      })

      // Also add the logged-in creator as an admin member so they can see the
      // new control in their list (getUserCompanies filters by user_id). Skip
      // when the creator IS the owner — that member was already linked above.
      const creator = pb.authStore.model as any
      const creatorId = creator?.id || ''
      const creatorEmail = (creator?.email || '').trim().toLowerCase()
      if (creatorId && creatorEmail && creatorEmail !== normalizedEmail) {
        await pb.collection('control_members').create({
          control_id: companyId,
          user_id: creatorId,
          email: creatorEmail,
          invited_email: creatorEmail,
          role: 'admin',
          status: 'active',
        })
      }

      // Seed default categories
      for (const c of DEFAULT_EXPENSE_CATEGORIES) {
        await pb.collection('categories').create({
          control_id: companyId,
          name: c.name,
          type: 'despesa',
          color: c.color,
          icon: c.icon,
          is_default: true,
        })
      }
      for (const c of DEFAULT_INCOME_CATEGORIES) {
        await pb.collection('categories').create({
          control_id: companyId,
          name: c.name,
          type: 'receita',
          color: c.color,
          icon: c.icon,
          is_default: true,
        })
      }

      // Create a starter account
      await pb.collection('accounts').create({
        control_id: companyId,
        name: 'Conta Principal',
        type: 'banco',
        balance: 0,
        color: color || '#6366F1',
        bank: 'Banco Principal',
      })

      const fresh = await pb.collection('financial_controls').getOne(companyId)
      return mapCompany(fresh)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async updateCompany(
    companyId: string,
    data: Partial<Pick<Company, 'name' | 'color' | 'description'>>,
  ): Promise<Company> {
    try {
      const payload: any = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.color !== undefined) payload.color = data.color
      if (data.description !== undefined) payload.description = data.description
      const r = await pb.collection('financial_controls').update(companyId, payload)
      return mapCompany(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async getCompanyStats(companyId: string): Promise<{
    membersCount: number
    balance: number
    income: number
    expense: number
    transactionsCount: number
  }> {
    try {
      // Lightweight payload: only fetch the fields we actually aggregate on.
      // membersCount comes from getList(1,1).totalItems (no rows serialized for
      // the full list), accounts/transactions only pull type+amount/balance.
      const [membersPage, accs, txs] = await Promise.all([
        pb.collection('control_members').getList(1, 1, {
          filter: `control_id="${companyId}" && status="active"`,
          // no expand / extra fields — we only need the count
        }),
        pb.collection('accounts').getFullList({
          filter: `control_id="${companyId}"`,
          fields: 'type,balance',
        }),
        pb.collection('transactions').getFullList({
          filter: `control_id="${companyId}"`,
          fields: 'type,amount,installment_number,installment_total',
        }),
      ])
      const balance = accs.reduce((acc: number, a: any) => {
        if (a.type === 'credito') return acc
        return acc + (Number(a.balance) || 0)
      }, 0)
      let income = 0
      let expense = 0
      let count = 0
      for (const t of txs as any[]) {
        // Ignorar registros pai de parcelamento (installment_number=0 e installment_total>0)
        const isParent =
          (Number(t.installment_number) === 0 || t.installment_number === undefined) &&
          Number(t.installment_total) > 0
        if (isParent) continue

        count++
        const amt = Number(t.amount) || 0
        if (t.type === 'receita') income += amt
        else if (t.type === 'despesa') expense += amt
      }
      return {
        membersCount: membersPage.totalItems,
        balance,
        income,
        expense,
        transactionsCount: count,
      }
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async deleteCompany(companyId: string): Promise<void> {
    try {
      await pb.collection('financial_controls').delete(companyId)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  // --- CONTROL MEMBERS ---
  async getCompanyMembers(companyId: string): Promise<CompanyMember[]> {
    try {
      const recs = await pb.collection('control_members').getFullList({
        filter: `control_id="${companyId}"`,
        expand: 'user_id',
      })
      return recs.map((r: any) => mapMember(r))
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async getUserRoleInCompany(companyId: string, userId: string): Promise<UserRole | null> {
    try {
      const r = await pb
        .collection('control_members')
        .getFirstListItem(`control_id="${companyId}" && user_id="${userId}" && status="active"`)
      return (r.role as UserRole) || null
    } catch {
      return null
    }
  }

  async inviteMember(companyId: string, email: string, role: UserRole): Promise<CompanyMember> {
    const normalized = email.trim().toLowerCase()
    try {
      // Already a member?
      try {
        const existing = await pb
          .collection('control_members')
          .getFirstListItem(`control_id="${companyId}" && email="${normalized}"`)
        if (existing) throw new Error('Este e-mail já está associado a este controle.')
      } catch (e: any) {
        if (e?.message?.includes('já está associado')) throw e
      }

      // Find existing user
      let userId = ''
      let status: 'active' | 'pending' = 'pending'
      const existingUser = await pb.collection('users').getList(1, 1, {
        filter: `email="${normalized}"`,
      })
      if (existingUser.items.length > 0) {
        userId = existingUser.items[0].id
        status = 'active'
      }

      const r = await pb.collection('control_members').create({
        control_id: companyId,
        user_id: userId,
        email: normalized,
        invited_email: normalized,
        role,
        status,
      })
      return mapMember(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async updateMemberRole(memberId: string, role: UserRole): Promise<CompanyMember> {
    try {
      // Prevent demoting the last owner
      const member = await pb.collection('control_members').getOne(memberId)
      if (member.role === 'owner' && role !== 'owner') {
        const owners = await pb.collection('control_members').getFullList({
          filter: `control_id="${member.control_id}" && role="owner" && status="active"`,
        })
        if (owners.length <= 1) {
          throw new Error('O controle deve possuir pelo menos um Proprietário.')
        }
      }
      const r = await pb.collection('control_members').update(memberId, { role })
      return mapMember(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async removeMember(memberId: string): Promise<void> {
    try {
      const member = await pb.collection('control_members').getOne(memberId)
      if (member.role === 'owner') {
        const owners = await pb.collection('control_members').getFullList({
          filter: `control_id="${member.control_id}" && role="owner" && status="active"`,
        })
        if (owners.length <= 1) {
          throw new Error('O último proprietário não pode ser removido do controle.')
        }
      }
      await pb.collection('control_members').delete(memberId)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  // --- ACCOUNTS ---
  async getAccounts(companyId: string): Promise<Account[]> {
    try {
      const recs = await pb.collection('accounts').getFullList({
        filter: `control_id="${companyId}"`,
        sort: '-created',
      })
      return recs.map(mapAccount)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async createAccount(
    companyId: string,
    data: {
      name: string
      type: AccountType
      balance: number
      limit?: number
      color: string
      bank?: string
    },
  ): Promise<Account> {
    try {
      const payload: any = {
        control_id: companyId,
        name: data.name.trim(),
        type: data.type,
        balance: Number(data.balance) || 0,
        color: data.color || '#6366F1',
        bank: data.bank?.trim() || '',
      }
      if (data.type === 'credito') {
        payload.limit = Number(data.limit) || 0
      }
      const r = await pb.collection('accounts').create(payload)
      return mapAccount(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async updateAccount(
    accountId: string,
    data: Partial<Omit<Account, 'id' | 'control_id' | 'created_at'>>,
  ): Promise<Account> {
    try {
      const payload: any = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.balance !== undefined) payload.balance = Number(data.balance) || 0
      if (data.color !== undefined) payload.color = data.color
      if (data.bank !== undefined) payload.bank = data.bank
      if (data.limit !== undefined) payload.limit = Number(data.limit) || 0
      const r = await pb.collection('accounts').update(accountId, payload)
      return mapAccount(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      const txs = await pb.collection('transactions').getFullList({
        filter: `account_id="${accountId}"`,
      })
      if (txs.length > 0) {
        throw new Error('Não é possível excluir uma conta que possui lançamentos vinculados.')
      }
      await pb.collection('accounts').delete(accountId)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  // --- CATEGORIES ---
  async getCategories(companyId: string): Promise<Category[]> {
    try {
      const recs = await pb.collection('categories').getFullList({
        filter: `control_id="${companyId}"`,
        sort: '-created',
      })
      return recs.map(mapCategory)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async createCategory(
    companyId: string,
    data: { name: string; type: TransactionType; color: string; icon: string },
  ): Promise<Category> {
    try {
      const r = await pb.collection('categories').create({
        control_id: companyId,
        name: data.name.trim(),
        type: data.type,
        color: data.color || '#6366F1',
        icon: data.icon || 'Tag',
        is_default: false,
      })
      return mapCategory(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async updateCategory(
    categoryId: string,
    data: Partial<Omit<Category, 'id' | 'control_id' | 'created_at'>>,
  ): Promise<Category> {
    try {
      const payload: any = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.color !== undefined) payload.color = data.color
      if (data.icon !== undefined) payload.icon = data.icon
      const r = await pb.collection('categories').update(categoryId, payload)
      return mapCategory(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    try {
      const txs = await pb.collection('transactions').getFullList({
        filter: `category_id="${categoryId}"`,
      })
      if (txs.length > 0) {
        throw new Error('Não é possível excluir uma categoria que possui lançamentos vinculados.')
      }
      await pb.collection('categories').delete(categoryId)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  // --- SUBCATEGORIES ---
  async getSubcategories(companyId: string, categoryId?: string): Promise<Subcategory[]> {
    try {
      const filter = categoryId
        ? `control_id="${companyId}" && category_id="${categoryId}"`
        : `control_id="${companyId}"`
      const recs = await pb.collection('subcategories').getFullList({
        filter,
        sort: 'name',
        expand: 'category_id',
      })
      return recs.map((r: any) => mapSubcategory(r))
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async createSubcategory(
    companyId: string,
    data: { category_id: string; name: string; color?: string; icon?: string },
  ): Promise<Subcategory> {
    try {
      const r = await pb.collection('subcategories').create({
        control_id: companyId,
        category_id: data.category_id,
        name: data.name.trim(),
        color: data.color?.trim() || '',
        icon: data.icon?.trim() || '',
      })
      return mapSubcategory(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async updateSubcategory(
    subcategoryId: string,
    data: Partial<Omit<Subcategory, 'id' | 'control_id' | 'created_at' | 'category'>>,
  ): Promise<Subcategory> {
    try {
      const payload: any = {}
      if (data.name !== undefined) payload.name = data.name.trim()
      if (data.category_id !== undefined) payload.category_id = data.category_id
      if (data.color !== undefined) payload.color = data.color.trim()
      if (data.icon !== undefined) payload.icon = data.icon.trim()
      const r = await pb.collection('subcategories').update(subcategoryId, payload)
      return mapSubcategory(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async deleteSubcategory(subcategoryId: string): Promise<void> {
    try {
      const txs = await pb.collection('transactions').getFullList({
        filter: `subcategory_id="${subcategoryId}"`,
      })
      if (txs.length > 0) {
        throw new Error(
          `Não é possível excluir esta subcategoria pois existem ${txs.length} lançamento(s) vinculado(s) a ela.`,
        )
      }
      await pb.collection('subcategories').delete(subcategoryId)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  // --- TRANSACTIONS ---
  async getTransactions(companyId: string): Promise<Transaction[]> {
    try {
      const [recs, accs, cats, mems, subcats] = await Promise.all([
        pb.collection('transactions').getFullList({
          filter: `control_id="${companyId}"`,
          sort: '-date,-created',
          expand: 'account_id,category_id,subcategory_id,user_id',
        }),
        pb.collection('accounts').getFullList({ filter: `control_id="${companyId}"` }),
        pb.collection('categories').getFullList({ filter: `control_id="${companyId}"` }),
        pb.collection('control_members').getFullList({
          filter: `control_id="${companyId}"`,
          expand: 'user_id',
        }),
        pb.collection('subcategories').getFullList({ filter: `control_id="${companyId}"` }),
      ])
      const accountsCache: Record<string, Account> = {}
      accs.forEach((a: any) => (accountsCache[a.id] = mapAccount(a)))
      const categoriesCache: Record<string, Category> = {}
      cats.forEach((c: any) => (categoriesCache[c.id] = mapCategory(c)))
      const subcategoriesCache: Record<string, Subcategory> = {}
      subcats.forEach((s: any) => (subcategoriesCache[s.id] = mapSubcategory(s, categoriesCache)))
      const usersCache: Record<string, User> = {}
      mems.forEach((m: any) => {
        if (m.user_id)
          usersCache[m.user_id] = mapMember(m).user || mapUser({ id: m.user_id, email: m.email })
      })
      const txs = recs.map((r: any) =>
        mapTransaction(r, accountsCache, categoriesCache, usersCache, subcategoriesCache),
      )
      // Sort by date desc (PocketBase sort may be string-based)
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      return txs
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  private applyBalanceDelta(account: Account, amount: number, type: TransactionType, sign: 1 | -1) {
    if (account.type === 'credito') {
      // credit card: despesa increases used limit, receita decreases
      account.balance += (type === 'despesa' ? amount : -amount) * sign
    } else {
      account.balance += (type === 'receita' ? amount : -amount) * sign
    }
  }

  async createTransaction(
    companyId: string,
    data: {
      account_id: string
      category_id: string
      subcategory_id?: string
      description: string
      amount: number
      type: TransactionType
      date: string
      is_recurring?: boolean
      recurrence_type?: any
      notes?: string
      responsible?: string
      installments_total?: number
    },
  ): Promise<Transaction> {
    const userId = (pb.authStore.model as any)?.id || ''
    const installmentsTotal = Math.max(1, Math.floor(Number(data.installments_total) || 1))

    const addMonths = (dateStr: string, months: number): string => {
      const d = new Date(dateStr + 'T00:00:00')
      const day = d.getDate()
      d.setMonth(d.getMonth() + months)
      const targetMonthLastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      if (day > targetMonthLastDay) d.setDate(targetMonthLastDay)
      return d.toISOString().split('T')[0]
    }

    try {
      if (installmentsTotal > 1) {
        const totalAmount = Number(data.amount)
        const baseAmount = Math.round((totalAmount / installmentsTotal) * 100) / 100
        const remainder = Math.round((totalAmount - baseAmount * installmentsTotal) * 100) / 100
        const baseDescription = data.description.trim()
        const baseDate = data.date
        let parentId = ''
        let first: Transaction | null = null

        for (let i = 1; i <= installmentsTotal; i++) {
          const parcelAmount =
            i === 1 ? Math.round((baseAmount + remainder) * 100) / 100 : baseAmount
          const payload: any = {
            control_id: companyId,
            user_id: userId,
            type: data.type,
            amount: parcelAmount,
            description: `${baseDescription} (${i}/${installmentsTotal})`,
            category_id: data.category_id || '',
            subcategory_id: data.subcategory_id || '',
            account_id: data.account_id,
            date: addMonths(baseDate, i - 1),
            paid: true,
            is_recurring: Boolean(data.is_recurring),
            recurrence_type: data.recurrence_type || '',
            installments_total: installmentsTotal,
            installment_number: i,
            notes: data.notes?.trim() || '',
            responsible: data.responsible?.trim() || '',
          }
          if (i !== 1) payload.parent_transaction_id = parentId
          const r = await pb.collection('transactions').create(payload)
          if (i === 1) {
            parentId = r.id
            // update own parent_transaction_id to self for consistency
            await pb.collection('transactions').update(r.id, { parent_transaction_id: parentId })
            r.parent_transaction_id = parentId
            first = mapTransaction(r)
          }
          // adjust account balance
          await this.adjustAccountBalance(data.account_id, parcelAmount, data.type, 1)
        }
        return first!
      }

      // Single transaction
      const payload: any = {
        control_id: companyId,
        user_id: userId,
        type: data.type,
        amount: Number(data.amount),
        description: data.description.trim(),
        category_id: data.category_id || '',
        subcategory_id: data.subcategory_id || '',
        account_id: data.account_id,
        date: data.date,
        paid: true,
        is_recurring: Boolean(data.is_recurring),
        recurrence_type: data.recurrence_type || '',
        installments_total: 1,
        installment_number: 1,
        notes: data.notes?.trim() || '',
        responsible: data.responsible?.trim() || '',
      }
      const r = await pb.collection('transactions').create(payload)
      const tx = mapTransaction(r)
      await this.adjustAccountBalance(data.account_id, Number(data.amount), data.type, 1)
      return tx
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  private async adjustAccountBalance(
    accountId: string,
    amount: number,
    type: TransactionType,
    sign: 1 | -1,
  ) {
    try {
      const acc = await pb.collection('accounts').getOne(accountId)
      const mapped = mapAccount(acc)
      this.applyBalanceDelta(mapped, amount, type, sign)
      await pb.collection('accounts').update(accountId, { balance: mapped.balance })
    } catch {
      // ignore balance update failures
    }
  }

  async updateTransaction(
    transactionId: string,
    data: Partial<Omit<Transaction, 'id' | 'control_id' | 'created_at' | 'user_id'>>,
  ): Promise<Transaction> {
    try {
      const existing = await pb.collection('transactions').getOne(transactionId)
      // Revert old balance
      await this.adjustAccountBalance(
        existing.account_id,
        Number(existing.amount),
        existing.type,
        -1,
      )
      const payload: any = {}
      if (data.account_id !== undefined) payload.account_id = data.account_id
      if (data.category_id !== undefined) payload.category_id = data.category_id || ''
      if (data.subcategory_id !== undefined) payload.subcategory_id = data.subcategory_id || ''
      if (data.description !== undefined) payload.description = data.description
      if (data.amount !== undefined) payload.amount = Number(data.amount)
      if (data.type !== undefined) payload.type = data.type
      if (data.date !== undefined) payload.date = data.date
      if (data.notes !== undefined) payload.notes = data.notes || ''
      if (data.responsible !== undefined) payload.responsible = data.responsible || ''
      if (data.is_recurring !== undefined) payload.is_recurring = data.is_recurring
      if (data.recurrence_type !== undefined) payload.recurrence_type = data.recurrence_type || ''
      const r = await pb.collection('transactions').update(transactionId, payload)
      const newAccId = r.account_id
      const newAmount = Number(r.amount)
      const newType = r.type
      await this.adjustAccountBalance(newAccId, newAmount, newType, 1)
      return mapTransaction(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    try {
      const tx = await pb.collection('transactions').getOne(transactionId)
      await this.adjustAccountBalance(tx.account_id, Number(tx.amount), tx.type, -1)
      await pb.collection('transactions').delete(transactionId)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  // Reset is not supported against the real backend; no-op kept for compat.
  async resetToSeed(): Promise<void> {
    // no-op: data lives in PocketBase now
  }
}

export const skipCloud = new SkipCloudService()
