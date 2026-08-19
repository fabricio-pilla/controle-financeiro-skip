migrate(
  (app) => {
    // Carlos Henrique (owner of Nexus & Aurora) — real user id.
    var carlosId = 'wgr2b9cd097862r'

    // Demo companies affected by the invalid user_id bug.
    var nexusId = 'nyq6wvc7cbqf9u6' // Nexus Soluções Digitais
    var auroraId = '32eqpnwht9mpnch' // Aurora Comércio & Design

    // Reassign ALL transactions of both companies to Carlos (the owner).
    // Several rows currently hold boolean literals ("true"/"false") or other
    // invalid values in user_id; normalising every row to the owner keeps the
    // data consistent and attributable.
    app
      .db()
      .newQuery(
        'UPDATE transactions SET user_id = {:uid} ' + 'WHERE company_id IN ({:nexus}, {:aurora})',
      )
      .bind({ uid: carlosId, nexus: nexusId, aurora: auroraId })
      .execute()

    // Make sure the advertised demo login works. The seed created
    // carlos@empresa.com.br with password "12345678" (migration 0002_seed_demo)
    // and later "senha123" (migration 0002_seed_demo_data — skipped for Carlos
    // because he already existed). Reset the documented demo credentials to
    // "12345678" so carlos@empresa.com.br / 12345678 logs in.
    var resetPwd = function (email) {
      try {
        var rec = app.findAuthRecordByEmail('_pb_users_auth_', email)
        rec.setPassword('12345678')
        rec.setVerified(true)
        app.save(rec)
      } catch (_) {
        // user not found — nothing to reset
      }
    }
    resetPwd('carlos@empresa.com.br')
    resetPwd('marina@empresa.com.br')
    resetPwd('lucas@empresa.com.br')
  },
  (app) => {
    // Non-destructive rollback: the previous user_ids were never valid
    // (booleans / junk), so they cannot be reconstructed. Leaving every
    // transaction assigned to Carlos (the owner) is the correct end state.
  },
)
