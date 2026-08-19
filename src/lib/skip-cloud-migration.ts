/**
 * Migration Schema definition for Skip Cloud Backend
 * Collections:
 * - companies
 * - company_members
 * - accounts
 * - categories
 * - transactions
 */

export const SKIP_CLOUD_SCHEMA = {
  collections: [
    {
      name: 'users',
      fields: {
        id: 'string (primary key, uuid)',
        name: 'string (required)',
        email: 'string (required, unique)',
        avatar: 'string (optional)',
        created_at: 'timestamp (default now())',
      },
    },
    {
      name: 'companies',
      fields: {
        id: 'string (primary key, uuid)',
        name: 'string (required)',
        cnpj: 'string (optional)',
        segment: 'enum (Serviços, Comércio, Indústria, Tecnologia, Outro)',
        color: 'string (hex)',
        created_at: 'timestamp (default now())',
        owner_id: 'string (references users.id)',
      },
      indexes: ['owner_id'],
    },
    {
      name: 'company_members',
      fields: {
        id: 'string (primary key, uuid)',
        company_id: 'string (references companies.id, cascade delete)',
        user_id: 'string (references users.id)',
        role: 'enum (owner, admin, member)',
        status: 'enum (active, pending)',
        invited_email: 'string (optional)',
        created_at: 'timestamp (default now())',
      },
      indexes: ['company_id', 'user_id', 'invited_email'],
    },
    {
      name: 'accounts',
      fields: {
        id: 'string (primary key, uuid)',
        company_id: 'string (references companies.id, cascade delete)',
        name: 'string (required)',
        type: 'enum (carteira, banco, pix, credito, investimento)',
        balance: 'number (default 0)',
        limit: 'number (optional, for credito)',
        color: 'string (hex)',
        bank: 'string (optional)',
        created_at: 'timestamp (default now())',
      },
      indexes: ['company_id'],
    },
    {
      name: 'categories',
      fields: {
        id: 'string (primary key, uuid)',
        company_id: 'string (references companies.id, cascade delete)',
        name: 'string (required)',
        type: 'enum (receita, despesa)',
        color: 'string (hex)',
        icon: 'string',
        created_at: 'timestamp (default now())',
      },
      indexes: ['company_id', 'type'],
    },
    {
      name: 'transactions',
      fields: {
        id: 'string (primary key, uuid)',
        company_id: 'string (references companies.id, cascade delete)',
        account_id: 'string (references accounts.id)',
        category_id: 'string (references categories.id)',
        user_id: 'string (references users.id)',
        description: 'string (required)',
        amount: 'number (required)',
        type: 'enum (receita, despesa)',
        date: 'string (date format YYYY-MM-DD)',
        is_recurring: 'boolean (default false)',
        recurrence_type: 'enum (mensal, semanal, anual, optional)',
        installments_total: 'number (optional)',
        installment_number: 'number (optional)',
        parent_transaction_id: 'string (optional)',
        notes: 'string (optional)',
        created_at: 'timestamp (default now())',
      },
      indexes: ['company_id', 'date', 'account_id', 'category_id'],
    },
  ],
  triggers: [
    {
      event: 'on_company_created',
      description:
        'Cria automaticamente as categorias padrão de receitas e despesas ao registrar uma nova empresa.',
    },
    {
      event: 'on_company_deleted',
      description: 'Exclui em cascata company_members, accounts, categories e transactions.',
    },
  ],
}
