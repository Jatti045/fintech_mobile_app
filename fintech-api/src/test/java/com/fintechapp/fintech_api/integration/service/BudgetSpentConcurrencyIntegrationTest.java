package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.transaction.CreateTransactionRequest;
import com.fintechapp.fintech_api.model.AuthProvider;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.service.CurrencyConversionService;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;
import com.fintechapp.fintech_api.service.TransactionService;

/**
 * Concurrency regression tests for the {@code budgets.spent} aggregate.
 *
 * <p>These tests deliberately do NOT use a test-managed transaction: each
 * operation must run in its own committed database transaction so that
 * genuinely concurrent writers race against the same persisted row. The
 * invariant under test is the final persisted {@code spent} value — with the
 * historical read-modify-write implementation these races lost updates; with
 * the atomic {@code UPDATE budgets SET spent = spent ± amount} implementation
 * every update must survive.</p>
 */
@SpringBootTest
@ActiveProfiles("test")
class BudgetSpentConcurrencyIntegrationTest {

    private static final Instant BUDGET_MONTH = Instant.parse("2026-08-01T00:00:00Z");
    private static final String TX_DATE = "2026-08-15T10:00:00Z";
    private static final String MANUAL_CATEGORY = "Groceries";
    private static final String PLAID_CATEGORY = "Food & Drink";

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private PlaidTransactionIngestService plaidTransactionIngestService;

    @Autowired
    private BudgetRepository budgetRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private org.springframework.transaction.PlatformTransactionManager transactionManager;

    @MockitoBean
    private CurrencyConversionService currencyConversionService;

    private User user;
    private AuthenticatedUser authUser;

    @BeforeEach
    void setUp() {
        // Deterministic same-currency pass-through: no live exchange-rate API.
        lenient().when(currencyConversionService.convert(any(Double.class), anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(0));

        String suffix = UUID.randomUUID().toString().substring(0, 8);
        user = new User();
        user.setEmail("concurrency-" + suffix + "@example.com");
        user.setPassword("irrelevant");
        user.setUsername("concurrency-" + suffix);
        user.setCurrency("USD");
        user.setAuthProvider(AuthProvider.EMAIL);
        user = userRepository.save(user);
        authUser = new AuthenticatedUser(user.getId(), user.getEmail(), 0L);
    }

    @AfterEach
    void tearDown() {
        // Derived delete queries need an active transaction — the test itself
        // is intentionally NOT transactional.
        org.springframework.transaction.support.TransactionTemplate txTemplate =
                new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        txTemplate.executeWithoutResult(status -> {
            transactionRepository.deleteByUser_Id(user.getId());
            budgetRepository.deleteByUser_Id(user.getId());
        });
        userRepository.deleteById(user.getId());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Budget createBudget(String category, double spent) {
        Budget budget = new Budget();
        budget.setUser(user);
        budget.setCategory(category);
        budget.setLimit(1000.0);
        budget.setSpent(spent);
        budget.setDate(BUDGET_MONTH);
        return budgetRepository.saveAndFlush(budget);
    }

    private String createExpense(String budgetId, double amount) {
        return transactionService
                .createTransaction(authUser, new CreateTransactionRequest(
                        "Concurrency " + UUID.randomUUID().toString().substring(0, 8),
                        7, 2026, TX_DATE, MANUAL_CATEGORY, "EXPENSE",
                        amount, null, budgetId, null, null, null))
                .data()
                .transaction()
                .id();
    }

    private double persistedSpent(Budget budget) {
        return budgetRepository.findById(budget.getId()).orElseThrow().getSpent();
    }

    /** Runs the given tasks concurrently and fails the test if any of them throws. */
    private void runConcurrently(List<Runnable> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        try {
            CountDownLatch startGate = new CountDownLatch(1);
            List<Future<?>> futures = new ArrayList<>();
            for (Runnable task : tasks) {
                futures.add(pool.submit(() -> {
                    startGate.await();
                    task.run();
                    return null;
                }));
            }
            startGate.countDown();
            for (Future<?> future : futures) {
                future.get(60, TimeUnit.SECONDS); // propagates task failures
            }
        } finally {
            pool.shutdownNow();
        }
    }

    // ── Concurrent increases ─────────────────────────────────────────────────

    @Test
    void twoConcurrentExpenseCreations_bothIncrementsSurvive() throws Exception {
        // spent = 100; thread A adds 20, thread B adds 30 → expected 150.
        Budget budget = createBudget(MANUAL_CATEGORY, 100.0);

        runConcurrently(List.of(
                () -> createExpense(budget.getId(), 20.0),
                () -> createExpense(budget.getId(), 30.0)));

        assertEquals(150.0, persistedSpent(budget), 0.0001,
                "Concurrent expense creations must not lose a spent update");
        assertEquals(2, transactionRepository.findByBudget_IdOrderByDateDesc(budget.getId()).size());
    }

    @Test
    void manyConcurrentExpenseCreations_noLostUpdate() throws Exception {
        // spent = 100; 10 threads each add 10 → expected 200.
        Budget budget = createBudget(MANUAL_CATEGORY, 100.0);

        List<Runnable> tasks = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            tasks.add(() -> createExpense(budget.getId(), 10.0));
        }
        runConcurrently(tasks);

        assertEquals(200.0, persistedSpent(budget), 0.0001,
                "Every concurrent increment must be reflected in the persisted aggregate");
    }

    // ── Concurrent reversals ─────────────────────────────────────────────────

    @Test
    void twoConcurrentDeletions_bothReversalsSurvive() throws Exception {
        // spent = 150 built from two expenses; deleting both concurrently
        // must restore 100 (both reversals reflected).
        Budget budget = createBudget(MANUAL_CATEGORY, 100.0);
        String txA = createExpense(budget.getId(), 20.0);
        String txB = createExpense(budget.getId(), 30.0);
        assertEquals(150.0, persistedSpent(budget), 0.0001);

        runConcurrently(List.of(
                () -> transactionService.deleteTransaction(authUser, txA),
                () -> transactionService.deleteTransaction(authUser, txB)));

        assertEquals(100.0, persistedSpent(budget), 0.0001,
                "Concurrent deletions must both reverse their spent contribution");
        assertTrue(transactionRepository.findByBudget_IdOrderByDateDesc(budget.getId()).isEmpty());
    }

    // ── Mixed increase/decrease ──────────────────────────────────────────────

    @Test
    void concurrentIncreaseAndDecrease_bothApplied() throws Exception {
        // Budget starts at 100; a +20 expense brings it to 120. Then a +30
        // creation overlaps the -20 reversal of deleting that expense → 130.
        Budget budget = createBudget(MANUAL_CATEGORY, 100.0);
        String existingTx = createExpense(budget.getId(), 20.0);
        assertEquals(120.0, persistedSpent(budget), 0.0001);

        runConcurrently(List.of(
                () -> createExpense(budget.getId(), 30.0),
                () -> transactionService.deleteTransaction(authUser, existingTx)));

        assertEquals(130.0, persistedSpent(budget), 0.0001,
                "Overlapping increase and decrease must net to the correct aggregate");
    }

    // ── Plaid ingestion concurrency ──────────────────────────────────────────

    private void ingestPlaidExpense(String plaidTransactionId, double amount) {
        plaidTransactionIngestService.upsertTransaction(user, new PlaidTransaction(
                plaidTransactionId,
                "Coffee Shop",
                Instant.parse("2026-08-15T10:00:00Z"),
                "FOOD_AND_DRINK",
                amount,
                false,
                "USD",
                null,
                "account-1",
                "item-1",
                null));
    }

    @Test
    void twoConcurrentPlaidIngestions_bothAmountsCounted() throws Exception {
        // spent = 100; two sync pages ingest 20 and 30 simultaneously → 150.
        Budget budget = createBudget(PLAID_CATEGORY, 100.0);

        runConcurrently(List.of(
                () -> ingestPlaidExpense("plaid-conc-1", 20.0),
                () -> ingestPlaidExpense("plaid-conc-2", 30.0)));

        assertEquals(150.0, persistedSpent(budget), 0.0001,
                "Concurrent Plaid ingestions must not lose a spent update");
    }

    @Test
    void concurrentManualCreationAndPlaidIngestion_bothApplied() throws Exception {
        // Manual transaction creation racing a Plaid sync page on one budget.
        // The Plaid transaction maps to the same category so both writers
        // target the same persisted budget row.
        Budget budget = createBudget(PLAID_CATEGORY, 100.0);

        runConcurrently(List.of(
                () -> createExpense(budget.getId(), 20.0),
                () -> ingestPlaidExpense("plaid-conc-3", 30.0)));

        assertEquals(150.0, persistedSpent(budget), 0.0001,
                "Manual creation and Plaid ingestion must not overwrite each other");
    }

    @Test
    void manyConcurrentPlaidIngestions_noLostUpdate() throws Exception {
        // spent = 0; 10 threads ingest 10 each → expected 100.
        Budget budget = createBudget(PLAID_CATEGORY, 0.0);

        List<Runnable> tasks = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            String id = "plaid-storm-" + i;
            tasks.add(() -> ingestPlaidExpense(id, 10.0));
        }
        runConcurrently(tasks);

        assertEquals(100.0, persistedSpent(budget), 0.0001);
        assertEquals(10, transactionRepository.findByBudget_IdOrderByDateDesc(budget.getId()).size());
    }
}
