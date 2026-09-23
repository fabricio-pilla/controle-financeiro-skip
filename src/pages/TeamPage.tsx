import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { InviteMemberModal } from '@/components/team/InviteMemberModal'
import { EditMemberModal } from '@/components/team/EditMemberModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { formatDateBR, getInitials } from '@/lib/formatters'
import { CompanyMember, UserRole } from '@/types/database'
import { toast } from 'sonner'
import {
  UserPlus,
  Shield,
  ShieldCheck,
  User as UserIcon,
  Trash2,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function TeamPage() {
  const { user } = useAuth()
  const { currentCompany, members, isOwner, canManageTeam, updateMemberRole, removeMember } =
    useCompany()

  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [memberToEdit, setMemberToEdit] = useState<CompanyMember | null>(null)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<CompanyMember | null>(null)

  const handleRoleChange = async (memberId: string, newRole: UserRole) => {
    try {
      await updateMemberRole(memberId, newRole)
      toast.success('Papel do colaborador atualizado!')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar papel.')
    }
  }

  const handleRemovePrompt = (mem: CompanyMember) => {
    setMemberToRemove(mem)
    setConfirmRemoveOpen(true)
  }

  const confirmRemove = async () => {
    if (!memberToRemove) return
    try {
      await removeMember(memberToRemove.id)
      toast.success('Membro removido do controle com sucesso!')
      setMemberToRemove(null)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remover participante.')
    }
  }

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Shield className="w-3.5 h-3.5 text-purple-600" />
            Proprietário
          </span>
        )
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Administrador
          </span>
        )
      case 'member':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
            Membro
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Equipe & Colaboradores
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie o acesso ao controle{' '}
            <strong className="text-slate-700">{currentCompany?.name}</strong> e defina níveis de
            permissão.
          </p>
        </div>

        {canManageTeam ? (
          <Button
            onClick={() => setInviteModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 px-4 font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Convidar Usuário</span>
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Apenas Administradores podem gerenciar a equipe</span>
          </div>
        )}
      </div>

      {/* Permissions Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900">Proprietário (Owner)</h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Acesso irrestrito a todos os dados, configurações gerais e exclusão do controle.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900">Administrador (Admin)</h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Convida membros e altera papéis (exceto Proprietário). Gerencia contas, categorias e
              lançamentos. Não pode excluir o controle.
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900">Membro (Participante)</h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Pode criar e visualizar lançamentos financeiros. Gestão e configurações desabilitadas.
            </p>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">Colaboradores ({members.length})</span>
          <span className="text-xs text-slate-400">
            {isOwner
              ? 'Você é Proprietário — acesso total à gestão de equipe'
              : canManageTeam
                ? 'Você é Administrador — pode convidar e gerenciar, exceto Proprietários'
                : 'Você é Membro — somente leitura da equipe'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Papel / Acesso</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Entrou em</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {members.map((mem) => {
                const isCurrentUser = mem.user_id === user?.id
                const displayName = mem.user?.name || mem.invited_email?.split('@')[0] || 'Usuário'
                const displayEmail = mem.user?.email || mem.invited_email || ''

                return (
                  <tr key={mem.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {mem.user?.avatar ? (
                            <img
                              src={mem.user.avatar}
                              alt={displayName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            getInitials(displayName)
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>{displayName}</span>
                            {isCurrentUser && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                Você
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                      {displayEmail}
                    </td>

                    <td className="py-3.5 px-4">
                      {canManageTeam && !isCurrentUser && (isOwner || mem.role !== 'owner') ? (
                        <Select
                          value={mem.role}
                          onValueChange={(v: UserRole) => handleRoleChange(mem.id, v)}
                        >
                          <SelectTrigger className="h-8 w-36 rounded-lg text-xs font-medium border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {/* Only the owner can assign or revoke the owner role */}
                            {isOwner && <SelectItem value="owner">Proprietário</SelectItem>}
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="member">Membro</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getRoleBadge(mem.role)
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {mem.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          Convite Pendente
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateBR(mem.created_at)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canManageTeam || isCurrentUser ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setMemberToEdit(mem)
                              setEditModalOpen(true)
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-lg"
                            title="Editar colaborador (nome, senha, foto)"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        ) : null}

                        {canManageTeam && !isCurrentUser && (isOwner || mem.role !== 'owner') ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePrompt(mem)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg"
                            title="Remover do controle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal open={inviteModalOpen} onOpenChange={setInviteModalOpen} />

      {/* Edit Member Modal */}
      <EditMemberModal open={editModalOpen} onOpenChange={setEditModalOpen} member={memberToEdit} />

      {/* Confirm Remove Member Dialog */}
      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Remover Colaborador"
        description={`Tem certeza que deseja remover "${
          memberToRemove?.user?.name || memberToRemove?.invited_email
        }" deste controle? Ele perderá imediatamente o acesso a todas as contas e relatórios.`}
        confirmText="Remover Colaborador"
        variant="danger"
        onConfirm={confirmRemove}
      />
    </div>
  )
}
