package com.fintechapp.fintech_api.config;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;

class DatabaseSchemaAutoPatchTest {

    @Test
    void runsAllPatchesIncludingGoalsCleanup() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        DatabaseSchemaAutoPatch patch = new DatabaseSchemaAutoPatch(jdbcTemplate);

        patch.run(new DefaultApplicationArguments());

        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, atLeastOnce()).execute(captor.capture());

        List<String> executedSql = captor.getAllValues();
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("CREATE TABLE IF NOT EXISTS user_monthly_incomes")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("CREATE TABLE IF NOT EXISTS plaid_items")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("CREATE TABLE IF NOT EXISTS failed_webhooks")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("uq_transactions_plaid_id")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("is_transfer")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("DROP TABLE IF EXISTS goals")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("DROP TABLE IF EXISTS goal_allocations")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("DROP COLUMN IF EXISTS goal_id")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("DROP CONSTRAINT IF EXISTS fk_transaction_goal")));
        // Budget uniqueness invariant (V18): duplicate reconciliation plus the
        // unique constraint.
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("DELETE FROM budgets b")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("uq_budgets_user_category_month")));
        assertTrue(executedSql.stream().anyMatch(sql -> sql.contains("UNIQUE (user_id, category, date)")));
    }
}
