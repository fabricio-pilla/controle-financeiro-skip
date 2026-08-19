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
import { UserRole } from '@/types/database'
import { toast } from 'sonner'
import { Loader2, UserPlus, Shield, ShieldCheck, User } from 'lucide-react'

interface InviteMemberModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteMemberModal({ open, onOpenChange }: InviteMemberModalProps) {
  const { inviteMember } = useCompany()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('member')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      toast.error('Informe um e-mail válido.')
      return
    }

    setIsSubmitting(true)
    try {
      const mem = await inviteMember(email, role)
      if (mem.status === 'active') {
        toast.success(`Usuário ${email} já cadastrado foi adicionado com sucesso!`)
      } else {
        toast.success(
          `Convite enviado para ${email}! O usuário terá acesso assim que criar a conta.`,
        )
      }
      setEmail('')
      setRole('member')
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao convidar usuário.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Convidar Membro
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Adicione colaboradores à gestão financeira da sua empresa.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-sm font-medium text-slate-700">
              E-mail do Colaborador *
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colaborador@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl h-11"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role" className="text-sm font-medium text-slate-700">
              Papel / Permissões *
            </Label>
            <Select value={role} onValueChange={(v: UserRole) => setRole(v)}>
              <SelectTrigger id="invite-role" className="rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Administrador (Gestão de lançamentos, contas e membros)</span>
                  </div>
                </SelectItem>
                <SelectItem value="member">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-600" />
                    <span>Membro (Cria e visualiza lançamentos)</span>
                  </div>
                </SelectItem>
                <SelectItem value="owner">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>Proprietário (Acesso completo e exclusão)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800 mb-1">Como funciona o convite:</p>
            <p>
              Se o colaborador já possuir conta no Skip Cloud, a empresa aparecerá no painel dele
              imediatamente. Caso contrário, ele terá acesso total após o cadastro com este mesmo
              e-mail.
            </p>
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
                  Enviando convite...
                </>
              ) : (
                'Enviar Convite'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
