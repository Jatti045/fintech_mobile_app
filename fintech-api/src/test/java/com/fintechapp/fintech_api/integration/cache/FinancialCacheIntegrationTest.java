package com.fintechapp.fintech_api.integration.cache;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.TransactionRepository;

/**
 * Verifies the Redis-backed server-side cache end to end against a real local
 * Redis (docker compose service {@code cache}) and the real PostgreSQL test
 * database.
 *
 * <p>
 * These tests are skipped when Redis is unreachable so ordinary test runs
 * never require Redis — the application falls back to PostgreSQL in that case
 * (covered by {@code FinancialCacheRedisUnavailableIntegrationTest}).
 * </p>
 *
 * <p>
 * Cache-hit evidence: the underlying {@code TransactionRepository} sum
 * aggregation (the summary's database work) is counted via a spy.
 * </p>
 */
class FinancialCacheIntegrationTest extends BaseIntegrationTest {

        @Autowired
        private StringRedisTemplate redisTemplate;

        @MockitoSpyBean
        private TransactionRepository spyTransactionRepository;

        private LocalDate utcToday;

        @BeforeEach
        void requireRedisAndCleanCache() {
                utcToday = LocalDate.now(ZoneOffset.UTC);
                Assumptions.assumeTrue(redisAvailable(), "Redis not reachable — cache tests skipped");
                redisTemplate.delete(redisTemplate.keys("financialSummary::*"));
                redisTemplate.delete(redisTemplate.keys("recurringPayments::*"));
        }

        private boolean redisAvailable() {
                try {
                        redisTemplate.getConnectionFactory().getConnection().ping();
                        return true;
                } catch (RuntimeException ex) {
                        return false;
                }
        }

        private int currentMonthIndex() {
                return utcToday.getMonthValue() - 1;
        }

        private int currentYear() {
                return utcToday.getYear();
        }

        private Instant monthStart(LocalDate month) {
                return month.withDayOfMonth(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        }

        // ── Miss → hit → mutation invalidation ──────────────────────────────────

        @Test
        void financialSummary_missThenHit_thenInvalidatedByTransactionCreation() throws Exception {
                User user = createUser("cache-summary@example.com", "Password123!", "cache-summary");
                Instant monthStart = monthStart(utcToday);
                Budget food = createBudget(user, "Food", 500, monthStart);
                createTransaction(user, food, "Groceries", monthStart.plusSeconds(3600), "Food",
                                TransactionType.EXPENSE, 100.0);
                createMonthlyIncome(user, monthStart, 4000.0);

                // Miss: the two SUM queries (expense + income) run and populate Redis.
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.totalAmount").value(100.0));
                verify(spyTransactionRepository, times(2))
                                .sumAmountByUserAndTypeAndDateBetween(anyString(), any(), any(), any());

                // Hit: identical request served from Redis — no additional database sums.
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(100.0));
                verify(spyTransactionRepository, times(2))
                                .sumAmountByUserAndTypeAndDateBetween(anyString(), any(), any(), any());

                // Mutation through the API evicts the cached month aggregate.
                String payload = asJson(new CreateTransactionPayload(
                                "Dinner", utcToday.toString(), "Food", "EXPENSE", 50.0, food.getId()));
                mockMvc.perform(post("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(payload))
                                .andExpect(status().isCreated());

                // Next read recomputes from PostgreSQL and reflects the new transaction.
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(150.0));
                verify(spyTransactionRepository, times(4))
                                .sumAmountByUserAndTypeAndDateBetween(anyString(), any(), any(), any());
        }

        // ── Month isolation (0-based month API convention) ──────────────────────

        @Test
        void financialSummary_monthIsolation_neverLeaksAcrossMonths() throws Exception {
                User user = createUser("cache-months@example.com", "Password123!", "cache-months");
                LocalDate thisMonth = utcToday.withDayOfMonth(1);
                LocalDate previousMonth = thisMonth.minusMonths(1);

                Budget foodThis = createBudget(user, "Food", 500, monthStart(thisMonth));
                createTransaction(user, foodThis, "Snacks", monthStart(thisMonth).plusSeconds(3600), "Food",
                                TransactionType.EXPENSE, 120.0);
                Budget foodPrev = createBudget(user, "Food", 500, monthStart(previousMonth));
                createTransaction(user, foodPrev, "Snacks", monthStart(previousMonth).plusSeconds(3600), "Food",
                                TransactionType.EXPENSE, 300.0);

                // month=8 means September (0-based, 0 = January); the previous month
                // must never answer for it and vice versa.
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(thisMonth.getMonthValue() - 1))
                                .param("year", String.valueOf(thisMonth.getYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(120.0));

                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(previousMonth.getMonthValue() - 1))
                                .param("year", String.valueOf(previousMonth.getYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(300.0));

                // The current month is still served from its own cache entry.
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(thisMonth.getMonthValue() - 1))
                                .param("year", String.valueOf(thisMonth.getYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(120.0));

                // Two distinct user-scoped month keys exist in Redis.
                Set<String> keys = redisTemplate.keys("financialSummary::" + user.getId() + ":*");
                Assertions.assertEquals(2, keys == null ? 0 : keys.size());
        }

        // ── User isolation ──────────────────────────────────────────────────────

        @Test
        void financialSummary_userIsolation_neverLeaksAcrossUsers() throws Exception {
                User userA = createUser("cache-user-a@example.com", "Password123!", "cache-user-a");
                User userB = createUser("cache-user-b@example.com", "Password123!", "cache-user-b");
                Instant monthStart = monthStart(utcToday);
                Budget foodA = createBudget(userA, "Food", 500, monthStart);
                createTransaction(userA, foodA, "A's expense", monthStart.plusSeconds(3600), "Food",
                                TransactionType.EXPENSE, 100.0);
                Budget foodB = createBudget(userB, "Food", 500, monthStart);
                createTransaction(userB, foodB, "B's expense", monthStart.plusSeconds(3600), "Food",
                                TransactionType.EXPENSE, 250.0);

                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(userA))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(100.0));

                // User B must see only B's data, even after A populated the cache.
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(userB))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(250.0));

                // User A's cached entry is untouched by B's request.
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(userA))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(100.0));

                Set<String> keysA = redisTemplate.keys("financialSummary::" + userA.getId() + ":*");
                Set<String> keysB = redisTemplate.keys("financialSummary::" + userB.getId() + ":*");
                Assertions.assertEquals(1, keysA == null ? 0 : keysA.size());
                Assertions.assertEquals(1, keysB == null ? 0 : keysB.size());
        }

        // ── Income baseline change invalidates the user's whole summary region ──

        @Test
        void monthlyIncomeUpdate_invalidatesCachedSummaryRegion() throws Exception {
                User user = createUser("cache-income@example.com", "Password123!", "cache-income");
                Instant monthStart = monthStart(utcToday);
                Budget food = createBudget(user, "Food", 500, monthStart);
                createTransaction(user, food, "Groceries", monthStart.plusSeconds(3600), "Food",
                                TransactionType.EXPENSE, 100.0);
                createMonthlyIncome(user, monthStart, 3000.0);

                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.expectedIncome").value(3000.0));

                mockMvc.perform(patch("/api/users/me/monthly-income")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(new UpdateMonthlyIncomePayload(4200.0, currentMonthIndex(),
                                                currentYear()))))
                                .andExpect(status().isOk());

                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.expectedIncome").value(4200.0));
        }

        // ── Recurring payments: expensive read is cached and evicted ────────────

        @Test
        void recurringPayments_missThenHit_thenInvalidatedByTransactionCreation() throws Exception {
                User user = createUser("cache-recurring@example.com", "Password123!", "cache-recurring");
                // Four monthly "Rent" occurrences, most recent one month ago.
                for (int i = 1; i <= 4; i++) {
                        createTransaction(user, null, "Rent",
                                        utcToday.withDayOfMonth(1).minusMonths(i).atStartOfDay()
                                                        .toInstant(ZoneOffset.UTC),
                                        "RENT", TransactionType.EXPENSE, 1450.00);
                }

                mockMvc.perform(get("/api/recurring-payments")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.recurringPayments", hasSize(1)))
                                .andExpect(jsonPath("$.data.recurringPayments[0].name").value("Rent"));
                verify(spyTransactionRepository, times(1))
                                .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(anyString(), any(), any());

                mockMvc.perform(get("/api/recurring-payments")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.recurringPayments", hasSize(1)));
                verify(spyTransactionRepository, times(1))
                                .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(anyString(), any(), any());

                // This month's Rent posts through the API → cache must be evicted.
                Budget rent = createBudget(user, "RENT", 0, monthStart(utcToday));
                String payload = asJson(new CreateTransactionPayload(
                                "Rent", utcToday.toString(), "RENT", "EXPENSE", 1450.00, rent.getId()));
                mockMvc.perform(post("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(payload))
                                .andExpect(status().isCreated());

                mockMvc.perform(get("/api/recurring-payments")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.recurringPayments", hasSize(1)))
                                .andExpect(jsonPath("$.data.recurringPayments[0].occurrences").value(5));
                verify(spyTransactionRepository, times(2))
                                .findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(anyString(), any(), any());
        }

        @Test
        void currencyUpdate_invalidatesCachedSummaryRegionAndRecurringPayments() throws Exception {
                User user = createUser("cache-currency-evict@example.com", "Password123!", "cache-currency-evict");
                Instant monthStart = monthStart(utcToday);
                createMonthlyIncome(user, monthStart, 3500.0);

                // Populate financialSummary cache
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(currentMonthIndex()))
                                .param("year", String.valueOf(currentYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.expectedIncome").value(3500.0));

                // Populate recurringPayments cache
                mockMvc.perform(get("/api/recurring-payments")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk());

                Set<String> summaryKeys = redisTemplate.keys("financialSummary::" + user.getId() + ":*");
                Set<String> recurringKeys = redisTemplate.keys("recurringPayments::" + user.getId());
                Assertions.assertEquals(1, summaryKeys == null ? 0 : summaryKeys.size());
                Assertions.assertEquals(1, recurringKeys == null ? 0 : recurringKeys.size());

                // Update currency
                mockMvc.perform(patch("/api/users/me/currency")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("currency", "eur"))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.currency").value("EUR"));

                // Verify Redis caches are evicted
                Set<String> summaryKeysAfter = redisTemplate.keys("financialSummary::" + user.getId() + ":*");
                Set<String> recurringKeysAfter = redisTemplate.keys("recurringPayments::" + user.getId());
                Assertions.assertEquals(0, summaryKeysAfter == null ? 0 : summaryKeysAfter.size());
                Assertions.assertEquals(0, recurringKeysAfter == null ? 0 : recurringKeysAfter.size());
        }

        // ── Test-only payload shapes (match the API records) ────────────────────

        record CreateTransactionPayload(
                        String name, String date, String category, String type, double amount, String budgetId) {
        }

        record UpdateMonthlyIncomePayload(double monthlyIncome, Integer month, Integer year) {
        }
}
