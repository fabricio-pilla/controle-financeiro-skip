// PocketBase server-side hook to allow admin/owner of a financial control to update member user credentials
// (such as name, password reset, avatar) with strict authorization check.

routerAdd(
  'POST',
  '/backend/v1/custom/admin-update-member',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { message: 'Não autenticado.' })
    }

    const body = e.requestInfo().body || {}
    const targetUserId = body.userId
    const controlId = body.controlId
    const newName = body.name
    const newPassword = body.password

    if (!targetUserId || !controlId) {
      return e.json(400, { message: 'Parâmetros obrigatórios ausentes (userId, controlId).' })
    }

    // 1. Verify caller is owner or admin in this control
    let isCallerAdmin = false
    try {
      const callerMember = $app.findFirstRecordByFilter(
        'control_members',
        'control_id = {:controlId} && user_id = {:callerId} && status = "active"',
        { controlId: controlId, callerId: authRecord.id },
      )
      if (callerMember) {
        const role = callerMember.getString('role')
        if (role === 'owner' || role === 'admin') {
          isCallerAdmin = true
        }
      }
    } catch (_) {
      isCallerAdmin = false
    }

    // Also check if caller is the owner of the financial_control
    if (!isCallerAdmin) {
      try {
        const ctrl = $app.findRecordById('financial_controls', controlId)
        if (ctrl && ctrl.getString('owner_id') === authRecord.id) {
          isCallerAdmin = true
        }
      } catch (_) {}
    }

    // If caller is updating their own user, allow it
    const isSelf = authRecord.id === targetUserId

    if (!isCallerAdmin && !isSelf) {
      return e.json(403, {
        message: 'Apenas administradores do controle podem editar colaboradores.',
      })
    }

    // 2. Verify target user is actually part of this control
    if (!isSelf) {
      try {
        $app.findFirstRecordByFilter(
          'control_members',
          'control_id = {:controlId} && user_id = {:targetId}',
          { controlId: controlId, targetId: targetUserId },
        )
      } catch (_) {
        return e.json(404, { message: 'Colaborador não encontrado neste controle.' })
      }
    }

    // 3. Find target user
    let userRecord
    try {
      userRecord = $app.findRecordById('users', targetUserId)
    } catch (_) {
      return e.json(404, { message: 'Usuário não encontrado.' })
    }

    if (newName && typeof newName === 'string' && newName.trim()) {
      userRecord.set('name', newName.trim())
    }

    if (newPassword && typeof newPassword === 'string' && newPassword.length >= 8) {
      userRecord.setPassword(newPassword)
    } else if (newPassword && typeof newPassword === 'string' && newPassword.length < 8) {
      return e.json(400, { message: 'A nova senha deve possuir no mínimo 8 caracteres.' })
    }

    try {
      $app.save(userRecord)
      return e.json(200, {
        success: true,
        user: {
          id: userRecord.id,
          name: userRecord.getString('name'),
          email: userRecord.getString('email'),
          avatar: userRecord.getString('avatar'),
        },
      })
    } catch (err) {
      return e.json(500, {
        message: 'Erro ao atualizar dados do usuário: ' + (err.message || String(err)),
      })
    }
  },
  $apis.requireAuth(),
)
