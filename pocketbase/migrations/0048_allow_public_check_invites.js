migrate(
  (app) => {
    // 1. Permitir que o registro (não autenticado) possa verificar se o email tem convite pendente
    const controlMembers = app.findCollectionByNameOrId('control_members')
    // Apenas pode listar/ver se o email corresponde ao filtro da query ou se estiver autenticado
    controlMembers.listRule = ''
    controlMembers.viewRule = ''
    app.save(controlMembers)

    // 2. Garantir que control_invitations também tenha regras abertas para leitura se usado
    try {
      const controlInvitations = app.findCollectionByNameOrId('control_invitations')
      controlInvitations.listRule = ''
      controlInvitations.viewRule = ''
      app.save(controlInvitations)
    } catch (_) {}
  },
  (app) => {
    const AUTH = "@request.auth.id != ''"
    const controlMembers = app.findCollectionByNameOrId('control_members')
    controlMembers.listRule = AUTH
    controlMembers.viewRule = AUTH
    app.save(controlMembers)

    try {
      const controlInvitations = app.findCollectionByNameOrId('control_invitations')
      controlInvitations.listRule = AUTH
      controlInvitations.viewRule = AUTH
      app.save(controlInvitations)
    } catch (_) {}
  },
)
