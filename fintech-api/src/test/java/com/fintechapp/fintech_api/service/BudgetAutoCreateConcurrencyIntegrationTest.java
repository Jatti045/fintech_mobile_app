package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.fintechapp.fintech_api.model.AuthProvider;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

/**
 * Regression tests for the database-enforced budget uniqueness invariant:
 * at most one budget per (user, category, month).
 *
 * <p>Background: two Plaid syncs for <em>different</em> items of the same user
 * are not serialized by the per-item sync lock. Before the fix, both could
 * pass the check-then-insert lookup in
 * {@link PlaidTransactionIngestService#resolveOrCreateBudget} and insert
 * duplicate budgets for the same category/month. The fix adds the
 * {@code uq_budgets_user_category_month} unique constraint plus a native
 * {@code INSERT ... ON CONFLICT DO NOTHING} + re-query creation path.</p>
 *
 * <p>These tests deliberately do NOT use a test-managed transaction: each
 * operation must run in its own committed transaction so concurrent writers
 * genuinely race against the same rows (same approach as
 * BudgetSpentConcurrencyIntegrationTest).</p>
 */
@SpringBootTest
@ActiveProfiles("test")
class BudgetAutoCreateConcurrencyIntegrationTest {

    private static final Instant SEPTEMBER = Instant.parse("2026-09-01T00:00:00Z");
    private static final Instant OCTOBER = Instant.parse("2026-10-01T00:00:00Z");
    private static final String CATEGORY = "Food & Drink";

    @Autowired
    private PlaidTransactionIngestService ingestService;

    @Autowired
    private BudgetRepository budgetRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @MockitoBean
    private CurrencyConversionService currencyConversionService;

    private final List<User> createdUsers = new ArrayList<>();

    @BeforeEach
    void setUp() {
        // Deterministic same-currency pass-through: no live exchange-rate API.
        lenient().when(currencyConversionService.convert(any(Double.class), anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        for (User user : createdUsers) {
            txTemplate.executeWithoutResult(status -> {
                transactionRepository.deleteByUser_Id(user.getId());
                budgetRepository.deleteByUser_Id(user.getId());
            });
            userRepository.deleteById(user.getId());
        }
        createdUsers.clear();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private User newUser(String label) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        User user = new User();
        user.setEmail(label + "-" + suffix + "@example.com");
        user.setPassword("irrelevant");
        user.setUsername(label + "-" + suffix);
        user.setCurrency("USD");
        user.setAuthProvider(AuthProvider.EMAIL);
        user = userRepository.save(user);
        createdUsers.add(user);
        return user;
    }

    /** Runs the work in its own committed transaction (no test-managed tx). */
    private Budget inTx(Supplier<Budget> work) {
        return new TransactionTemplate(transactionManager).execute(status -> work.get());
    }

    private List<Budget> budgetsFor(User user) {
        return budgetRepository.findByUser_IdOrderByDateDesc(user.getId());
    }

    private void assertConstraintExists() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint "
                        + "WHERE conname = 'uq_budgets_user_category_month' "
                        + "AND conrelid = 'budgets'::regclass",
                Integer.class);
        assertEquals(1, count, "uq_budgets_user_category_month must exist on the budgets table");
    }

    /**
     * Runs the given tasks concurrently and waits for all to complete. The
     * start latch maximizes the chance all threads enter their transaction at
     * the same moment — a genuine race, not a sequential mock run.
     */
    private <T> List<T> runConcurrently(List<Callable<T>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch startLatch = new CountDownLatch(tasks.size());
        try {
            List<Future<T>> futures = new ArrayList<>();
            for (Callable<T> task : tasks) {
                futures.add(pool.submit(() -> {
                    startLatch.countDown();
                    startLatch.await(5, TimeUnit.SECONDS);
                    return task.call();
                }));
            }
            List<T> results = new ArrayList<>();
            for (Future<T> future : futures) {
                results.add(future.get(30, TimeUnit.SECONDS));
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }

    // ── Test 1 — sequential reuse ────────────────────────────────────────────

    @Test
    void sequentialResolveOrCreate_sameTuple_returnsSameBudget_singleRow() {
        assertConstraintExists();
        User user = newUser("seq");

        Budget first = inTx(() -> ingestService.resolveOrCreateBudget(user, CATEGORY, SEPTEMBER));
        Budget second = inTx(() -> ingestService.resolveOrCreateBudget(user, CATEGORY, SEPTEMBER));

        assertEquals(first.getId(), second.getId(), "Sequential lookups must reuse the same budget");
        assertEquals(1, budgetsFor(user).size(), "Exactly one budget row must exist");
        assertEquals(0.0, second.getLimit(), 0.0001); // auto-created zero budget
    }

    // ── Test 2 — concurrent creation (the critical race) ─────────────────────

    @Test
    void concurrentResolveOrCreate_sameTuple_singleRowBothCallersConverge() throws Exception {
        assertConstraintExists();
        // Five independent rounds: each round is a genuine two-writer race on
        // a fresh user/category/month tuple.
        for (int round = 0; round < 5; round++) {
            User user = newUser("race-" + round);

            List<Budget> results = runConcurrently(List.of(
                    () -> inTx(() -> ingestService.resolveOrCreateBudget(user, CATEGORY, SEPTEMBER)),
                    () -> inTx(() -> ingestService.resolveOrCreateBudget(user, CATEGORY, SEPTEMBER))));

            assertEquals(results.get(0).getId(), results.get(1).getId(),
                    "Both racing callers must converge on the same budget");
            assertEquals(1, budgetsFor(user).size(),
                    "Round " + round + ": the unique constraint must prevent a second budget row");
        }
    }

    // ── Test 3 — different Plaid items, same user/category/month ─────────────

    @Test
    void concurrentIngestFromDifferentPlaidItems_sameCategoryMonth_oneBudgetBothTransactionsLinked() throws Exception {
        assertConstraintExists();
        User user = newUser("items");

        runConcurrently(List.of(
                () -> new TransactionTemplate(transactionManager).execute(status -> {
                    ingestService.upsertTransaction(user, new PlaidTransactionIngestService.PlaidTransaction(
                            "race-item-a-tx", "Coffee Shop", Instant.parse("2026-09-10T10:00:00Z"),
                            "FOOD_AND_DRINK", 20.0, false, "USD", null, "account-a", "item-a", null));
                    return null;
                }),
                () -> new TransactionTemplate(transactionManager).execute(status -> {
                    ingestService.upsertTransaction(user, new PlaidTransactionIngestService.PlaidTransaction(
                            "race-item-b-tx", "Lunch", Instant.parse("2026-09-11T12:00:00Z"),
                            "FOOD_AND_DRINK", 30.0, false, "USD", null, "account-b", "item-b", null));
                    return null;
                })));

        List<Budget> budgets = budgetsFor(user);
        assertEquals(1, budgets.size(), "Two Plaid items must share one Food budget per month");
        Budget foodBudget = budgets.get(0);
        assertEquals(CATEGORY, foodBudget.getCategory());

        List<Transaction> transactions =
                transactionRepository.findByBudget_IdOrderByDateDesc(foodBudget.getId());
        assertEquals(2, transactions.size(), "Both transactions must be linked to the single budget");
        for (Transaction tx : transactions) {
            assertEquals(foodBudget.getId(), tx.getBudget().getId());
        }
        assertEquals(50.0, foodBudget.getSpent(), 0.0001,
                "Both expense amounts must be counted in the shared budget");
    }

    // ── Test 4 — different users are independent ─────────────────────────────

    @Test
    void concurrentResolveOrCreate_differentUsers_bothSucceed() throws Exception {
        assertConstraintExists();
        User userA = newUser("user-a");
        User userB = newUser("user-b");

        runConcurrently(List.of(
                () -> inTx(() -> ingestService.resolveOrCreateBudget(userA, CATEGORY, SEPTEMBER)),
                () -> inTx(() -> ingestService.resolveOrCreateBudget(userB, CATEGORY, SEPTEMBER))));

        assertEquals(1, budgetsFor(userA).size());
        assertEquals(1, budgetsFor(userB).size());
        assertNotEquals(budgetsFor(userA).get(0).getId(), budgetsFor(userB).get(0).getId());
    }

    // ── Test 5 — different categories are independent ────────────────────────

    @Test
    void resolveOrCreate_differentCategories_sameMonth_coexist() {
        assertConstraintExists();
        User user = newUser("cats");

        Budget food = inTx(() -> ingestService.resolveOrCreateBudget(user, CATEGORY, SEPTEMBER));
        Budget transport = inTx(() -> ingestService.resolveOrCreateBudget(user, "Transport", SEPTEMBER));

        assertNotEquals(food.getId(), transport.getId());
        assertEquals(2, budgetsFor(user).size());
    }

    // ── Test 6 — different months are independent ────────────────────────────

    @Test
    void resolveOrCreate_differentMonths_sameCategory_coexist() {
        assertConstraintExists();
        User user = newUser("months");

        Budget september = inTx(() -> ingestService.resolveOrCreateBudget(user, CATEGORY, SEPTEMBER));
        Budget october = inTx(() -> ingestService.resolveOrCreateBudget(user, CATEGORY, OCTOBER));

        assertNotEquals(september.getId(), october.getId());
        assertEquals(2, budgetsFor(user).size());
    }

    // ── Test 7 — existing budget is reused, not re-created ───────────────────

    @Test
    void resolveOrCreate_existingBudget_reusedWithoutInsertion() {
        assertConstraintExists();
        User user = newUser("existing");

        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        Budget existing = txTemplate.execute(status -> {
            Budget budget = new Budget();
            budget.setUser(user);
            budget.setCategory(CATEGORY);
            budget.setLimit(100.0);
            budget.setSpent(0);
            budget.setDate(SEPTEMBER);
            budget.setAutoCreated(false);
            return budgetRepository.saveAndFlush(budget);
        });

        Budget resolved = inTx(() -> ingestService.resolveOrCreateBudget(user, CATEGORY, SEPTEMBER));

        assertEquals(existing.getId(), resolved.getId(), "The existing budget must be reused");
        assertEquals(1, budgetsFor(user).size(), "No second budget row may be created");
        Budget reloaded = budgetsFor(user).get(0);
        assertEquals(100.0, reloaded.getLimit(), 0.0001,
                "The existing budget's limit must not be overwritten");
        assertTrue(!reloaded.isAutoCreated());
    }
}
