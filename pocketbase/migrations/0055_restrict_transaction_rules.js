// pocketbase/migrations/0055_restrict_transaction_rules.js
// Migration to update access rules for transactions collection:
// - listRule & viewRule: active members of the control or control owner
// - createRule: active members with role != 'viewer' (or owner)
// - updateRule: owner/admin of control OR owner of the transaction (role != 'viewer')
// - deleteRule: owner/admin of control OR owner of the transaction (role != 'viewer')

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('transactions')

    // Rule for list / view: member of the control or control owner
    const isMemberRule =
      '@request.auth.id != "" && (' +
      'control_id.owner_id = @request.auth.id || ' +
      '@collection.control_members.control_id ?= control_id && @collection.control_members.user_id ?= @request.auth.id && @collection.control_members.status ?= "active"' +
      ')'

    // Rule for create: must be member with status active and role in ['owner', 'admin', 'member'], or control owner
    const canCreateRule =
      '@request.auth.id != "" && (' +
      'control_id.owner_id = @request.auth.id || ' +
      '(@collection.control_members.control_id ?= control_id && @collection.control_members.user_id ?= @request.auth.id && @collection.control_members.status ?= "active" && @collection.control_members.role ?!= "viewer")' +
      ')'

    // Rule for update / delete: admin or owner of the control, OR the creator of the transaction if they are not viewer
    const canManageRule =
      '@request.auth.id != "" && (' +
      'control_id.owner_id = @request.auth.id || ' +
      '(@collection.control_members.control_id ?= control_id && @collection.control_members.user_id ?= @request.auth.id && @collection.control_members.status ?= "active" && (@collection.control_members.role ?= "owner" || @collection.control_members.role ?= "admin")) || ' +
      '(user_id = @request.auth.id && @collection.control_members.control_id ?= control_id && @collection.control_members.user_id ?= @request.auth.id && @collection.control_members.status ?= "active" && @collection.control_members.role ?!= "viewer")' +
      ')'

    collection.listRule = isMemberRule
    collection.viewRule = isMemberRule
    collection.createRule = canCreateRule
    collection.updateRule = canManageRule
    collection.deleteRule = canManageRule

    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('transactions')
    collection.listRule = '@request.auth.id != ""'
    collection.viewRule = '@request.auth.id != ""'
    collection.createRule = '@request.auth.id != ""'
    collection.updateRule = '@request.auth.id != ""'
    collection.deleteRule = '@request.auth.id != ""'
    app.save(collection)
  },
)
