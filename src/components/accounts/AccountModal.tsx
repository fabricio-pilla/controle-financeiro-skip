import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompany } from '@/contexts/CompanyContext'
import { Account, AccountType } from '@/types/database'
import { PALETTE_COLORS } from '@/lib/skip-cloud'
import { toast } from 'sonner'
import { Loader2, CreditCard, Wallet, Building, ArrowLeftRight, PiggyBank } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface AccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null
}

const ACCOUNT_TYPES: { type: AccountType; label: string; icon: any }[] = [
  { type: 'banco', label: 'Conta Bancária (Corrente)', icon: Building },
  { type: 'pix', label: 'Conta Digital / Pix', icon: ArrowLeftRight },
  { type: 'carteira', label: 'Carteira Física / Dinheiro', icon: Wallet },
  { type: 'credito', label: 'Cartão de Crédito', icon: CreditCard },
  { type: 'investimento', label: 'Aplicação / Investimento', icon: PiggyBank },
]

export function AccountModal({ open, onOpenChange, account }: AccountModalProps) {
  const { createAccount, updateAccount } = useCompany()
  const isEditing = Boolean(account)

  const [name, setName] = useState(account?.name || '')
  const [type, setType] = useState<AccountType>(account?.type || 'banco')
  const [balanceStr, setBalanceStr] = useState(account ? String(account.balance) : '0')
  const [limitStr, setLimitStr] = useState(account?.limit ? String(account.limit) : '')
  const [bank, setBank] = useState(account?.bank || '')
  const [color, setColor] = useState(account?.color || PALETTE_COLORS[0])
  const [isPrimary, setIsPrimary] = useState(Boolean(account?.is_primary))
  const [dueDay, setDueDay] = useState(
    account?.type === 'credito' && account?.due_day ? String(account.due_day) : '',
  )
  const [closingDay, setClosingDay] = useState(
    account?.type === 'credito' && account?.closing_day ? String(account.closing_day) : '',
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  React.useEffect(() => {
    if (account) {
      setName(account.name)
      setType(account.type)
      setBalanceStr(String(account.balance))
      setLimitStr(account.limit ? String(account.limit) : '')
      setBank(account.bank || '')
      setColor(account.color)
      setIsPrimary(Boolean(account.is_primary))
      setDueDay(account.type === 'credito' && account.due_day ? String(account.due_day) : '')
      setClosingDay(
        account.type === 'credito' && account.closing_day ? String(account.closing_day) : '',
      )
    } else {
      setName('')
      setType('banco')
      setBalanceStr('0')
      setLimitStr('')
      setBank('')
      setColor(PALETTE_COLORS[0])
      setIsPrimary(false)
      setDueDay('')
      setClosingDay('')
    }
  }, [account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome da conta.')
      return
    }
    const parsedBalance = parseFloat(balanceStr.replace(',', '.')) || 0
    const parsedLimit = limitStr ? parseFloat(limitStr.replace(',', '.')) : undefined

    setIsSubmitting(true)
    try {
      if (isEditing && account) {
        await updateAccount(account.id, {
          name,
          type,
          balance: parsedBalance,
          limit: parsedLimit,
          bank,
          color,
          due_day: type === 'credito' && dueDay ? parseInt(dueDay, 10) : undefined,
          closing_day: type === 'credito' && closingDay ? parseInt(closingDay, 10) : undefined,
          is_primary: isPrimary,
        })
        toast.success('Conta atualizada com sucesso!')
      } else {
        await createAccount({
          name,
          type,
          balance: parsedBalance,
          limit: parsedLimit,
          bank,
          color,
          due_day: type === 'credito' && dueDay ? parseInt(dueDay, 10) : undefined,
          closing_day: type === 'credito' && closingDay ? parseInt(closingDay, 10) : undefined,
          is_primary: isPrimary,
        })
        toast.success('Conta criada com sucesso!')
      }
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar conta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Editar Conta Financeira' : 'Nova Conta Financeira'}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Gerencie carteiras, bancos, cartões ou investimentos do controle.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="acc-name" className="text-sm font-medium text-slate-700">
              Nome da Conta *
            </Label>
            <Input
              id="acc-name"
              placeholder="Ex: Itaú PJ / Nubank / Cofre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl h-11"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-type" className="text-sm font-medium text-slate-700">
                Tipo de Conta *
              </Label>
              <Select value={type} onValueChange={(v: AccountType) => setType(v)}>
                <SelectTrigger id="acc-type" className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc-bank" className="text-sm font-medium text-slate-700">
                Instituição / Banco (opcional)
              </Label>
              <Input
                id="acc-bank"
                placeholder="Ex: Bradesco, XP"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
          </div>

          {type === 'credito' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
              <div className="space-y-1.5">
                <Label htmlFor="acc-closing-day" className="text-sm font-medium text-slate-700">
                  Dia do Fechamento da Fatura
                </Label>
                <Input
                  id="acc-closing-day"
                  type="number"
                  min={1}
                  max={31}
                  step={1}
                  placeholder="Ex: 10 (fecha todo dia 10)"
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  className="rounded-xl h-11 font-bold tabular-nums"
                />
                <p className="text-[11px] text-slate-400">
                  Compras a partir deste dia caem na fatura do mês seguinte.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="acc-due-day" className="text-sm font-medium text-slate-700">
                  Dia do Vencimento da Fatura
                </Label>
                <Input
                  id="acc-due-day"
                  type="number"
                  min={1}
                  max={31}
                  step={1}
                  placeholder="Ex: 18 (vence todo dia 18)"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="rounded-xl h-11 font-bold tabular-nums"
                />
                <p className="text-[11px] text-slate-400">
                  Data em que a fatura é debitada / paga.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
            <div className="space-y-0.5">
              <Label htmlFor="acc-primary-toggle" className="text-sm font-medium text-slate-800">
                Conta Principal
              </Label>
              <p className="text-xs text-slate-500">
                Será pré-selecionada como padrão nos novos lançamentos
              </p>
            </div>
            <Switch id="acc-primary-toggle" checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-balance" className="text-sm font-medium text-slate-700">
                {type === 'credito' ? 'Fatura Atual / Utilizado (R$)' : 'Saldo Atual (R$)'}
              </Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={balanceStr}
                onChange={(e) => setBalanceStr(e.target.value)}
                className="rounded-xl h-11 font-bold tabular-nums"
              />
            </div>

            {type === 'credito' && (
              <div className="space-y-1.5 animate-fade-in">
                <Label htmlFor="acc-limit" className="text-sm font-medium text-slate-700">
                  Limite Total do Cartão (R$) *
                </Label>
                <Input
                  id="acc-limit"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 20000,00"
                  value={limitStr}
                  onChange={(e) => setLimitStr(e.target.value)}
                  className="rounded-xl h-11 font-bold tabular-nums"
                  required
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">Cor do Cartão/Conta</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${
                    color === c
                      ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                      : 'hover:scale-105'
                  }`}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                'Criar Conta'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
