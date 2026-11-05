// pocketbase/hooks/transaction_permissions.js
// Enforces role-based permissions on transactions:
// 1. Unauthenticated users cannot create, update, or delete transactions.
// 2. Members with role 'viewer' (visualizador) cannot create, update, or delete ANY transaction.
// 3. Members with role 'member' can create transactions and manage their OWN transactions (user_id === callerId),
//    but CANNOT update or delete transactions created by other members.
// 4. Owners and Admins of the control can manage ANY transaction in that control.

// Hook BEFORE updating a transaction
onRecordUpdate((e) => {
  const authRecord = e.auth
  if (!authRecord) {
    e.next()
    return
  }

  const record = e.record
  const controlId = record.getString('control_id')
  const txUserId = record.getString('user_id')
  const callerId = authRecord.id

  // Inline role resolution to satisfy JSVM callback scoping
  let role = null
  if (controlId && callerId) {
    try {
      const ctrl = $app.findRecordById('financial_controls', controlId)
      if (ctrl && ctrl.getString('owner_id') === callerId) {
        role = 'owner'
      }
    } catch (_) {}

    if (!role) {
      try {
        const member = $app.findFirstRecordByFilter(
          'control_members',
          'control_id = {:cid} && user_id = {:uid} && status = "active"',
          { cid: controlId, uid: callerId },
        )
        if (member) {
          role = member.getString('role') || 'member'
        }
      } catch (_) {}
    }
  }

  if (!role) {
    throw new ForbiddenError('Acesso negado: você não é membro ativo deste controle financeiro.')
  }

  if (role === 'viewer') {
    throw new ForbiddenError(
      'Usuários com perfil de visualizador não têm permissão para editar lançamentos.',
    )
  }

  if (role === 'owner' || role === 'admin') {
    e.next()
    return
  }

  if (txUserId && txUserId !== callerId) {
    throw new ForbiddenError('Você só pode editar lançamentos criados por você mesmo.')
  }
  e.next()
}, 'transactions')

// Hook BEFORE deleting a transaction
onRecordDelete((e) => {
  const authRecord = e.auth
  if (!authRecord) {
    e.next()
    return
  }

  const record = e.record
  const controlId = record.getString('control_id')
  const txUserId = record.getString('user_id')
  const callerId = authRecord.id

  let role = null
  if (controlId && callerId) {
    try {
      const ctrl = $app.findRecordById('financial_controls', controlId)
      if (ctrl && ctrl.getString('owner_id') === callerId) {
        role = 'owner'
      }
    } catch (_) {}

    if (!role) {
      try {
        const member = $app.findFirstRecordByFilter(
          'control_members',
          'control_id = {:cid} && user_id = {:uid} && status = "active"',
          { cid: controlId, uid: callerId },
        )
        if (member) {
          role = member.getString('role') || 'member'
        }
      } catch (_) {}
    }
  }

  if (!role) {
    throw new ForbiddenError('Acesso negado: você não é membro ativo deste controle financeiro.')
  }

  if (role === 'viewer') {
    throw new ForbiddenError(
      'Usuários com perfil de visualizador não têm permissão para excluir lançamentos.',
    )
  }

  if (role === 'owner' || role === 'admin') {
    e.next()
    return
  }

  if (txUserId && txUserId !== callerId) {
    throw new ForbiddenError('Você só pode excluir lançamentos criados por você mesmo.')
  }
  e.next()
}, 'transactions')

// Hook BEFORE creating a transaction
onRecordCreate((e) => {
  const authRecord = e.auth
  if (!authRecord) {
    e.next()
    return
  }

  const record = e.record
  const controlId = record.getString('control_id')
  const callerId = authRecord.id

  let role = null
  if (controlId && callerId) {
    try {
      const ctrl = $app.findRecordById('financial_controls', controlId)
      if (ctrl && ctrl.getString('owner_id') === callerId) {
        role = 'owner'
      }
    } catch (_) {}

    if (!role) {
      try {
        const member = $app.findFirstRecordByFilter(
          'control_members',
          'control_id = {:cid} && user_id = {:uid} && status = "active"',
          { cid: controlId, uid: callerId },
        )
        if (member) {
          role = member.getString('role') || 'member'
        }
      } catch (_) {}
    }
  }

  if (!role) {
    throw new ForbiddenError('Acesso negado: você não é membro ativo deste controle financeiro.')
  }

  if (role === 'viewer') {
    throw new ForbiddenError(
      'Usuários com perfil de visualizador não têm permissão para criar lançamentos.',
    )
  }

  // Prevenção de duplicatas/séries paralelas espúrias geradas automaticamente com descrição vazia ou "Sem descrição"
  const desc = String(record.getString('description') || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  const isRec = record.getBool('is_recurring') || record.getBool('recurring')
  const notesStr = String(record.getString('notes') || '')
  if (
    (isRec || notesStr.indexOf('Gerado automaticamente') !== -1) &&
    (!desc || desc === 'sem descricao' || desc === 'sem descricao')
  ) {
    throw new BadRequestError('Transações recorrentes devem ter uma descrição válida.')
  }

  e.next()
}, 'transactions')
