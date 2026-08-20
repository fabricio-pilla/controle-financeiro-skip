migrate(
  (app) => {
    // 1. Update users collection schema to set email visibility to true by default (if supported on fields)
    // and list/view rules if needed. In PocketBase v0.23+ auth collections, emailVisibility is on the auth collection or user records.
    // Update all existing user records to emailVisibility = true.
    app.db().newQuery('UPDATE users SET emailVisibility = 1').execute()

    // 2. Delete orphan "Casa" controls that have no control_members
    const orphanIds = [
      'c2pqa3lok8algri',
      '0th82d1jmp836tv',
      'tq2mjle0tqx29fo',
      'ejqz6w86ylgl81f',
      'j09z08ntejqo6ya',
    ]

    for (let i = 0; i < orphanIds.length; i++) {
      const id = orphanIds[i]
      try {
        // Also cleanup any linked sub-records defensively before deleting the control
        app
          .db()
          .newQuery('DELETE FROM control_members WHERE control_id = {:id}')
          .bind({ id })
          .execute()
        app
          .db()
          .newQuery('DELETE FROM control_invitations WHERE control_id = {:id}')
          .bind({ id })
          .execute()
        app.db().newQuery('DELETE FROM accounts WHERE control_id = {:id}').bind({ id }).execute()
        app
          .db()
          .newQuery('DELETE FROM credit_cards WHERE control_id = {:id}')
          .bind({ id })
          .execute()
        app.db().newQuery('DELETE FROM categories WHERE control_id = {:id}').bind({ id }).execute()
        app.db().newQuery('DELETE FROM budgets WHERE control_id = {:id}').bind({ id }).execute()
        app.db().newQuery('DELETE FROM goals WHERE control_id = {:id}').bind({ id }).execute()
        app
          .db()
          .newQuery('DELETE FROM transactions WHERE control_id = {:id}')
          .bind({ id })
          .execute()
        app.db().newQuery('DELETE FROM financial_controls WHERE id = {:id}').bind({ id }).execute()
      } catch (_) {}
    }
  },
  (app) => {
    // Rollback: restore emailVisibility to false
    app.db().newQuery('UPDATE users SET emailVisibility = 0').execute()
  },
)
