export type UserRole = 'owner' | 'admin' | 'member'
export type MemberStatus = 'active' | 'pending'
export type AccountType = 'carteira' | 'banco' | 'pix' | 'credito' | 'investimento'
export type TransactionType = 'receita' | 'despesa'
export type SegmentType = 'Serviços' | 'Comércio' | 'Indústria' | 'Tecnologia' | 'Outro'
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
  cnpj?: string
  segment: SegmentType
  color: string
  created_at: string
  owner_id: string
}

export interface CompanyMember {
  id: string
  company_id: string
  user_id: string
  role: UserRole
  status: MemberStatus
  invited_email?: string
  created_at: string
  // Populated fields for UI
  user?: User
}

export interface Account {
  id: string
  company_id: string
  name: string
  type: AccountType
  balance: number
  limit?: number // for credit cards
  color: string
  bank?: string
  created_at: string
}

export interface Category {
  id: string
  company_id: string
  name: string
  type: TransactionType
  color: string
  icon: string
  created_at: string
}

export interface Transaction {
  id: string
  company_id: string
  account_id: string
  category_id: string
  user_id: string
  description: string
  amount: number
  type: TransactionType
  date: string // YYYY-MM-DD
  is_recurring?: boolean
  recurrence_type?: RecurrenceType
  installments_total?: number
  installment_number?: number
  parent_transaction_id?: string
  notes?: string
  created_at: string
  // Populated for UI display
  account?: Account
  category?: Category
  user?: User
}

export interface CompanyPreferences {
  currency: string
  dateFormat: string
  theme: 'light' | 'dark' | 'system'
  emailNotifications: boolean
}
