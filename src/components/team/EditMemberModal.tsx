import React, { useState, useRef, useEffect } from 'react'
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
import { useCompany } from '@/contexts/CompanyContext'
import { useAuth } from '@/contexts/AuthContext'
import { CompanyMember } from '@/types/database'
import { toast } from 'sonner'
import { Loader2, UserCog, Upload, Camera, KeyRound, ShieldAlert } from 'lucide-react'
import { getInitials } from '@/lib/formatters'

interface EditMemberModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: CompanyMember | null
}

export function EditMemberModal({ open, onOpenChange, member }: EditMemberModalProps) {
  const { updateMemberProfile, canManageTeam } = useCompany()
  const { user: currentUser, refreshUser } = useAuth()

  const [name, setName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isSelf = member?.user_id === currentUser?.id
  const canEdit = canManageTeam || isSelf

  useEffect(() => {
    if (member) {
      setName(member.user?.name || '')
      setAvatarPreview(member.user?.avatar || null)
      setSelectedFile(null)
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [member, open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido (PNG, JPG, WebP).')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.')
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!member) {
      toast.error('Nenhum colaborador selecionado.')
      return
    }

    const targetUserId = member.user_id || member.user?.id
    if (!targetUserId || member.status === 'pending') {
      toast.info('Este colaborador ainda não criou a conta; apenas o convite pode ser gerenciado.')
      return
    }

    if (!name.trim()) {
      toast.error('Informe o nome do colaborador.')
      return
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        toast.error('A nova senha deve ter no mínimo 8 caracteres.')
        return
      }
      if (newPassword !== confirmPassword) {
        toast.error('As senhas digitadas não conferem.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      await updateMemberProfile(targetUserId, {
        name: name.trim(),
        password: newPassword ? newPassword : undefined,
        avatarFile: selectedFile,
      })

      if (isSelf) {
        await refreshUser()
      }

      toast.success('Dados do colaborador atualizados com sucesso!')
      onOpenChange(false)
    } catch (err: any) {
      // Usar console.warn se necessário diagnosticar sem acionar alarmes de runtime
      console.warn('Falha ao atualizar colaborador:', err)
      const msg =
        err?.message ||
        'Não foi possível atualizar os dados do colaborador. Verifique sua conexão e tente novamente.'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayName = member?.user?.name || member?.invited_email?.split('@')[0] || 'Colaborador'
  const displayEmail = member?.user?.email || member?.invited_email || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Editar Colaborador
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Atualize o nome, senha ou foto de perfil de{' '}
                <strong className="text-slate-700">{displayName}</strong>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!canEdit ? (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Apenas administradores podem editar outros colaboradores.</span>
          </div>
        ) : !member?.user_id || member?.status === 'pending' ? (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-2">
            <p className="font-semibold">Convite pendente</p>
            <p>
              Este colaborador ({displayEmail}) ainda não criou a conta; só o convite pode ser
              gerenciado. O nome, senha e foto de perfil poderão ser editados assim que ele concluir
              o cadastro.
            </p>
            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-lg text-xs"
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Foto de Perfil */}
            <div className="flex items-center gap-4 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-indigo-100 text-indigo-700 font-bold text-lg flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(name || displayName)
                )}
              </div>

              <div className="flex-1 space-y-1">
                <p className="text-xs font-semibold text-slate-800">Foto de Perfil</p>
                <p className="text-[11px] text-slate-500">
                  Formatos aceitos: JPG, PNG ou WebP até 5MB.
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 rounded-lg text-xs font-medium border-slate-200 gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    <span>Alterar foto</span>
                  </Button>
                  {selectedFile && (
                    <span className="text-[10px] text-emerald-600 font-medium">
                      Foto nova selecionada
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Nome Completo */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-sm font-medium text-slate-700">
                Nome Completo *
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Raffaela Ricci"
                className="rounded-xl h-11"
                required
              />
            </div>

            {/* E-mail (somente leitura) */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">E-mail</Label>
              <Input
                value={displayEmail}
                disabled
                className="rounded-xl h-11 bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>

            {/* Alterar / Resetar Senha */}
            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">Alterar ou Resetar Senha</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Deixe em branco se não quiser alterar a senha atual do colaborador.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pwd" className="text-xs font-medium text-slate-700">
                    Nova Senha
                  </Label>
                  <Input
                    id="edit-pwd"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-confirm-pwd" className="text-xs font-medium text-slate-700">
                    Confirmar Nova Senha
                  </Label>
                  <Input
                    id="edit-confirm-pwd"
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
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
                className="rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-600/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
