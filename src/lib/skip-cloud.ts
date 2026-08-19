import {
  User,
  Company,
  CompanyMember,
  Account,
  Category,
  Transaction,
  SegmentType,
  AccountType,
  TransactionType,
  UserRole,
} from '@/types/database'

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Aluguel', color: '#EF4444', icon: 'Home' },
  { name: 'Salários', color: '#F97316', icon: 'Users' },
  { name: 'Fornecedores', color: '#F59E0B', icon: 'Truck' },
  { name: 'Marketing', color: '#EC4899', icon: 'Megaphone' },
  { name: 'Impostos', color: '#8B5CF6', icon: 'Receipt' },
  { name: 'Transporte', color: '#06B6D4', icon: 'Car' },
  { name: 'Material de escritório', color: '#6366F1', icon: 'FileText' },
  { name: 'Utilidades', color: '#10B981', icon: 'Zap' },
  { name: 'Outros', color: '#64748B', icon: 'MoreHorizontal' },
]

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Vendas', color: '#10B981', icon: 'ShoppingBag' },
  { name: 'Serviços', color: '#06B6D4', icon: 'Briefcase' },
  { name: 'Investimentos', color: '#8B5CF6', icon: 'TrendingUp' },
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

// Initial seed users
const SEED_USERS: User[] = [
  {
    id: 'user-carlos-1',
    name: 'Carlos Henrique',
    email: 'carlos@empresa.com.br',
    avatar: 'https://img.usecurling.com/ppl/medium?gender=male&seed=1',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  },
  {
    id: 'user-marina-2',
    name: 'Marina Silveira',
    email: 'marina@empresa.com.br',
    avatar: 'https://img.usecurling.com/ppl/medium?gender=female&seed=2',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 70).toISOString(),
  },
  {
    id: 'user-lucas-3',
    name: 'Lucas Ferreira',
    email: 'lucas@empresa.com.br',
    avatar: 'https://img.usecurling.com/ppl/medium?gender=male&seed=3',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 50).toISOString(),
  },
]

// Initial companies
const SEED_COMPANIES: Company[] = [
  {
    id: 'comp-tech-1',
    name: 'Nexus Soluções Digitais',
    cnpj: '12.345.678/0001-90',
    segment: 'Tecnologia',
    color: '#6366F1',
    description:
      'Software house especializada em desenvolvimento de plataformas digitais, aplicativos e infraestrutura cloud para fintechs e e-commerce.',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    owner_id: 'user-carlos-1',
  },
  {
    id: 'comp-varejo-2',
    name: 'Aurora Comércio & Design',
    cnpj: '98.765.432/0001-11',
    segment: 'Varejo',
    color: '#10B981',
    description:
      'Loja de mobiliário planejado e artigos de decoração com showroom físico, atuando no varejo de design de interiores e ambientação sob medida.',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    owner_id: 'user-carlos-1',
  },
]

// Memberships
const SEED_MEMBERS: CompanyMember[] = [
  {
    id: 'mem-1',
    company_id: 'comp-tech-1',
    user_id: 'user-carlos-1',
    role: 'owner',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  },
  {
    id: 'mem-2',
    company_id: 'comp-tech-1',
    user_id: 'user-marina-2',
    role: 'admin',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 70).toISOString(),
  },
  {
    id: 'mem-3',
    company_id: 'comp-tech-1',
    user_id: 'user-lucas-3',
    role: 'member',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 50).toISOString(),
  },
  {
    id: 'mem-4',
    company_id: 'comp-varejo-2',
    user_id: 'user-carlos-1',
    role: 'owner',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    id: 'mem-5',
    company_id: 'comp-varejo-2',
    user_id: 'user-marina-2',
    role: 'member',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
  },
  {
    id: 'mem-6',
    company_id: 'comp-varejo-2',
    user_id: 'user-lucas-3',
    role: 'admin',
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
]

// Accounts
const SEED_ACCOUNTS: Account[] = [
  {
    id: 'acc-tech-1',
    company_id: 'comp-tech-1',
    name: 'Banco Itaú PJ',
    type: 'banco',
    balance: 84520.5,
    color: '#F97316',
    bank: 'Itaú Unibanco',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
  },
  {
    id: 'acc-tech-2',
    company_id: 'comp-tech-1',
    name: 'Nubank PJ / Pix',
    type: 'pix',
    balance: 29400.0,
    color: '#8B5CF6',
    bank: 'Nubank',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 85).toISOString(),
  },
  {
    id: 'acc-tech-3',
    company_id: 'comp-tech-1',
    name: 'Cartão Corporativo XP',
    type: 'credito',
    balance: 14280.0, // Used limit
    limit: 50000.0,
    color: '#06B6D4',
    bank: 'XP Investimentos',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 80).toISOString(),
  },
  {
    id: 'acc-tech-4',
    company_id: 'comp-tech-1',
    name: 'Reserva Selic 100%',
    type: 'investimento',
    balance: 150000.0,
    color: '#10B981',
    bank: 'BTG Pactual',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 70).toISOString(),
  },
  {
    id: 'acc-varejo-1',
    company_id: 'comp-varejo-2',
    name: 'Bradesco Comercial',
    type: 'banco',
    balance: 42100.0,
    color: '#EF4444',
    bank: 'Banco Bradesco',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    id: 'acc-varejo-2',
    company_id: 'comp-varejo-2',
    name: 'Caixa da Loja Física',
    type: 'carteira',
    balance: 3850.0,
    color: '#10B981',
    bank: 'Caixa Interno',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 55).toISOString(),
  },
]

// Generate default categories for the seed companies
function generateCategoriesForCompany(companyId: string): Category[] {
  const cats: Category[] = []
  let idx = 1
  DEFAULT_EXPENSE_CATEGORIES.forEach((item) => {
    cats.push({
      id: `cat-${companyId}-exp-${idx++}`,
      company_id: companyId,
      name: item.name,
      type: 'despesa',
      color: item.color,
      icon: item.icon,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    })
  })
  DEFAULT_INCOME_CATEGORIES.forEach((item) => {
    cats.push({
      id: `cat-${companyId}-inc-${idx++}`,
      company_id: companyId,
      name: item.name,
      type: 'receita',
      color: item.color,
      icon: item.icon,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    })
  })
  return cats
}

const SEED_CATEGORIES: Category[] = [
  ...generateCategoriesForCompany('comp-tech-1'),
  ...generateCategoriesForCompany('comp-varejo-2'),
]

// Generate rich 3-month transactions for comp-tech-1 and comp-varejo-2
function generateSeedTransactions(): Transaction[] {
  const transactions: Transaction[] = []
  const now = new Date()

  // Helper date
  const getDateStr = (daysAgo: number) => {
    const d = new Date(now.getTime() - 1000 * 60 * 60 * 24 * daysAgo)
    return d.toISOString().split('T')[0]
  }

  // Transactions for Nexus Soluções Digitais (comp-tech-1)
  const techData = [
    // Month 1 (current)
    {
      desc: 'Contrato Mensal - Fintech Alfa',
      amt: 32000,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-tech-1',
      days: 2,
      user: 'user-carlos-1',
    },
    {
      desc: 'Desenvolvimento App Mobile - Beta Corp',
      amt: 45000,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-tech-2',
      days: 5,
      user: 'user-marina-2',
    },
    {
      desc: 'Folha de Pagamento - Equipe Dev',
      amt: 28500,
      type: 'despesa',
      cat: 'Salários',
      acc: 'acc-tech-1',
      days: 6,
      user: 'user-carlos-1',
    },
    {
      desc: 'Aluguel Escritório Coworking',
      amt: 5200,
      type: 'despesa',
      cat: 'Aluguel',
      acc: 'acc-tech-1',
      days: 8,
      user: 'user-carlos-1',
    },
    {
      desc: 'Servidores AWS & Cloud Computing',
      amt: 4320.5,
      type: 'despesa',
      cat: 'Utilidades',
      acc: 'acc-tech-3',
      days: 10,
      user: 'user-marina-2',
    },
    {
      desc: 'Campanha Google Ads & LinkedIn Ads',
      amt: 6800,
      type: 'despesa',
      cat: 'Marketing',
      acc: 'acc-tech-3',
      days: 12,
      user: 'user-lucas-3',
    },
    {
      desc: 'Consultoria de Arquitetura Cloud',
      amt: 18500,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-tech-2',
      days: 14,
      user: 'user-carlos-1',
    },
    {
      desc: 'Licenças Software JetBrains & Figma',
      amt: 1890,
      type: 'despesa',
      cat: 'Material de escritório',
      acc: 'acc-tech-3',
      days: 15,
      user: 'user-lucas-3',
    },
    {
      desc: 'Impostos Federais DAS / Simples Nacional',
      amt: 7900,
      type: 'despesa',
      cat: 'Impostos',
      acc: 'acc-tech-1',
      days: 18,
      user: 'user-marina-2',
    },
    {
      desc: 'Rendimentos Aplicação CDI',
      amt: 1650,
      type: 'receita',
      cat: 'Investimentos',
      acc: 'acc-tech-4',
      days: 20,
      user: 'user-carlos-1',
    },
    {
      desc: 'Viagem técnica visita cliente SP',
      amt: 1450,
      type: 'despesa',
      cat: 'Transporte',
      acc: 'acc-tech-3',
      days: 22,
      user: 'user-lucas-3',
    },
    {
      desc: 'Contrato Manutenção de Sistemas',
      amt: 15000,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-tech-1',
      days: 25,
      user: 'user-marina-2',
    },
    {
      desc: 'Honorários Contabilidade Externa',
      amt: 2100,
      type: 'despesa',
      cat: 'Fornecedores',
      acc: 'acc-tech-1',
      days: 27,
      user: 'user-carlos-1',
    },

    // Month 2 (previous month)
    {
      desc: 'Contrato Mensal - Fintech Alfa',
      amt: 32000,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-tech-1',
      days: 32,
      user: 'user-carlos-1',
    },
    {
      desc: 'Entrega Projeto E-commerce Prime',
      amt: 38000,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-tech-2',
      days: 35,
      user: 'user-marina-2',
    },
    {
      desc: 'Folha de Pagamento - Equipe Dev',
      amt: 28500,
      type: 'despesa',
      cat: 'Salários',
      acc: 'acc-tech-1',
      days: 36,
      user: 'user-carlos-1',
    },
    {
      desc: 'Aluguel Escritório Coworking',
      amt: 5200,
      type: 'despesa',
      cat: 'Aluguel',
      acc: 'acc-tech-1',
      days: 38,
      user: 'user-carlos-1',
    },
    {
      desc: 'Servidores AWS & Cloud Computing',
      amt: 4100,
      type: 'despesa',
      cat: 'Utilidades',
      acc: 'acc-tech-3',
      days: 40,
      user: 'user-marina-2',
    },
    {
      desc: 'Campanha Tráfego Pago',
      amt: 5500,
      type: 'despesa',
      cat: 'Marketing',
      acc: 'acc-tech-3',
      days: 43,
      user: 'user-lucas-3',
    },
    {
      desc: 'Impostos Federais DAS',
      amt: 6800,
      type: 'despesa',
      cat: 'Impostos',
      acc: 'acc-tech-1',
      days: 48,
      user: 'user-marina-2',
    },
    {
      desc: 'Rendimentos Aplicação CDI',
      amt: 1580,
      type: 'receita',
      cat: 'Investimentos',
      acc: 'acc-tech-4',
      days: 50,
      user: 'user-carlos-1',
    },

    // Month 3 (two months ago)
    {
      desc: 'Contrato Mensal - Fintech Alfa',
      amt: 32000,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-tech-1',
      days: 62,
      user: 'user-carlos-1',
    },
    {
      desc: 'Auditoria de Segurança da Informação',
      amt: 22000,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-tech-2',
      days: 65,
      user: 'user-marina-2',
    },
    {
      desc: 'Folha de Pagamento - Equipe Dev',
      amt: 26000,
      type: 'despesa',
      cat: 'Salários',
      acc: 'acc-tech-1',
      days: 66,
      user: 'user-carlos-1',
    },
    {
      desc: 'Aluguel Escritório Coworking',
      amt: 5200,
      type: 'despesa',
      cat: 'Aluguel',
      acc: 'acc-tech-1',
      days: 68,
      user: 'user-carlos-1',
    },
    {
      desc: 'Servidores AWS & Cloud Computing',
      amt: 3950,
      type: 'despesa',
      cat: 'Utilidades',
      acc: 'acc-tech-3',
      days: 70,
      user: 'user-marina-2',
    },
    {
      desc: 'Rendimentos Aplicação CDI',
      amt: 1520,
      type: 'receita',
      cat: 'Investimentos',
      acc: 'acc-tech-4',
      days: 80,
      user: 'user-carlos-1',
    },
  ]

  let tId = 1
  techData.forEach((item) => {
    const catObj = SEED_CATEGORIES.find(
      (c) => c.company_id === 'comp-tech-1' && c.name === item.cat && c.type === item.type,
    )
    transactions.push({
      id: `tx-tech-${tId++}`,
      company_id: 'comp-tech-1',
      account_id: item.acc,
      category_id: catObj ? catObj.id : 'cat-comp-tech-1-inc-1',
      user_id: item.user,
      description: item.desc,
      amount: item.amt,
      type: item.type as TransactionType,
      date: getDateStr(item.days),
      is_recurring: item.desc.includes('Aluguel') || item.desc.includes('Contrato Mensal'),
      recurrence_type:
        item.desc.includes('Aluguel') || item.desc.includes('Contrato Mensal')
          ? 'mensal'
          : undefined,
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * item.days).toISOString(),
    })
  })

  // Transactions for Aurora Comércio & Design (comp-varejo-2)
  const varejoData = [
    // Month 1 (current)
    {
      desc: 'Venda de Mobiliário Planejado Loja A',
      amt: 18400,
      type: 'receita',
      cat: 'Vendas',
      acc: 'acc-varejo-1',
      days: 3,
      user: 'user-carlos-1',
    },
    {
      desc: 'Venda de Luminárias e Decoração',
      amt: 7300,
      type: 'receita',
      cat: 'Vendas',
      acc: 'acc-varejo-2',
      days: 5,
      user: 'user-marina-2',
    },
    {
      desc: 'Fornecedor de Madeiras e Acabamentos',
      amt: 9200,
      type: 'despesa',
      cat: 'Fornecedores',
      acc: 'acc-varejo-1',
      days: 7,
      user: 'user-carlos-1',
    },
    {
      desc: 'Aluguel do Showroom Comercial',
      amt: 6500,
      type: 'despesa',
      cat: 'Aluguel',
      acc: 'acc-varejo-1',
      days: 9,
      user: 'user-carlos-1',
    },
    {
      desc: 'Salários dos Vendedores e Montadores',
      amt: 14200,
      type: 'despesa',
      cat: 'Salários',
      acc: 'acc-varejo-1',
      days: 11,
      user: 'user-carlos-1',
    },
    {
      desc: 'Consultoria de Ambientação e Design',
      amt: 8500,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-varejo-1',
      days: 15,
      user: 'user-marina-2',
    },
    {
      desc: 'Taxas de Maquininha de Cartão e Fretes',
      amt: 1250,
      type: 'despesa',
      cat: 'Transporte',
      acc: 'acc-varejo-1',
      days: 19,
      user: 'user-marina-2',
    },
    {
      desc: 'Anúncios em Redes Sociais e Catálogo',
      amt: 3200,
      type: 'despesa',
      cat: 'Marketing',
      acc: 'acc-varejo-1',
      days: 24,
      user: 'user-carlos-1',
    },
    // Month 2 (previous month)
    {
      desc: 'Venda de Mobiliário Planejado Loja A',
      amt: 16800,
      type: 'receita',
      cat: 'Vendas',
      acc: 'acc-varejo-1',
      days: 33,
      user: 'user-carlos-1',
    },
    {
      desc: 'Projeto de Decoração Corporativo',
      amt: 12400,
      type: 'receita',
      cat: 'Serviços',
      acc: 'acc-varejo-1',
      days: 36,
      user: 'user-lucas-3',
    },
    {
      desc: 'Fornecedor de Tecidos e Estofados',
      amt: 6800,
      type: 'despesa',
      cat: 'Fornecedores',
      acc: 'acc-varejo-1',
      days: 38,
      user: 'user-carlos-1',
    },
    {
      desc: 'Aluguel do Showroom Comercial',
      amt: 6500,
      type: 'despesa',
      cat: 'Aluguel',
      acc: 'acc-varejo-1',
      days: 39,
      user: 'user-carlos-1',
    },
    {
      desc: 'Salários dos Vendedores e Montadores',
      amt: 13200,
      type: 'despesa',
      cat: 'Salários',
      acc: 'acc-varejo-1',
      days: 41,
      user: 'user-carlos-1',
    },
    {
      desc: 'Campanha de Marketing Digital',
      amt: 2800,
      type: 'despesa',
      cat: 'Marketing',
      acc: 'acc-varejo-1',
      days: 45,
      user: 'user-lucas-3',
    },
    {
      desc: 'Material de Escritório e Embalagens',
      amt: 980,
      type: 'despesa',
      cat: 'Material de escritório',
      acc: 'acc-varejo-1',
      days: 48,
      user: 'user-marina-2',
    },
    // Month 3 (two months ago)
    {
      desc: 'Venda de Mobiliário Planejado Loja A',
      amt: 15200,
      type: 'receita',
      cat: 'Vendas',
      acc: 'acc-varejo-1',
      days: 63,
      user: 'user-carlos-1',
    },
    {
      desc: 'Venda de Luminárias e Decoração',
      amt: 6400,
      type: 'receita',
      cat: 'Vendas',
      acc: 'acc-varejo-2',
      days: 66,
      user: 'user-marina-2',
    },
    {
      desc: 'Aluguel do Showroom Comercial',
      amt: 6500,
      type: 'despesa',
      cat: 'Aluguel',
      acc: 'acc-varejo-1',
      days: 69,
      user: 'user-carlos-1',
    },
    {
      desc: 'Salários dos Vendedores e Montadores',
      amt: 12800,
      type: 'despesa',
      cat: 'Salários',
      acc: 'acc-varejo-1',
      days: 71,
      user: 'user-carlos-1',
    },
    {
      desc: 'Fornecedor de Madeiras e Acabamentos',
      amt: 7600,
      type: 'despesa',
      cat: 'Fornecedores',
      acc: 'acc-varejo-1',
      days: 74,
      user: 'user-carlos-1',
    },
    {
      desc: 'Frete e Entrega Regional',
      amt: 1850,
      type: 'despesa',
      cat: 'Transporte',
      acc: 'acc-varejo-1',
      days: 78,
      user: 'user-lucas-3',
    },
  ]

  varejoData.forEach((item) => {
    const catObj = SEED_CATEGORIES.find(
      (c) => c.company_id === 'comp-varejo-2' && c.name === item.cat && c.type === item.type,
    )
    transactions.push({
      id: `tx-varejo-${tId++}`,
      company_id: 'comp-varejo-2',
      account_id: item.acc,
      category_id: catObj ? catObj.id : 'cat-comp-varejo-2-inc-1',
      user_id: item.user,
      description: item.desc,
      amount: item.amt,
      type: item.type as TransactionType,
      date: getDateStr(item.days),
      is_recurring: item.desc.includes('Aluguel') || item.desc.includes('Salários'),
      recurrence_type:
        item.desc.includes('Aluguel') || item.desc.includes('Salários') ? 'mensal' : undefined,
      created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * item.days).toISOString(),
    })
  })

  return transactions
}

const SEED_TRANSACTIONS: Transaction[] = generateSeedTransactions()

// In-Memory state simulating Skip Cloud Collections
class SkipCloudClient {
  private users: User[] = [...SEED_USERS]
  private companies: Company[] = [...SEED_COMPANIES]
  private members: CompanyMember[] = [...SEED_MEMBERS]
  private accounts: Account[] = [...SEED_ACCOUNTS]
  private categories: Category[] = [...SEED_CATEGORIES]
  private transactions: Transaction[] = [...SEED_TRANSACTIONS]

  private currentUserId: string | null = 'user-carlos-1' // Default logged user

  constructor() {
    // initialize state
    this.restoreFromSession()
  }

  private saveToSession() {
    try {
      const state = {
        users: this.users,
        companies: this.companies,
        members: this.members,
        accounts: this.accounts,
        categories: this.categories,
        transactions: this.transactions,
        currentUserId: this.currentUserId,
      }
      sessionStorage.setItem('skip_cloud_db', JSON.stringify(state))
    } catch {
      // ignore
    }
  }

  private restoreFromSession() {
    try {
      const data = sessionStorage.getItem('skip_cloud_db')
      if (data) {
        const parsed = JSON.parse(data)
        this.users = parsed.users || this.users
        this.companies = parsed.companies || this.companies
        this.members = parsed.members || this.members
        this.accounts = parsed.accounts || this.accounts
        this.categories = parsed.categories || this.categories
        this.transactions = parsed.transactions || this.transactions
        this.currentUserId =
          parsed.currentUserId !== undefined ? parsed.currentUserId : this.currentUserId
      }
    } catch {
      // ignore
    }
  }

  // --- AUTH METHODS ---
  async getCurrentUser(): Promise<User | null> {
    if (!this.currentUserId) return null
    return this.users.find((u) => u.id === this.currentUserId) || null
  }

  async login(email: string): Promise<User> {
    const existing = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim())
    if (existing) {
      this.currentUserId = existing.id
      this.saveToSession()
      return existing
    }
    // Automatically create if does not exist (or default password check)
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: email.split('@')[0].replace('.', ' '),
      email: email.trim().toLowerCase(),
      avatar: `https://img.usecurling.com/ppl/medium?seed=${Math.floor(Math.random() * 50)}`,
      created_at: new Date().toISOString(),
    }
    this.users.push(newUser)
    this.currentUserId = newUser.id
    this.saveToSession()
    return newUser
  }

  async register(name: string, email: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase()
    let user = this.users.find((u) => u.email.toLowerCase() === normalizedEmail)
    if (user) {
      user.name = name.trim()
    } else {
      user = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        email: normalizedEmail,
        avatar: `https://img.usecurling.com/ppl/medium?seed=${Math.floor(Math.random() * 50)}`,
        created_at: new Date().toISOString(),
      }
      this.users.push(user)
    }
    this.currentUserId = user.id

    // Check if there were any pending invitations for this email and activate them
    this.members.forEach((m) => {
      if (m.invited_email?.toLowerCase() === normalizedEmail && m.status === 'pending') {
        m.user_id = user!.id
        m.status = 'active'
      }
    })

    this.saveToSession()
    return user
  }

  async logout(): Promise<void> {
    this.currentUserId = null
    this.saveToSession()
  }

  // --- COMPANIES ---
  async getUserCompanies(userId: string): Promise<Company[]> {
    const userMemberships = this.members.filter(
      (m) => m.user_id === userId && m.status === 'active',
    )
    const companyIds = userMemberships.map((m) => m.company_id)
    return this.companies.filter((c) => companyIds.includes(c.id))
  }

  async getCompany(companyId: string): Promise<Company | null> {
    return this.companies.find((c) => c.id === companyId) || null
  }

  async createCompany(
    name: string,
    segment: SegmentType,
    color: string,
    cnpj?: string,
    description?: string,
  ): Promise<Company> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Usuário não autenticado.')

    const companyId = `comp-${Date.now()}`
    const newCompany: Company = {
      id: companyId,
      name: name.trim(),
      cnpj: cnpj?.trim() || undefined,
      segment,
      color,
      description: description?.trim() || undefined,
      created_at: new Date().toISOString(),
      owner_id: user.id,
    }

    this.companies.push(newCompany)

    // Trigger: create owner membership
    const ownerMember: CompanyMember = {
      id: `mem-${Date.now()}`,
      company_id: companyId,
      user_id: user.id,
      role: 'owner',
      status: 'active',
      created_at: new Date().toISOString(),
    }
    this.members.push(ownerMember)

    // Trigger: create default categories
    const categories = generateCategoriesForCompany(companyId)
    this.categories.push(...categories)

    // Create a starter account
    const defaultAcc: Account = {
      id: `acc-${Date.now()}`,
      company_id: companyId,
      name: 'Conta Principal',
      type: 'banco',
      balance: 0,
      color: color || '#6366F1',
      bank: 'Banco Principal',
      created_at: new Date().toISOString(),
    }
    this.accounts.push(defaultAcc)

    this.saveToSession()
    return newCompany
  }

  async updateCompany(
    companyId: string,
    data: Partial<Pick<Company, 'name' | 'cnpj' | 'segment' | 'color' | 'description'>>,
  ): Promise<Company> {
    const comp = this.companies.find((c) => c.id === companyId)
    if (!comp) throw new Error('Empresa não encontrada.')
    Object.assign(comp, data)
    this.saveToSession()
    return comp
  }

  // Aggregated stats for a company (members count + financial balance)
  async getCompanyStats(companyId: string): Promise<{
    membersCount: number
    balance: number
    income: number
    expense: number
    transactionsCount: number
  }> {
    const membersCount = this.members.filter(
      (m) => m.company_id === companyId && m.status === 'active',
    ).length
    const accs = this.accounts.filter((a) => a.company_id === companyId)
    const balance = accs.reduce((acc, a) => {
      if (a.type === 'credito') return acc
      return acc + (a.balance || 0)
    }, 0)
    const txs = this.transactions.filter((t) => t.company_id === companyId)
    const income = txs.filter((t) => t.type === 'receita').reduce((sum, t) => sum + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'despesa').reduce((sum, t) => sum + t.amount, 0)
    return {
      membersCount,
      balance,
      income,
      expense,
      transactionsCount: txs.length,
    }
  }

  async deleteCompany(companyId: string): Promise<void> {
    // Cascade delete all related data
    this.companies = this.companies.filter((c) => c.id !== companyId)
    this.members = this.members.filter((m) => m.company_id !== companyId)
    this.accounts = this.accounts.filter((a) => a.company_id !== companyId)
    this.categories = this.categories.filter((c) => c.company_id !== companyId)
    this.transactions = this.transactions.filter((t) => t.company_id !== companyId)
    this.saveToSession()
  }

  // --- COMPANY MEMBERS ---
  async getCompanyMembers(companyId: string): Promise<CompanyMember[]> {
    const members = this.members.filter((m) => m.company_id === companyId)
    return members.map((m) => {
      const user = this.users.find((u) => u.id === m.user_id)
      return {
        ...m,
        user: user || {
          id: m.user_id,
          name: m.invited_email ? m.invited_email.split('@')[0] : 'Usuário Convidado',
          email: m.invited_email || 'convidado@empresa.com.br',
          created_at: m.created_at,
        },
      }
    })
  }

  async getUserRoleInCompany(companyId: string, userId: string): Promise<UserRole | null> {
    const member = this.members.find(
      (m) => m.company_id === companyId && m.user_id === userId && m.status === 'active',
    )
    return member ? member.role : null
  }

  async inviteMember(companyId: string, email: string, role: UserRole): Promise<CompanyMember> {
    const normalized = email.trim().toLowerCase()
    // Check if user already exists
    const existingUser = this.users.find((u) => u.email.toLowerCase() === normalized)

    // Check if already member
    const existingMember = this.members.find(
      (m) =>
        m.company_id === companyId &&
        (m.user_id === existingUser?.id || m.invited_email === normalized),
    )
    if (existingMember) {
      throw new Error('Este e-mail já está associado a esta empresa.')
    }

    const newMember: CompanyMember = {
      id: `mem-${Date.now()}`,
      company_id: companyId,
      user_id: existingUser ? existingUser.id : `user-pending-${Date.now()}`,
      role,
      status: existingUser ? 'active' : 'pending',
      invited_email: normalized,
      created_at: new Date().toISOString(),
      user: existingUser,
    }

    this.members.push(newMember)
    this.saveToSession()
    return newMember
  }

  async updateMemberRole(memberId: string, role: UserRole): Promise<CompanyMember> {
    const mem = this.members.find((m) => m.id === memberId)
    if (!mem) throw new Error('Membro não encontrado.')

    // Ensure we don't demote the last owner
    if (mem.role === 'owner' && role !== 'owner') {
      const owners = this.members.filter(
        (m) => m.company_id === mem.company_id && m.role === 'owner' && m.status === 'active',
      )
      if (owners.length <= 1) {
        throw new Error('A empresa deve possuir pelo menos um Proprietário.')
      }
    }

    mem.role = role
    this.saveToSession()
    return mem
  }

  async removeMember(memberId: string): Promise<void> {
    const mem = this.members.find((m) => m.id === memberId)
    if (!mem) throw new Error('Membro não encontrado.')

    if (mem.role === 'owner') {
      const owners = this.members.filter(
        (m) => m.company_id === mem.company_id && m.role === 'owner' && m.status === 'active',
      )
      if (owners.length <= 1) {
        throw new Error('O último proprietário não pode ser removido da empresa.')
      }
    }

    this.members = this.members.filter((m) => m.id !== memberId)
    this.saveToSession()
  }

  // --- ACCOUNTS ---
  async getAccounts(companyId: string): Promise<Account[]> {
    return this.accounts.filter((a) => a.company_id === companyId)
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
    const newAcc: Account = {
      id: `acc-${Date.now()}`,
      company_id: companyId,
      name: data.name.trim(),
      type: data.type,
      balance: Number(data.balance) || 0,
      limit: data.type === 'credito' ? Number(data.limit) || 0 : undefined,
      color: data.color || '#6366F1',
      bank: data.bank?.trim() || undefined,
      created_at: new Date().toISOString(),
    }
    this.accounts.push(newAcc)
    this.saveToSession()
    return newAcc
  }

  async updateAccount(
    accountId: string,
    data: Partial<Omit<Account, 'id' | 'company_id' | 'created_at'>>,
  ): Promise<Account> {
    const acc = this.accounts.find((a) => a.id === accountId)
    if (!acc) throw new Error('Conta não encontrada.')
    Object.assign(acc, data)
    this.saveToSession()
    return acc
  }

  async deleteAccount(accountId: string): Promise<void> {
    // Check if transactions exist
    const hasTx = this.transactions.some((t) => t.account_id === accountId)
    if (hasTx) {
      throw new Error('Não é possível excluir uma conta que possui lançamentos vinculados.')
    }
    this.accounts = this.accounts.filter((a) => a.id !== accountId)
    this.saveToSession()
  }

  // --- CATEGORIES ---
  async getCategories(companyId: string): Promise<Category[]> {
    return this.categories.filter((c) => c.company_id === companyId)
  }

  async createCategory(
    companyId: string,
    data: { name: string; type: TransactionType; color: string; icon: string },
  ): Promise<Category> {
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      company_id: companyId,
      name: data.name.trim(),
      type: data.type,
      color: data.color || '#6366F1',
      icon: data.icon || 'Tag',
      created_at: new Date().toISOString(),
    }
    this.categories.push(newCat)
    this.saveToSession()
    return newCat
  }

  async updateCategory(
    categoryId: string,
    data: Partial<Omit<Category, 'id' | 'company_id' | 'created_at'>>,
  ): Promise<Category> {
    const cat = this.categories.find((c) => c.id === categoryId)
    if (!cat) throw new Error('Categoria não encontrada.')
    Object.assign(cat, data)
    this.saveToSession()
    return cat
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const hasTx = this.transactions.some((t) => t.category_id === categoryId)
    if (hasTx) {
      throw new Error('Não é possível excluir uma categoria que possui lançamentos vinculados.')
    }
    this.categories = this.categories.filter((c) => c.id !== categoryId)
    this.saveToSession()
  }

  // --- TRANSACTIONS ---
  async getTransactions(companyId: string): Promise<Transaction[]> {
    const txs = this.transactions.filter((t) => t.company_id === companyId)
    return txs
      .map((t) => ({
        ...t,
        account: this.accounts.find((a) => a.id === t.account_id),
        category: this.categories.find((c) => c.id === t.category_id),
        user: this.users.find((u) => u.id === t.user_id),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async createTransaction(
    companyId: string,
    data: {
      account_id: string
      category_id: string
      description: string
      amount: number
      type: TransactionType
      date: string
      is_recurring?: boolean
      recurrence_type?: any
      notes?: string
    },
  ): Promise<Transaction> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Usuário não autenticado.')

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      company_id: companyId,
      account_id: data.account_id,
      category_id: data.category_id,
      user_id: user.id,
      description: data.description.trim(),
      amount: Number(data.amount),
      type: data.type,
      date: data.date,
      is_recurring: Boolean(data.is_recurring),
      recurrence_type: data.recurrence_type,
      notes: data.notes?.trim() || undefined,
      created_at: new Date().toISOString(),
    }

    this.transactions.push(newTx)

    // Update account balance
    const acc = this.accounts.find((a) => a.id === data.account_id)
    if (acc) {
      if (acc.type === 'credito') {
        // For credit cards, despesa increases used limit, receita decreases
        if (data.type === 'despesa') {
          acc.balance += Number(data.amount)
        } else {
          acc.balance -= Number(data.amount)
        }
      } else {
        if (data.type === 'receita') {
          acc.balance += Number(data.amount)
        } else {
          acc.balance -= Number(data.amount)
        }
      }
    }

    this.saveToSession()
    return newTx
  }

  async updateTransaction(
    transactionId: string,
    data: Partial<Omit<Transaction, 'id' | 'company_id' | 'created_at' | 'user_id'>>,
  ): Promise<Transaction> {
    const tx = this.transactions.find((t) => t.id === transactionId)
    if (!tx) throw new Error('Lançamento não encontrado.')

    // Revert old balance adjustment
    const oldAcc = this.accounts.find((a) => a.id === tx.account_id)
    if (oldAcc) {
      if (oldAcc.type === 'credito') {
        if (tx.type === 'despesa') oldAcc.balance -= tx.amount
        else oldAcc.balance += tx.amount
      } else {
        if (tx.type === 'receita') oldAcc.balance -= tx.amount
        else oldAcc.balance += tx.amount
      }
    }

    // Apply updates
    Object.assign(tx, data)

    // Apply new balance adjustment
    const newAcc = this.accounts.find((a) => a.id === tx.account_id)
    if (newAcc) {
      if (newAcc.type === 'credito') {
        if (tx.type === 'despesa') newAcc.balance += tx.amount
        else newAcc.balance -= tx.amount
      } else {
        if (tx.type === 'receita') newAcc.balance += tx.amount
        else newAcc.balance += tx.amount
      }
    }

    this.saveToSession()
    return tx
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    const tx = this.transactions.find((t) => t.id === transactionId)
    if (!tx) throw new Error('Lançamento não encontrado.')

    // Revert account balance
    const acc = this.accounts.find((a) => a.id === tx.account_id)
    if (acc) {
      if (acc.type === 'credito') {
        if (tx.type === 'despesa') acc.balance -= tx.amount
        else acc.balance += tx.amount
      } else {
        if (tx.type === 'receita') acc.balance -= tx.amount
        else acc.balance += tx.amount
      }
    }

    this.transactions = this.transactions.filter((t) => t.id !== transactionId)
    this.saveToSession()
  }

  // Reset entire database to default seeds
  async resetToSeed(): Promise<void> {
    this.users = [...SEED_USERS]
    this.companies = [...SEED_COMPANIES]
    this.members = [...SEED_MEMBERS]
    this.accounts = [...SEED_ACCOUNTS]
    this.categories = [...SEED_CATEGORIES]
    this.transactions = generateSeedTransactions()
    this.currentUserId = 'user-carlos-1'
    this.saveToSession()
  }
}

export const skipCloud = new SkipCloudClient()
