-- Guarantees, enforced by the database itself, that a user can never hold more
-- than one budget for the same category and month:
--
--     UNIQUE (user_id, category, date)
--
-- Budgets' `date` column always stores the first day of the month at 00:00 UTC
-- (every creation path normalizes it), so this tuple is the application's
-- identity of "user + category + month". Without the constraint, two
-- concurrent Plaid syncs for DIFFERENT items of the same user (the per-item
-- sync lock only serializes the same item) could both pass the check-then-
-- insert lookup and insert duplicate budgets for the same category/month.
--
-- The migration first reconciles any duplicates that earlier races may have
-- already persisted. Reconciliation is deterministic and non-destructive:
--   1. Keeper row per duplicate group: a manually configured budget
--      (is_auto_created = FALSE) wins; ties break on oldest created_at, then
--      smallest id.
--   2. Transactions attached to duplicate rows are re-pointed to the keeper.
--   3. The duplicates' spent aggregates are merged into the keeper's.
--   4. The duplicate rows are deleted. No transaction or spending history is
--      lost — only the redundant duplicate budget rows are removed.
--
-- Idempotent; also applied at startup by DatabaseSchemaAutoPatch (this project
-- does not execute Flyway at boot).

-- Step 1 — re-point transactions from duplicate budgets to their keeper.
WITH ranked AS (
    SELECT id,
           user_id,
           category,
           date,
           is_auto_created,
           created_at,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, category, date
               ORDER BY is_auto_created ASC, created_at ASC, id ASC
           ) AS rn
    FROM budgets
),
keeper AS (
    SELECT id AS keeper_id, user_id, category, date
    FROM ranked
    WHERE rn = 1
),
dupe AS (
    SELECT id AS dupe_id, user_id, category, date
    FROM ranked
    WHERE rn > 1
)
UPDATE transactions t
SET budget_id = k.keeper_id,
    updated_at = NOW()
FROM dupe d
JOIN keeper k
  ON k.user_id = d.user_id
 AND k.category = d.category
 AND k.date = d.date
WHERE t.budget_id = d.dupe_id;

-- Step 2 — merge the duplicates' spent aggregates into the keeper.
WITH ranked AS (
    SELECT id,
           user_id,
           category,
           date,
           is_auto_created,
           created_at,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, category, date
               ORDER BY is_auto_created ASC, created_at ASC, id ASC
           ) AS rn
    FROM budgets
),
keeper AS (
    SELECT id AS keeper_id, user_id, category, date
    FROM ranked
    WHERE rn = 1
),
dupe AS (
    SELECT id AS dupe_id, user_id, category, date
    FROM ranked
    WHERE rn > 1
),
dupe_totals AS (
    SELECT k.keeper_id, COALESCE(SUM(b.spent), 0) AS dupe_spent
    FROM dupe d
    JOIN keeper k
      ON k.user_id = d.user_id
     AND k.category = d.category
     AND k.date = d.date
    JOIN budgets b
      ON b.id = d.dupe_id
    GROUP BY k.keeper_id
)
UPDATE budgets kb
SET spent = kb.spent + dt.dupe_spent,
    updated_at = NOW()
FROM dupe_totals dt
WHERE kb.id = dt.keeper_id;

-- Step 3 — delete the now-orphaned duplicate budget rows.
WITH ranked AS (
    SELECT id,
           user_id,
           category,
           date,
           is_auto_created,
           created_at,
           ROW_NUMBER() OVER (
               PARTITION BY user_id, category, date
               ORDER BY is_auto_created ASC, created_at ASC, id ASC
           ) AS rn
    FROM budgets
),
dupe AS (
    SELECT id AS dupe_id
    FROM ranked
    WHERE rn > 1
)
DELETE FROM budgets b
USING dupe d
WHERE b.id = d.dupe_id;

-- Step 4 — add the unique constraint (skipped when it already exists).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_budgets_user_category_month'
          AND conrelid = 'budgets'::regclass
    ) THEN
        ALTER TABLE budgets
            ADD CONSTRAINT uq_budgets_user_category_month
            UNIQUE (user_id, category, date);
    END IF;
END
$$;
