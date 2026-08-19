migrate(
  (app) => {
    // ------------------------------------------------------------------
    // Cleanup duplicated transactions.
    //
    // The demo data was seeded twice (0002_seed_demo and 0003_seed_demo_data),
    // producing two batches with identical (company_id, description, date,
    // amount) tuples. Migration 0004 already normalised every user_id to the
    // owner (wgr2b9cd097862r), so there are no longer any rows with the old
    // boolean user_ids — but the duplicated rows remain.
    //
    // We dedupe by the natural key (company_id, description, date, amount)
    // and keep the NEWEST insert of each group (MAX(rowid)). The newest rows
    // belong to the 0003 batch, which carries the correct is_recurring /
    // recurrence_type flags (the older batch wrongly marked everything as
    // recurring). After this, each company keeps a single, clean copy of
    // every transaction, all attributed to Carlos (the owner).
    // ------------------------------------------------------------------
    app
      .db()
      .newQuery(
        'DELETE FROM transactions ' +
          'WHERE rowid NOT IN (' +
          '  SELECT MAX(rowid) FROM transactions ' +
          '  GROUP BY company_id, description, date, amount' +
          ')',
      )
      .execute()

    // ------------------------------------------------------------------
    // Guarantee the documented demo login works for the three empresa users.
    // Password "12345678" + verified=true so they can sign in immediately.
    // ------------------------------------------------------------------
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
    // Non-destructive rollback: the deleted duplicates cannot be
    // reconstructed (they were exact copies of the surviving rows).
  },
)
