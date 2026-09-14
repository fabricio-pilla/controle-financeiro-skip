/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0044: Cleanup duplicate auto-generated recurring occurrences for empty/generic descriptions
 * and restore balance calculation on affected accounts.
 *
 * Specific issue:
 * Editing an empty-description / generic-description expense with amount 50.21 triggered
 * automatic future generation of 12 recurring records ("") for months 2026-10 through 2027-09.
 * This migration cleans up orphan future recurring items that have empty/generic descriptions
 * created between 2026-09-14 13:26:10 and 2026-09-14 13:26:20 on control y9ewjfbhzoihnq0,
 * and recomputes the account balance.
 */
migrate(
  (app) => {
    try {
      const recordsToDelete = app
        .db()
        .newQuery(
          `SELECT id, account_id FROM transactions
           WHERE control_id = 'y9ewjfbhzoihnq0'
             AND (description = '' OR LOWER(TRIM(description)) = 'sem descrição' OR LOWER(TRIM(description)) = 'sem descricao')
             AND is_recurring = 1
             AND created >= '2026-09-14 13:26:10'
             AND created <= '2026-09-14 13:26:20'`,
        )
        .all()

      const affectedAccountIds = new Set()

      for (const row of recordsToDelete) {
        if (row.account_id) {
          affectedAccountIds.add(row.account_id)
        }
        try {
          const rec = app.findRecordById('transactions', row.id)
          if (rec) {
            app.delete(rec)
          }
        } catch (e) {
          // record already gone or not found
        }
      }

      // Recompute balance for affected accounts if any
      for (const accountId of affectedAccountIds) {
        try {
          const acc = app.findRecordById('accounts', accountId)
          if (acc) {
            const initialBalance = Number(acc.get('initial_balance') || 0)

            // Sum paid incomes
            const incomeRes = app
              .db()
              .newQuery(
                `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
                 WHERE account_id = {:accId} AND type = 'income' AND paid = 1`,
              )
              .bind({ accId: accountId })
              .one()
            const totalIncome = Number(incomeRes?.total || 0)

            // Sum paid expenses
            const expenseRes = app
              .db()
              .newQuery(
                `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
                 WHERE account_id = {:accId} AND type = 'expense' AND paid = 1`,
              )
              .bind({ accId: accountId })
              .one()
            const totalExpense = Number(expenseRes?.total || 0)

            const newBalance = initialBalance + totalIncome - totalExpense
            acc.set('balance', newBalance)
            app.save(acc)
          }
        } catch (e) {
          // ignore account balance errors
        }
      }
    } catch (err) {
      console.log('Migration 0044 error:', err)
    }
  },
  (app) => {
    // Irreversible cleanup migration
  },
)
