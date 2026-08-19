/**
 * Migration Schema definition for Skip Cloud Backend
 * Collections:
 * - financial_controls
 * - control_members
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
      name: 'financial_controls',
      fields: {
        id: 'string (primary key, uuid)',
        name: 'string (required)',
        segment: 'enum (Pessoal, Família, Casa, Casal, Indivíduo, Outro)',
        color: 'string (hex)',
        description: 'text (optional)',
        created_at: 'timestamp (default now())',
        owner_id: 'string (references users.id)',
        owner_email: 'string (optional)',
      },
      indexes: ['owner_id', 'owner_email'],
    },
    {
      name: 'control_members',
      fields: {
        id: 'string (primary key, uuid)',
        control_id: 'string (references financial_controls.id, cascade delete)',
        user_id: 'string (references users.id)',
        email: 'string (optional)',
        role: 'enum (owner, admin, member)',
        status: 'enum (active, pending)',
        invited_email: 'string (optional)',
        created_at: 'timestamp (default now())',
      },
      indexes: ['control_id', 'user_id', 'email'],
    },
    {
      name: 'accounts',
      fields: {
        id: 'string (primary key, uuid)',
        control_id: 'string (references financial_controls.id, cascade delete)',
        name: 'string (required)',
        type: 'enum (carteira, banco, pix, credito, investimento)',
        balance: 'number (default 0)',
        limit: 'number (optional, for credito)',
        color: 'string (hex)',
        bank: 'string (optional)',
        created_at: 'timestamp (default now())',
      },
      indexes: ['control_id'],
    },
    {
      name: 'categories',
      fields: {
        id: 'string (primary key, uuid)',
        control_id: 'string (references financial_controls.id, cascade delete)',
        name: 'string (required)',
        type: 'enum (receita, despesa)',
        color: 'string (hex)',
        icon: 'string',
        is_default: 'boolean (optional)',
        created_at: 'timestamp (default now())',
      },
      indexes: ['control_id', 'type'],
    },
    {
      name: 'transactions',
      fields: {
        id: 'string (primary key, uuid)',
        control_id: 'string (references financial_controls.id, cascade delete)',
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
      indexes: ['control_id', 'date', 'account_id', 'category_id'],
    },
  ],
  triggers: [
    {
      event: 'on_control_created',
      description:
        'Cria automaticamente as categorias padrão de receitas e despesas ao registrar um novo controle financeiro.',
    },
    {
      event: 'on_control_deleted',
      description: 'Exclui em cascata control_members, accounts, categories e transactions.',
    },
  ],
}
