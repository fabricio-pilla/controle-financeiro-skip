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
  AiLearning,
  AccountType,
  TransactionType,
  UserRole,
} from '@/types/database'
import pb from '@/lib/pocketbase/client'
import { resolvePaidStatus, isFutureDate } from '@/lib/formatters'

export const DEFAULT_CATEGORIES = [
  {
    name: 'Despesa Fabrício',
    type: 'despesa' as const,
    color: '#6366F1',
    icon: 'User',
    subcategories: [
      'Alimentação',
      'Celular',
      'Cuidados Pessoais',
      'Diversos',
      'Doações',
      'Educação',
      'Exercícios',
      'Lazer',
      'Medicamentos',
      'Médicos / Psicólogos',
      'Plano de Saúde',
      'Presentes',
      'Roupas e Acessórios',
      'Salão',
      'Seguros Individuais',
      'Trabalho',
      'Transporte',
    ],
  },
  {
    name: 'Receita Fabrício',
    type: 'receita' as const,
    color: '#6366F1',
    icon: 'TrendingUp',
    subcategories: ['IRPF', 'Outros', 'PLR', 'Salário', 'Vendas'],
  },
  {
    name: 'Despesa Raffaela',
    type: 'despesa' as const,
    color: '#EC4899',
    icon: 'User',
    subcategories: [
      'Alimentação',
      'Celular',
      'Cuidados Pessoais',
      'Diversos',
      'Doações',
      'Educação',
      'Exercícios',
      'Lazer',
      'Medicamentos',
      'Médicos / Psicólogos',
      'Plano de Saúde',
      'Presentes',
      'Roupas e Acessórios',
      'Salão',
      'Seguros Individuais',
      'Trabalho',
      'Transporte',
    ],
  },
  {
    name: 'Receita Raffaela',
    type: 'receita' as const,
    color: '#EC4899',
    icon: 'TrendingUp',
    subcategories: ['Salário', 'Outros', 'Corretagem'],
  },
  {
    name: 'Investimento',
    type: 'receita' as const,
    color: '#8B5CF6',
    icon: 'TrendingUp',
    subcategories: [
      'Emanuel',
      'Fabricio',
      'Helena',
      'Matheus',
      'Raffaela',
      'Viagens',
      'Empréstimo Franquia',
      'Empréstimo Ibi Marmore',
      'Financiamento Casa',
    ],
  },
  {
    name: 'Pets',
    type: 'despesa' as const,
    color: '#10B981',
    icon: 'PawPrint',
    subcategories: ['Banho', 'Medicamentos', 'Outros', 'Ração', 'Veterinário'],
  },
  {
    name: 'Transporte',
    type: 'despesa' as const,
    color: '#F59E0B',
    icon: 'Car',
    subcategories: [
      'Combustível',
      'Consorcio',
      'Diversos',
      'Estacionamento/Pedágio',
      'Impostos',
      'Lavagem',
      'Multas',
      'Revisão / Manutenção',
      'Seguro',
    ],
  },
  {
    name: 'Moradia',
    type: 'despesa' as const,
    color: '#EF4444',
    icon: 'Home',
    subcategories: [
      'Água',
      'Decoração / Utensílios',
      'Diarista',
      'Diversos',
      'Gás',
      'Internet',
      'Iptu',
      'Luz',
      'Manutenção',
      'Seguro',
    ],
  },
  {
    name: 'Emanuel',
    type: 'despesa' as const,
    color: '#3B82F6',
    icon: 'Baby',
    subcategories: [
      'Brinquedos / Livros',
      'Cuidados Pessoais',
      'Diversos',
      'Educação',
      'Exercícios',
      'Lazer',
      'Medicamentos',
      'Médicos / Psicólogos',
      'Pensão',
      'Plano de Saúde',
      'Roupas e Acessórios',
      'Salão',
      'Transporte',
    ],
  },
  {
    name: 'Família',
    type: 'despesa' as const,
    color: '#06B6D4',
    icon: 'Users',
    subcategories: [
      'Assinaturas',
      'Comemorações',
      'Farmácia',
      'Igreja',
      'Lavanderia',
      'Lazer',
      'Plano de Saúde',
      'Presentes',
      'Restaurantes / Delivery',
      'Supermercado',
      'Suplementos',
      'Viagens',
    ],
  },
  {
    name: 'Fast Escova',
    type: 'despesa' as const,
    color: '#F43F5E',
    icon: 'Scissors',
    subcategories: ['Alimentação', 'Implantação', 'Imposto', 'Pagamento de Contas', 'Viagens'],
  },
  {
    name: 'Helena',
    type: 'despesa' as const,
    color: '#A855F7',
    icon: 'Baby',
    subcategories: [
      'Alimentação',
      'Brinquedos / Livros',
      'Celular',
      'Cuidados Pessoais',
      'Diversos',
      'Educação',
      'Exercícios',
      'Lazer',
      'Medicamentos',
      'Médicos / Psicólogos',
      'Pensão',
      'Plano de Saúde',
      'Presentes',
      'Roupas e Acessórios',
      'Salão',
      'Seguros Individuais',
      'Transporte',
    ],
  },
  {
    name: 'Matheus',
    type: 'despesa' as const,
    color: '#14B8A6',
    icon: 'Baby',
    subcategories: [
      'Alimentação',
      'Brinquedos / Livros',
      'Celular',
      'Cuidados Pessoais',
      'Diversos',
      'Educação',
      'Exercícios',
      'Lazer',
      'Medicamentos',
      'Médicos / Psicólogos',
      'Plano de Saúde',
      'Presentes',
      'Roupas e Acessórios',
      'Salão',
      'Seguros Individuais',
      'Transporte',
    ],
  },
]

export const DEFAULT_EXPENSE_CATEGORIES = DEFAULT_CATEGORIES
export const DEFAULT_INCOME_CATEGORIES = DEFAULT_CATEGORIES

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
    due_day:
      r.due_day !== undefined && r.due_day !== null && r.due_day !== ''
        ? Number(r.due_day)
        : undefined,
    closing_day:
      r.closing_day !== undefined && r.closing_day !== null && r.closing_day !== ''
        ? Number(r.closing_day)
        : undefined,
    is_primary: Boolean(r.is_primary),
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

function mapAiLearning(
  r: any,
  categoriesCache?: Record<string, Category>,
  subcategoriesCache?: Record<string, Subcategory>,
): AiLearning {
  const aiCat = r.expand?.ai_category_id
    ? mapCategory(r.expand.ai_category_id)
    : categoriesCache?.[r.ai_category_id]
  const aiSubcat = r.expand?.ai_subcategory_id
    ? mapSubcategory(r.expand.ai_subcategory_id, categoriesCache)
    : subcategoriesCache?.[r.ai_subcategory_id]
  const corrCat = r.expand?.corrected_category_id
    ? mapCategory(r.expand.corrected_category_id)
    : categoriesCache?.[r.corrected_category_id]
  const corrSubcat = r.expand?.corrected_subcategory_id
    ? mapSubcategory(r.expand.corrected_subcategory_id, categoriesCache)
    : subcategoriesCache?.[r.corrected_subcategory_id]

  return {
    id: r.id,
    control_id: r.control_id || '',
    user_id: r.user_id || '',
    original_text: r.original_text || '',
    ai_category_id: r.ai_category_id || undefined,
    ai_subcategory_id: r.ai_subcategory_id || undefined,
    ai_type: (r.ai_type as TransactionType) || undefined,
    ai_description: r.ai_description || undefined,
    corrected_category_id: r.corrected_category_id || undefined,
    corrected_subcategory_id: r.corrected_subcategory_id || undefined,
    corrected_type: (r.corrected_type as TransactionType) || undefined,
    corrected_description: r.corrected_description || undefined,
    created_at: r.created || new Date().toISOString(),
    ai_category: aiCat,
    ai_subcategory: aiSubcat,
    corrected_category: corrCat,
    corrected_subcategory: corrSubcat,
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
  const dateStr = r.date ? String(r.date).split(/[T\s]/)[0] : new Date().toISOString().split('T')[0]
  const paymentDateStr = r.payment_date ? String(r.payment_date).split(/[T\s]/)[0] : undefined

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
    date: dateStr,
    payment_date: paymentDateStr || dateStr,
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

  const rawMsg = String(e?.message || e?.originalError?.message || '').toLowerCase()
  if (
    rawMsg.includes('failed to fetch') ||
    rawMsg.includes('network') ||
    rawMsg.includes('fetch failed') ||
    rawMsg.includes('networkerror')
  ) {
    return new Error(
      'Não foi possível salvar o lançamento — verifique sua conexão e tente novamente.',
    )
  }

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
  /**
   * Retorna SEMPRE o controle único principal da aplicação.
   * Prioridade: controle do usuário fabricio.pilla@gmail.com, ou o controle onde o usuário atual é membro,
   * ou o primeiro controle cadastrado no banco.
   */
  async getSingleCompany(userId?: string): Promise<Company | null> {
    try {
      // 1. Tentar localizar o controle principal (fabricio.pilla@gmail.com)
      try {
        const primaryByEmail = await pb.collection('financial_controls').getList(1, 1, {
          filter: `owner_email="fabricio.pilla@gmail.com"`,
        })
        if (primaryByEmail.items.length > 0) {
          return mapCompany(primaryByEmail.items[0])
        }
      } catch {
        // Fallback silencioso
      }

      // 2. Tentar pelo membership do usuário atual, se fornecido
      if (userId) {
        try {
          const members = await pb.collection('control_members').getList(1, 1, {
            filter: `user_id="${userId}" && status="active"`,
            sort: 'created',
          })
          if (members.items.length > 0 && members.items[0].control_id) {
            const comp = await pb
              .collection('financial_controls')
              .getOne(members.items[0].control_id)
            if (comp) return mapCompany(comp)
          }
        } catch {
          // Fallback silencioso
        }
      }

      // 3. Primeiro controle financeiro existente no banco
      const allControls = await pb.collection('financial_controls').getList(1, 1, {
        sort: 'created',
      })
      if (allControls.items.length > 0) {
        return mapCompany(allControls.items[0])
      }

      return null
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async getUserCompanies(userId: string): Promise<Company[]> {
    try {
      const single = await this.getSingleCompany(userId)
      return single ? [single] : []
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

      // Seed default categories and subcategories
      for (const c of DEFAULT_CATEGORIES) {
        const catRec = await pb.collection('categories').create({
          control_id: companyId,
          name: c.name,
          type: c.type || 'despesa',
          color: c.color,
          icon: c.icon,
          is_default: true,
        })
        for (const subName of c.subcategories) {
          await pb.collection('subcategories').create({
            control_id: companyId,
            category_id: catRec.id,
            name: subName,
          })
        }
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
      due_day?: number
      closing_day?: number
      is_primary?: boolean
    },
  ): Promise<Account> {
    try {
      // Apenas uma conta pode ser a principal: limpa o flag das demais antes.
      const isPrimary = Boolean(data.is_primary)
      if (isPrimary) {
        const primaries = await pb.collection('accounts').getFullList({
          filter: `control_id="${companyId}" && is_primary=true`,
        })
        for (const p of primaries) {
          await pb.collection('accounts').update(p.id, { is_primary: false })
        }
      }

      const payload: any = {
        control_id: companyId,
        name: data.name.trim(),
        type: data.type,
        balance: Number(data.balance) || 0,
        color: data.color || '#6366F1',
        bank: data.bank?.trim() || '',
        is_primary: isPrimary,
      }
      if (data.type === 'credito') {
        payload.limit = Number(data.limit) || 0
        payload.due_day =
          data.due_day !== undefined && data.due_day !== null
            ? Math.min(31, Math.max(1, Math.floor(Number(data.due_day) || 1)))
            : 0
        payload.closing_day =
          data.closing_day !== undefined && data.closing_day !== null
            ? Math.min(31, Math.max(1, Math.floor(Number(data.closing_day) || 1)))
            : 0
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
      const current = await pb.collection('accounts').getOne(accountId)
      const companyId = current.control_id || ''

      // Apenas uma conta pode ser a principal: limpa o flag das demais antes.
      if (data.is_primary === true && current.is_primary !== true) {
        const primaries = await pb.collection('accounts').getFullList({
          filter: `control_id="${companyId}" && is_primary=true`,
        })
        for (const p of primaries) {
          if (p.id !== accountId) {
            await pb.collection('accounts').update(p.id, { is_primary: false })
          }
        }
      }

      const payload: any = {}
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.balance !== undefined) payload.balance = Number(data.balance) || 0
      if (data.color !== undefined) payload.color = data.color
      if (data.bank !== undefined) payload.bank = data.bank
      if (data.limit !== undefined) payload.limit = Number(data.limit) || 0
      if (data.is_primary !== undefined) payload.is_primary = Boolean(data.is_primary)
      if (data.type === 'credito' || current.type === 'credito') {
        if (data.due_day !== undefined) {
          const v = Math.floor(Number(data.due_day) || 0)
          payload.due_day = v > 0 ? Math.min(31, Math.max(1, v)) : 0
        }
        if (data.closing_day !== undefined) {
          const v = Math.floor(Number(data.closing_day) || 0)
          payload.closing_day = v > 0 ? Math.min(31, Math.max(1, v)) : 0
        }
      }
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
        sort: 'name',
      })
      const mapped = recs.map(mapCategory)
      mapped.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      return mapped
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
      // 1. Check if category itself has any transactions linked
      const catTxs = await pb.collection('transactions').getFullList({
        filter: `category_id="${categoryId}"`,
      })
      if (catTxs.length > 0) {
        throw new Error(
          `Não é possível excluir esta categoria pois ela possui ${catTxs.length} lançamento(s) vinculado(s).`,
        )
      }

      // 2. Find all subcategories under this category
      const subcats = await pb.collection('subcategories').getFullList({
        filter: `category_id="${categoryId}"`,
      })

      // 3. Check if any of these subcategories have transactions linked
      if (subcats.length > 0) {
        const subFilter = subcats.map((s: any) => `subcategory_id="${s.id}"`).join(' || ')
        const subTxs = await pb.collection('transactions').getFullList({
          filter: subFilter,
        })
        if (subTxs.length > 0) {
          throw new Error(
            `Não é possível excluir esta categoria pois há ${subTxs.length} lançamento(s) vinculado(s) às suas subcategorias.`,
          )
        }

        // 4. Delete all linked subcategories
        for (const sub of subcats) {
          await pb.collection('subcategories').delete(sub.id)
        }
      }

      // 5. Delete the category itself
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
      const mapped = recs.map((r: any) => mapSubcategory(r))
      mapped.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      return mapped
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
      payment_date?: string
      paid?: boolean
      is_recurring?: boolean
      recurrence_type?: any
      notes?: string
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
      const basePaymentDate = data.payment_date || data.date
      const desiredPaid = data.paid !== undefined ? Boolean(data.paid) : true

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
          const parcelPaymentDate = addMonths(basePaymentDate, i - 1)
          const parcelPaid = resolvePaidStatus(parcelPaymentDate, i === 1 ? desiredPaid : false)

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
            payment_date: parcelPaymentDate,
            paid: parcelPaid,
            is_recurring: Boolean(data.is_recurring),
            recurrence_type: data.recurrence_type || '',
            installments_total: installmentsTotal,
            installment_number: i,
            notes: data.notes?.trim() || '',
          }
          if (i !== 1) payload.parent_transaction_id = parentId
          const { executeWithRetry } = await import('@/lib/pocketbase/retry')
          const r = await executeWithRetry(
            () => pb.collection('transactions').create(payload),
            3,
            400,
            'CREATE_PARCEL',
          )
          if (i === 1) {
            parentId = r.id
            // Root installment does not reference itself to avoid self-parenting cycles
            r.parent_transaction_id = ''
            first = mapTransaction(r)
          }
          // adjust account balance
          await this.adjustAccountBalance(data.account_id, parcelAmount, data.type, 1)
        }
        return first!
      }

      // Single transaction
      const isRec = Boolean(data.is_recurring)
      const singlePaid = resolvePaidStatus(basePaymentDate, desiredPaid)

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
        payment_date: basePaymentDate,
        paid: singlePaid,
        is_recurring: isRec,
        recurring: isRec,
        recurrence_type: isRec ? data.recurrence_type || 'mensal' : '',
        recurrence_period: isRec ? data.recurrence_type || 'mensal' : '',
        installments_total: isRec ? 0 : 1,
        installment_number: 1,
        parent_transaction_id: '',
        notes: data.notes?.trim() || '',
      }
      const { executeWithRetry } = await import('@/lib/pocketbase/retry')
      const r = await executeWithRetry(
        () => pb.collection('transactions').create(payload),
        3,
        400,
        'CREATE_TX',
      )
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
    skipBalanceUpdate = false,
  ): Promise<Transaction> {
    try {
      let existing: any = null
      if (!skipBalanceUpdate) {
        existing = await pb.collection('transactions').getOne(transactionId)
        // Revert old balance
        await this.adjustAccountBalance(
          existing.account_id,
          Number(existing.amount),
          existing.type,
          -1,
        )
      }
      const payload: any = {}
      if (data.account_id !== undefined) payload.account_id = data.account_id
      if (data.category_id !== undefined) payload.category_id = data.category_id || ''
      if (data.subcategory_id !== undefined) payload.subcategory_id = data.subcategory_id || ''
      if (data.description !== undefined) payload.description = data.description
      if (data.amount !== undefined) payload.amount = Number(data.amount)
      if (data.type !== undefined) payload.type = data.type
      if (data.date !== undefined) payload.date = data.date
      if (data.payment_date !== undefined) payload.payment_date = data.payment_date
      if (data.notes !== undefined) payload.notes = data.notes || ''
      if (data.is_recurring !== undefined) {
        payload.is_recurring = data.is_recurring
        payload.recurring = data.is_recurring
      }
      if (data.recurrence_type !== undefined) payload.recurrence_type = data.recurrence_type || ''
      if (data.paid !== undefined) {
        payload.paid = data.paid
      }
      // Se a data de pagamento informada (ou já existente) for futura, forçar paid: false
      const effectivePaymentDateForUpdate =
        payload.payment_date !== undefined
          ? payload.payment_date
          : existing?.payment_date || existing?.date
      if (isFutureDate(effectivePaymentDateForUpdate)) {
        payload.paid = false
      }
      if (data.parent_transaction_id !== undefined)
        payload.parent_transaction_id = data.parent_transaction_id
      if (data.installment_number !== undefined)
        payload.installment_number = data.installment_number
      if (data.installments_total !== undefined) payload.installment_total = data.installments_total

      const r = await pb.collection('transactions').update(transactionId, payload)
      if (!skipBalanceUpdate) {
        const newAccId = r.account_id
        const newAmount = Number(r.amount)
        const newType = r.type
        await this.adjustAccountBalance(newAccId, newAmount, newType, 1)
      }
      return mapTransaction(r)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  async deleteTransaction(transactionId: string, skipBalanceUpdate = false): Promise<void> {
    try {
      if (!skipBalanceUpdate) {
        const tx = await pb.collection('transactions').getOne(transactionId)
        await this.adjustAccountBalance(tx.account_id, Number(tx.amount), tx.type, -1)
      }
      await pb.collection('transactions').delete(transactionId)
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  /**
   * Recalculates and persists accounts balances for the given account IDs based on current transactions in PB.
   */
  async recomputeAccountsBalances(accountIds: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)))
    if (!uniqueIds.length) return
    try {
      for (const accId of uniqueIds) {
        const [acc, txs] = await Promise.all([
          pb.collection('accounts').getOne(accId),
          pb.collection('transactions').getFullList({
            filter: `account_id="${accId}"`,
            fields: 'amount,type,installment_number,installment_total',
          }),
        ])
        const mapped = mapAccount(acc)
        let calcBalance = 0
        for (const t of txs as any[]) {
          // Ignorar registros pai consolidados de parcelamento (installment_number=0 e installment_total>0)
          const isParent =
            (Number(t.installment_number) === 0 || t.installment_number === undefined) &&
            Number(t.installment_total) > 0
          if (isParent) continue

          const amt = Number(t.amount) || 0
          const tType = t.type as TransactionType
          if (mapped.type === 'credito') {
            calcBalance += tType === 'despesa' ? amt : -amt
          } else {
            calcBalance += tType === 'receita' ? amt : -amt
          }
        }
        calcBalance = Math.round(calcBalance * 100) / 100
        await pb.collection('accounts').update(accId, { balance: calcBalance })
      }
    } catch (e) {
      console.warn('[recomputeAccountsBalances] Failed to sync account balance:', e)
    }
  }

  async setTransactionsPaidStatus(transactionIds: string[], paid: boolean): Promise<Transaction[]> {
    try {
      if (!transactionIds.length) return []
      const { runInPool } = await import('@/lib/pocketbase/retry')
      const updatedRecords = await runInPool(
        transactionIds,
        async (id) => {
          const rec = await pb.collection('transactions').update(id, { paid })
          return mapTransaction(rec)
        },
        { concurrency: 4, delayBetweenBatchesMs: 20, tag: 'SET_PAID_STATUS' },
      )
      return updatedRecords
    } catch (e: any) {
      throw pbErr(e)
    }
  }

  // --- AI LEARNINGS ---
  async getAiLearnings(companyId: string): Promise<AiLearning[]> {
    try {
      const recs = await pb.collection('ai_learnings').getFullList({
        filter: `control_id="${companyId}"`,
        sort: '-created',
        expand: 'ai_category_id,ai_subcategory_id,corrected_category_id,corrected_subcategory_id',
      })
      return recs.map((r: any) => mapAiLearning(r))
    } catch {
      return []
    }
  }

  async saveAiLearning(
    companyId: string,
    data: {
      original_text: string
      ai_category_id?: string
      ai_subcategory_id?: string
      ai_type?: TransactionType
      ai_description?: string
      corrected_category_id?: string
      corrected_subcategory_id?: string
      corrected_type?: TransactionType
      corrected_description?: string
    },
  ): Promise<AiLearning | null> {
    const userId = (pb.authStore.model as any)?.id || ''
    const normText = data.original_text.trim().toLowerCase()
    if (!normText) return null

    try {
      const { executeWithRetry } = await import('@/lib/pocketbase/retry')

      // Verificar se já existe registro com o mesmo texto original para este controle/usuário
      const existingList = await executeWithRetry(
        () =>
          pb.collection('ai_learnings').getList(1, 10, {
            filter: `control_id="${companyId}"`,
          }),
        2,
        300,
        'CHECK_AI_LEARNING',
      )

      const existing = existingList.items.find(
        (item: any) => (item.original_text || '').trim().toLowerCase() === normText,
      )

      const payload: any = {
        control_id: companyId,
        user_id: userId,
        original_text: data.original_text.trim(),
        ai_category_id: data.ai_category_id || '',
        ai_subcategory_id: data.ai_subcategory_id || '',
        ai_type: data.ai_type || '',
        ai_description: data.ai_description?.trim() || '',
        corrected_category_id: data.corrected_category_id || '',
        corrected_subcategory_id: data.corrected_subcategory_id || '',
        corrected_type: data.corrected_type || '',
        corrected_description: data.corrected_description?.trim() || '',
      }

      if (existing) {
        // Se a correção já for idêntica, não duplica nem regrava
        const sameCat =
          (existing.corrected_category_id || '') === (payload.corrected_category_id || '')
        const sameSub =
          (existing.corrected_subcategory_id || '') === (payload.corrected_subcategory_id || '')
        const sameType = (existing.corrected_type || '') === (payload.corrected_type || '')
        const sameDesc =
          (existing.corrected_description || '').trim() ===
          (payload.corrected_description || '').trim()

        if (sameCat && sameSub && sameType && sameDesc) {
          return mapAiLearning(existing)
        }

        // Se a correção mudou, atualiza o registro existente
        const updated = await executeWithRetry(
          () => pb.collection('ai_learnings').update(existing.id, payload),
          3,
          400,
          'UPDATE_AI_LEARNING',
        )
        return mapAiLearning(updated)
      }

      const created = await executeWithRetry(
        () => pb.collection('ai_learnings').create(payload),
        3,
        400,
        'CREATE_AI_LEARNING',
      )
      return mapAiLearning(created)
    } catch {
      // Falha silenciosa para não quebrar fluxos
      return null
    }
  }

  async deleteAiLearning(learningId: string): Promise<boolean> {
    try {
      const { executeWithRetry } = await import('@/lib/pocketbase/retry')
      await executeWithRetry(
        () => pb.collection('ai_learnings').delete(learningId),
        3,
        400,
        'DELETE_AI_LEARNING',
      )
      return true
    } catch {
      return false
    }
  }

  // Reset is not supported against the real backend; no-op kept for compat.
  async resetToSeed(): Promise<void> {
    // no-op: data lives in PocketBase now
  }
}

export const skipCloud = new SkipCloudService()
