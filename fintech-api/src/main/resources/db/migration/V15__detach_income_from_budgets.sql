-- Income is not a budgeted activity in Budgee. The old Plaid ingestion path
-- auto-created $0 placeholder budgets for income categories (e.g. "Income",
-- "Paycheck") and assigned income transactions to them. Non-destructively
-- detach those assignments; the transactions themselves are untouched. After
-- this runs, the stale income-category budgets no longer have attached
-- transactions, so the user can delete them normally from the Budgets tab.
UPDATE transactions
SET budget_id = NULL, updated_at = NOW()
WHERE type = 'INCOME'
  AND budget_id IS NOT NULL;