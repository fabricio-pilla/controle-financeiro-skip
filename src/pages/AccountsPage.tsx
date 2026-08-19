import React, { useState, useMemo } from 'react'
import { useCompany } from '@/contexts/CompanyContext'
import { AccountModal } from '@/components/accounts/AccountModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { formatCurrency } from '@/lib/formatters'
import { Account, AccountType } from '@/types/database'
import { toast } from 'sonner'
import {
  Plus,
  Building,
  ArrowLeftRight,
  Wallet,
  CreditCard,
  PiggyBank,
  Edit2,
  Trash2,
  Sparkles,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AccountsPage() {
  const { accounts, deleteAccount, canManageFinance } = useCompany()

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAcc, setSelectedAcc] = useState<Account | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [accToDelete, setAccToDelete] = useState<Account | null>(null)

  // Overall totals
  const totals = useMemo(() => {
    let totalCash = 0
    let totalCreditUsed = 0
    let totalCreditLimit = 0

    accounts.forEach((acc) => {
      if (acc.type === 'credito') {
        totalCreditUsed += acc.balance
        totalCreditLimit += acc.limit || 0
      } else {
        totalCash += acc.balance
      }
    })

    return {
      totalCash,
      totalCreditUsed,
      totalCreditLimit,
      availableCredit: Math.max(0, totalCreditLimit - totalCreditUsed),
    }
  }, [accounts])

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'banco':
        return Building
      case 'pix':
        return ArrowLeftRight
      case 'carteira':
        return Wallet
      case 'credito':
        return CreditCard
      case 'investimento':
        return PiggyBank
    }
  }

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'banco':
        return 'Conta Bancária'
      case 'pix':
        return 'Conta Digital / Pix'
      case 'carteira':
        return 'Carteira Física'
      case 'credito':
        return 'Cartão de Crédito'
      case 'investimento':
        return 'Investimentos'
    }
  }

  const handleEdit = (acc: Account) => {
    setSelectedAcc(acc)
    setModalOpen(true)
  }

  const handleOpenCreate = () => {
    setSelectedAcc(null)
    setModalOpen(true)
  }

  const handleDeletePrompt = (acc: Account) => {
    setAccToDelete(acc)
    setConfirmDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!accToDelete) return
    try {
      await deleteAccount(accToDelete.id)
      toast.success('Conta financeira excluída com sucesso!')
      setAccToDelete(null)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir conta.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Contas & Cartões
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie bancos, contas digitais, carteiras de caixa e limites de cartões de crédito.
          </p>
        </div>

        {canManageFinance ? (
          <Button
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-4 font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Conta</span>
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Apenas Administradores podem gerenciar contas</span>
          </div>
        )}
      </div>

      {/* Summary Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Cash in Hand */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Saldo Total Disponível</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {formatCurrency(totals.totalCash)}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              Liquidez imediata em contas e aplicações
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Credit Card Limit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Limite Total de Crédito</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {formatCurrency(totals.totalCreditLimit)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Limite disponível: {formatCurrency(totals.availableCredit)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Fatuta em Aberto */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs font-semibold text-slate-500">Faturas de Cartão em Aberto</p>
            <p className="text-2xl font-bold text-rose-600 tabular-nums mt-1">
              {formatCurrency(totals.totalCreditUsed)}
            </p>
            <p className="text-[11px] text-rose-500 font-medium mt-0.5">
              Comprometimento de crédito
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((acc) => {
          const Icon = getAccountIcon(acc.type)
          const isCredit = acc.type === 'credito'
          const usedPct = isCredit && acc.limit ? Math.min((acc.balance / acc.limit) * 100, 100) : 0

          return (
            <div
              key={acc.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 p-6 flex flex-col justify-between"
              style={{ borderTop: `4px solid ${acc.color || '#6366F1'}` }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: acc.color || '#6366F1' }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base text-slate-900 leading-tight">
                        {acc.name}
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {getAccountTypeLabel(acc.type)}
                      </p>
                    </div>
                  </div>

                  {canManageFinance && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(acc)}
                        className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-lg"
                        title="Editar conta"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePrompt(acc)}
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                        title="Excluir conta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {acc.bank && (
                  <p className="text-xs text-slate-500 font-medium mb-3">
                    Instituição: <span className="text-slate-800">{acc.bank}</span>
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">
                    {isCredit ? 'Fatura Atual Utilizada' : 'Saldo em Conta'}
                  </p>
                  <p
                    className={`text-2xl font-extrabold tabular-nums mt-0.5 ${
                      isCredit
                        ? 'text-slate-900'
                        : acc.balance >= 0
                          ? 'text-slate-900'
                          : 'text-rose-600'
                    }`}
                  >
                    {formatCurrency(acc.balance)}
                  </p>
                </div>

                {isCredit && acc.limit && (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Uso do limite ({usedPct.toFixed(0)}%)</span>
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(acc.limit - acc.balance)} livre
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${usedPct}%`,
                          backgroundColor:
                            usedPct > 80 ? '#EF4444' : usedPct > 50 ? '#F59E0B' : acc.color,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 text-right">
                      Limite total: {formatCurrency(acc.limit)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Create Account Card */}
        {canManageFinance && (
          <button
            onClick={handleOpenCreate}
            className="group min-h-[220px] border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 hover:-translate-y-1"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform mb-3">
              <Plus className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Cadastrar Nova Conta</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
              Adicione contas bancárias, caixas físicos ou cartões de crédito.
            </p>
          </button>
        )}
      </div>

      {/* Account Modal */}
      <AccountModal open={modalOpen} onOpenChange={setModalOpen} account={selectedAcc} />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir Conta Financeira"
        description={`Tem certeza que deseja excluir a conta "${accToDelete?.name}"? Isso só será permitido se não houver lançamentos vinculados.`}
        confirmText="Excluir Conta"
        variant="danger"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
