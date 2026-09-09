export type UserRole = 'owner' | 'admin' | 'member'
export type MemberStatus = 'active' | 'pending'
export type AccountType = 'carteira' | 'banco' | 'pix' | 'credito' | 'investimento'
export type TransactionType = 'receita' | 'despesa'
export type RecurrenceType = 'mensal' | 'semanal' | 'anual'

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  created_at: string
}

export interface Company {
  id: string
  name: string
  color: string
  description?: string
  created_at: string
  owner_id: string
  owner_email?: string
}

export interface CompanyMember {
  id: string
  control_id: string
  user_id: string
  role: UserRole
  status: MemberStatus
  email?: string
  invited_email?: string
  created_at: string
  // Populated fields for UI
  user?: User
}

export interface Account {
  id: string
  control_id: string
  name: string
  type: AccountType
  balance: number
  limit?: number // for credit cards
  color: string
  bank?: string
  due_day?: number // dia do mês do vencimento da fatura (cartões de crédito, 1-31)
  closing_day?: number // dia do mês do fechamento da fatura (cartões de crédito, 1-31)
  is_primary?: boolean // conta principal/padrão do controle
  created_at: string
}

export interface Category {
  id: string
  control_id: string
  name: string
  type: TransactionType
  color: string
  icon: string
  is_default?: boolean
  created_at: string
}

export interface Subcategory {
  id: string
  control_id: string
  category_id: string
  name: string
  color?: string
  icon?: string
  created_at: string
  // Populated for UI
  category?: Category
}

export interface Transaction {
  id: string
  control_id: string
  account_id: string
  category_id: string
  subcategory_id?: string
  user_id: string
  description: string
  amount: number
  type: TransactionType
  date: string // YYYY-MM-DD (Data da Compra)
  payment_date?: string // YYYY-MM-DD (Data de Pagamento / Vencimento na fatura)
  is_recurring?: boolean
  recurring?: boolean
  paid?: boolean
  recurrence_type?: RecurrenceType
  installments_total?: number
  installment_total?: number
  installment_number?: number
  parent_transaction_id?: string
  notes?: string
  created_at: string
  // Populated for UI display
  account?: Account
  category?: Category
  subcategory?: Subcategory
  user?: User
}

export interface CompanyPreferences {
  currency: string
  dateFormat: string
  theme: 'light' | 'dark' | 'system'
  emailNotifications: boolean
}
