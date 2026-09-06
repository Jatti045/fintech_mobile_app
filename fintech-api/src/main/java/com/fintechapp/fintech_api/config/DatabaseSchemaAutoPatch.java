package com.fintechapp.fintech_api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.lang.NonNull;

@Component
@SuppressWarnings("SqlNoDataSourceInspection")
public class DatabaseSchemaAutoPatch implements ApplicationRunner {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseSchemaAutoPatch.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseSchemaAutoPatch(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(@NonNull ApplicationArguments args) {
        // Safety patch for month-scoped user income persistence.
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_monthly_incomes (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    month_start TIMESTAMP WITH TIME ZONE NOT NULL,
                    income DOUBLE PRECISION NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    CONSTRAINT fk_user_monthly_incomes_user
                        FOREIGN KEY (user_id) REFERENCES users(id),
                    CONSTRAINT uq_user_monthly_incomes_user_month
                        UNIQUE (user_id, month_start)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_monthly_incomes_user_month
                ON user_monthly_incomes(user_id, month_start)
                """);

        // Plaid integration schema.
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS plaid_items (
                    id VARCHAR(36) PRIMARY KEY,
                    item_id VARCHAR(128) NOT NULL,
                    access_token_encrypted TEXT NOT NULL,
                    institution_name VARCHAR(255),
                    cursor TEXT,
                    user_id VARCHAR(36) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_plaid_items_item_id UNIQUE (item_id),
                    CONSTRAINT fk_plaid_item_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id
                ON plaid_items(user_id)
                """);

        // Plaid item health fields used for hardened user feedback:
        // status (ACTIVE / REQUIRES_REAUTH), syncError, lastSyncedAt and the
        // timestamp an ITEM_LOGIN_REQUIRED error was received.
        jdbcTemplate.execute("""
                ALTER TABLE plaid_items
                ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
                """);
        jdbcTemplate.execute("""
                ALTER TABLE plaid_items
                ADD COLUMN IF NOT EXISTS sync_error BOOLEAN NOT NULL DEFAULT FALSE
                """);
        jdbcTemplate.execute("""
                ALTER TABLE plaid_items
                ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE
                """);
        jdbcTemplate.execute("""
                ALTER TABLE plaid_items
                ADD COLUMN IF NOT EXISTS reauth_requested_at TIMESTAMP WITH TIME ZONE
                """);
        jdbcTemplate.execute("""
                ALTER TABLE plaid_items
                ADD COLUMN IF NOT EXISTS sync_lock_token VARCHAR(64)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE plaid_items
                ADD COLUMN IF NOT EXISTS sync_lock_expires_at TIMESTAMP WITH TIME ZONE
                """);

        // Dead-letter queue for Plaid webhook payloads that could not be
        // processed. The webhook endpoint always acknowledges Plaid with 200,
        // so unprocessable payloads land here for manual inspection/replay.
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS failed_webhooks (
                    id VARCHAR(36) PRIMARY KEY,
                    item_id VARCHAR(128),
                    payload TEXT,
                    error_type VARCHAR(255),
                    error_message VARCHAR(2000),
                    stack_trace TEXT,
                    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_failed_webhooks_received_at
                ON failed_webhooks(received_at)
                """);
        // Idempotency key for Plaid-synced transactions (column on existing table).
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS plaid_transaction_id VARCHAR(128)
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_plaid_id
                ON transactions(plaid_transaction_id)
                WHERE plaid_transaction_id IS NOT NULL
                """);

        // Internal transfers (movement between the user's own accounts) must
        // never count toward income or expense analytics.
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN NOT NULL DEFAULT FALSE
                """);

        // The reconnect/pending deduplication columns were removed — drop the
        // leftovers from databases created before the removal. plaid_item_id
        // was dropped once for the old reconnect scheme but is now re-introduced
        // below as the account/institution ownership key.
        jdbcTemplate.execute("""
                ALTER TABLE transactions DROP COLUMN IF EXISTS plaid_pending_transaction_id
                """);
        jdbcTemplate.execute("""
                DROP INDEX IF EXISTS idx_transactions_plaid_item
                """);

        // Persist the Plaid account and Plaid item (financial institution
        // connection) each transaction was synchronized from. Nullable:
        // historical transactions predate these columns and are not backfilled.
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS plaid_account_id VARCHAR(128)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS plaid_item_id VARCHAR(128)
                """);
        // Plaid's personal_finance_category.detailed code (e.g.
        // TRANSFER_*_ACCOUNT_TRANSFER vs TRANSFER_*_THIRD_PARTY_P2P). Nullable:
        // persisted for new transactions only; used to gate transfer pairing.
        jdbcTemplate.execute("""
                ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS plaid_pfc_detailed VARCHAR(128)
                """);

        // Ownership-scoped lookup for proof-based internal-transfer pairing.
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_transactions_user_plaid_item
                ON transactions(user_id, plaid_item_id)
                """);

        // Icons were removed from budgets and transactions — drop the leftover
        // columns from databases created before the removal.
        jdbcTemplate.execute("""
                ALTER TABLE budgets DROP COLUMN IF EXISTS icon
                """);
        jdbcTemplate.execute("""
                ALTER TABLE transactions DROP COLUMN IF EXISTS icon
                """);

        // Income transactions may exist without a budget, so budget_id is now
        // nullable (previously NOT NULL).
        jdbcTemplate.execute("""
                ALTER TABLE transactions ALTER COLUMN budget_id DROP NOT NULL
                """);

        // Auto-created Plaid categories are flagged as unbudgeted until the user
        // assigns a limit.
        jdbcTemplate.execute(
                """
                        ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_auto_created BOOLEAN NOT NULL DEFAULT FALSE
                        """);

        // The legacy goals feature was removed (V17). Ensure obsolete constraints,
        // columns, and tables are dropped idempotently on startup.
        jdbcTemplate.execute("""
                ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transaction_goal
                """);
        jdbcTemplate.execute("""
                ALTER TABLE transactions DROP COLUMN IF EXISTS goal_id
                """);
        jdbcTemplate.execute("""
                DROP TABLE IF EXISTS goal_allocations
                """);
        jdbcTemplate.execute("""
                DROP TABLE IF EXISTS goals
                """);

        // Budget uniqueness invariant: at most one budget per
        // (user_id, category, date) — `date` holds the first day of
        // the month at 00:00 UTC. V18 migration mirrors this patch.
        // Idempotent duplicate reconciliation FIRST (re-point
        // transactions to the deterministic keeper, merge spent,
        // delete the duplicate rows), then the constraint itself.
        jdbcTemplate.execute("""
                WITH ranked AS (
                    SELECT id, user_id, category, date, is_auto_created, created_at,
                           ROW_NUMBER() OVER (
                               PARTITION BY user_id, category, date
                               ORDER BY is_auto_created ASC, created_at ASC, id ASC
                           ) AS rn
                    FROM budgets
                ),
                keeper AS (
                    SELECT id AS keeper_id, user_id, category, date
                    FROM ranked WHERE rn = 1
                ),
                dupe AS (
                    SELECT id AS dupe_id, user_id, category, date
                    FROM ranked WHERE rn > 1
                )
                UPDATE transactions t
                SET budget_id = k.keeper_id, updated_at = NOW()
                FROM dupe d
                JOIN keeper k
                  ON k.user_id = d.user_id AND k.category = d.category AND k.date = d.date
                WHERE t.budget_id = d.dupe_id
                """);
        jdbcTemplate.execute("""
                WITH ranked AS (
                    SELECT id, user_id, category, date, is_auto_created, created_at,
                           ROW_NUMBER() OVER (
                               PARTITION BY user_id, category, date
                               ORDER BY is_auto_created ASC, created_at ASC, id ASC
                           ) AS rn
                    FROM budgets
                ),
                keeper AS (
                    SELECT id AS keeper_id, user_id, category, date
                    FROM ranked WHERE rn = 1
                ),
                dupe AS (
                    SELECT id AS dupe_id, user_id, category, date
                    FROM ranked WHERE rn > 1
                ),
                dupe_totals AS (
                    SELECT k.keeper_id, COALESCE(SUM(b.spent), 0) AS dupe_spent
                    FROM dupe d
                    JOIN keeper k
                      ON k.user_id = d.user_id AND k.category = d.category AND k.date = d.date
                    JOIN budgets b ON b.id = d.dupe_id
                    GROUP BY k.keeper_id
                )
                UPDATE budgets kb
                SET spent = kb.spent + dt.dupe_spent, updated_at = NOW()
                FROM dupe_totals dt
                WHERE kb.id = dt.keeper_id
                """);
        jdbcTemplate.execute("""
                WITH ranked AS (
                    SELECT id, user_id, category, date, is_auto_created, created_at,
                           ROW_NUMBER() OVER (
                               PARTITION BY user_id, category, date
                               ORDER BY is_auto_created ASC, created_at ASC, id ASC
                           ) AS rn
                    FROM budgets
                ),
                dupe AS (
                    SELECT id AS dupe_id
                    FROM ranked WHERE rn > 1
                )
                DELETE FROM budgets b
                USING dupe d
                WHERE b.id = d.dupe_id
                """);
        jdbcTemplate.execute("""
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
                $$
                """);

        logger.info("Database schema patch check completed for user_monthly_incomes, plaid_items, transactions");
    }
}
