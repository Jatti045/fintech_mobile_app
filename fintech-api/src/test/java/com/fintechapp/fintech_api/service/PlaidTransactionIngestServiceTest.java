package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

@ExtendWith(MockitoExtension.class)
class PlaidTransactionIngestServiceTest {

    // Indexes into the SQL args captured from the native INSERT.
    private static final int IDX_NAME = 1;
    private static final int IDX_DATE = 2;
    private static final int IDX_CATEGORY = 3;
    private static final int IDX_TYPE = 4;
    private static final int IDX_AMOUNT = 5;
    private static final int IDX_BASE_CURRENCY = 6;
    private static final int IDX_ORIGINAL_AMOUNT = 7;
    private static final int IDX_ORIGINAL_CURRENCY = 8;
    private static final int IDX_PLAID_TX_ID = 9;
    private static final int IDX_PLAID_ACCOUNT_ID = 10;
    private static final int IDX_PLAID_ITEM_ID = 11;
        private static final int IDX_IS_TRANSFER = 12;
    private static final int IDX_PLAID_PFC_DETAILED = 13;
    private static final int IDX_USER_ID = 14;
    private static final int IDX_BUDGET_ID = 15;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private BudgetRepository budgetRepository;

    @Mock
    private PlaidCategoryFormatter categoryFormatter;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private CurrencyConversionService currencyConversionService;

    private PlaidTransactionIngestService service;

    @BeforeEach
    void setUp() {
        service = new PlaidTransactionIngestService(
                transactionRepository, budgetRepository, categoryFormatter, jdbcTemplate, currencyConversionService);
        lenient().when(currencyConversionService.convert(any(Double.class), any(String.class), any(String.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        lenient().when(categoryFormatter.toReadableCategory(any())).thenReturn("Food & Drink");
    }

    private User user() {
        User u = new User();
        u.setId("user-1");
        u.setCurrency("CAD");
        return u;
    }

        private PlaidTransaction plaidTx(
            String id, String name, String category, double amount, Instant date,
            String iso, String unofficial) {
        return new PlaidTransaction(id, name, date, category, amount, false, iso, unofficial, null, null, null);
    }

    /** A transfer between the user's own accounts (e.g. Checking → Savings). */
    private PlaidTransaction plaidTransfer(String id, double amount, Instant date, String iso) {
        return new PlaidTransaction(id, "Transfer", date, "Transfer", amount, true, iso, null, null, null, "TRANSFER_TRANSFER_ACCOUNT_TRANSFER");
    }

    private void upsert(PlaidTransaction plaidTx) {
        service.upsertTransaction(user(), plaidTx);
    }

    /** Stubs the full INSERT path: no budget, native insert succeeds. */
    private void stubNewTransactionInsert() {
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(budgetRepository.saveAndFlush(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
    }

    private List<Object> capturedInsertArgs() {
        ArgumentCaptor<Object[]> captor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).update(anyString(), captor.capture());
        Object[] args = captor.getValue();
        return args == null ? List.of() : Arrays.asList(args);
    }

    private Budget budget(String id, double limit, double spent) {
        Budget b = new Budget();
        b.setId(id);
        b.setLimit(limit);
        b.setSpent(spent);
        return b;
    }

    private Transaction transaction(String plaidId, double amount, TransactionType type, Budget budget) {
        Transaction t = new Transaction();
        t.setPlaidTransactionId(plaidId);
        t.setAmount(amount);
        t.setType(type);
        t.setBudget(budget);
        return t;
    }

    // ── No-op guards ─────────────────────────────────────────────────────────

    @Test
    void upsertTransaction_nullPayload_isNoOp() {
        service.upsertTransaction(user(), null);
        verifyNoInteractions(transactionRepository, budgetRepository, jdbcTemplate);
    }

    @Test
    void upsertTransaction_blankTransactionId_isNoOp() {
        service.upsertTransaction(
                user(), plaidTx("  ", "Coffee", "Coffee", 5.0, Instant.now(), "USD", null));
        verifyNoInteractions(transactionRepository, budgetRepository, jdbcTemplate);
    }

    @Test
    void removeByPlaidIds_nullList_isNoOp() {
        service.removeByPlaidIds(null, "user-1");
        verifyNoInteractions(transactionRepository, budgetRepository);
    }

    @Test
    void removeByPlaidIds_emptyList_isNoOp() {
        service.removeByPlaidIds(List.of(), "user-1");
        verifyNoInteractions(transactionRepository, budgetRepository);
    }

    // ── New transaction + auto-created category ──────────────────────────────

    @Test
    void upsertTransaction_newExpense_autoCreatesZeroLimitBudgetAndIncrementsSpent() {
        stubNewTransactionInsert();

        upsert(plaidTx("t1", "Starbucks", "FOOD_AND_DRINK", 12.5, Instant.parse("2026-08-05T10:00:00Z"), "USD", null));

        ArgumentCaptor<Budget> flushCaptor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository).saveAndFlush(flushCaptor.capture());
        Budget created = flushCaptor.getValue();
        assertEquals(0.0, created.getLimit());
        assertTrue(created.isAutoCreated());
        assertEquals("Food & Drink", created.getCategory());

        // The created budget's spent is incremented atomically in the database.
        verify(budgetRepository).incrementSpent(created.getId(), 12.5);

        List<Object> args = capturedInsertArgs();
        assertEquals(TransactionType.EXPENSE.name(), args.get(IDX_TYPE));
        assertEquals(12.5, (Double) args.get(IDX_AMOUNT));
        assertEquals("t1", args.get(IDX_PLAID_TX_ID));
        assertEquals("user-1", args.get(IDX_USER_ID));
    }

    @Test
    void upsertTransaction_persistsPlaidAccountIdAndPlaidItemId() {
        stubNewTransactionInsert();

                PlaidTransaction plaidTx = new PlaidTransaction(
                "t-id", "Starbucks", Instant.parse("2026-08-05T10:00:00Z"), "FOOD_AND_DRINK",
                12.5, false, "USD", null, "account-123", "item-123", "FOOD_AND_DRINK_COFFEE");
        service.upsertTransaction(user(), plaidTx);

        List<Object> args = capturedInsertArgs();
        assertEquals("t-id", args.get(IDX_PLAID_TX_ID));
        assertEquals("account-123", args.get(IDX_PLAID_ACCOUNT_ID));
        assertEquals("item-123", args.get(IDX_PLAID_ITEM_ID));
        assertEquals("FOOD_AND_DRINK_COFFEE", args.get(IDX_PLAID_PFC_DETAILED));
    }

    @Test
    void upsertTransaction_newIncome_doesNotIncrementBudgetSpent() {
        stubNewTransactionInsert();

        // Negative amount => INCOME (money in).
        upsert(plaidTx("t2", "Paycheck", "Income", -3000.0, Instant.parse("2026-08-01T08:00:00Z"), "USD", null));

        ArgumentCaptor<Budget> budgetCaptor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository).saveAndFlush(budgetCaptor.capture());
        assertEquals(0.0, budgetCaptor.getValue().getSpent());

        List<Object> args = capturedInsertArgs();
        assertEquals(TransactionType.INCOME.name(), args.get(IDX_TYPE));
        assertEquals(3000.0, (Double) args.get(IDX_AMOUNT)); // absolute amount stored
    }

    @Test
    void upsertTransaction_newExpense_usesFormattedCategory() {
        stubNewTransactionInsert();

        upsert(plaidTx("t3", "Sushi", "Travel:Air Travel", 40.0, Instant.now(), "USD", null));

        List<Object> args = capturedInsertArgs();
        assertEquals("Food & Drink", args.get(IDX_CATEGORY));
    }

    @Test
    void upsertTransaction_blankName_fallsBackToCategory() {
        stubNewTransactionInsert();

        upsert(plaidTx("t4", "   ", "Coffee", 3.0, Instant.now(), "USD", null));

        List<Object> args = capturedInsertArgs();
        assertEquals("Food & Drink", args.get(IDX_NAME));
    }

    @Test
    void upsertTransaction_nullDate_usesEpoch() {
        stubNewTransactionInsert();

        upsert(plaidTx("t5", "Old", "Misc", 1.0, null, "USD", null));

        List<Object> args = capturedInsertArgs();
        assertEquals(Instant.EPOCH, ((java.sql.Timestamp) args.get(IDX_DATE)).toInstant());
    }


    // ── Currency resolution ──────────────────────────────────────────────────

    private void assertCurrency(String iso, String unofficial, String userCurrency, String expectedOriginal) {
        stubNewTransactionInsert();

        User u = user();
        u.setCurrency(userCurrency);
        service.upsertTransaction(
                u, plaidTx("c-" + iso + unofficial, "X", "X", 1.0, Instant.now(), iso, unofficial));

        List<Object> args = capturedInsertArgs();
        // resolveCurrency resolves the RAW Plaid source currency, persisted as
        // original_currency; the stored base_currency is the user's
        // aggregation currency, not the Plaid account currency.
        assertEquals(expectedOriginal, args.get(IDX_ORIGINAL_CURRENCY));
        assertEquals(
                userCurrency == null ? "USD" : userCurrency.toUpperCase(Locale.ROOT),
                args.get(IDX_BASE_CURRENCY));
    }

    @Test
    void resolveCurrency_isoCodeWins() {
        assertCurrency("CAD", "USD", "EUR", "CAD");
    }

    @Test
    void resolveCurrency_unofficialUsedWhenIsoBlank() {
        assertCurrency(null, "gbp", "EUR", "GBP");
    }

    @Test
    void resolveCurrency_userCurrencyWhenBothBlank() {
        assertCurrency(null, null, "cad", "CAD");
    }

    @Test
    void resolveCurrency_defaultsToUsdWhenEverythingBlank() {
        assertCurrency(null, null, null, "USD");
    }

    // ── Mixed-currency normalization (aggregation-currency invariant) ────────

    @Test
    void insert_foreignCurrencyTransaction_convertsAmountIntoUserAggregationCurrency() {
        stubNewTransactionInsert();
        // User aggregates in CAD; the Plaid account is USD. Deterministic
        // rate: 1 USD = 1.25 CAD.
        when(currencyConversionService.convert(100.0, "USD", "CAD")).thenReturn(125.0);

        upsert(plaidTx("t-mixed", "US Purchase", "FOOD_AND_DRINK", 100.0,
                Instant.parse("2026-08-05T10:00:00Z"), "USD", null));

        List<Object> args = capturedInsertArgs();
        // The stored aggregate amount is the CONVERTED value, never the raw one.
        assertEquals(125.0, (Double) args.get(IDX_AMOUNT));
        assertEquals("CAD", args.get(IDX_BASE_CURRENCY));
        // The raw Plaid values are preserved for display/audit.
        assertEquals(100.0, (Double) args.get(IDX_ORIGINAL_AMOUNT));
        assertEquals("USD", args.get(IDX_ORIGINAL_CURRENCY));
    }

    @Test
    void upsertTransaction_existingTransactionForeignCurrency_reconvertsIntoAggregationCurrency() {
        Budget existingBudget = budget("b1", 500.0, 50.0);
        Transaction existing = transaction("t-mixed", 50.0, TransactionType.EXPENSE, existingBudget);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("t-mixed", "user-1"))
                .thenReturn(Optional.of(existing));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.empty());
        lenient().when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(budgetRepository.saveAndFlush(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(currencyConversionService.convert(100.0, "USD", "CAD")).thenReturn(125.0);

        upsert(plaidTx("t-mixed", "US Purchase", "FOOD_AND_DRINK", 100.0,
                Instant.parse("2026-08-05T10:00:00Z"), "USD", null));

        // The update path normalizes exactly like the insert path: the stored
        // amount is the converted value in the user's aggregation currency.
        assertEquals(125.0, existing.getAmount(), 0.0001);
        assertEquals("CAD", existing.getBaseCurrency());
        assertEquals(100.0, existing.getOriginalAmount(), 0.0001);
        assertEquals("USD", existing.getOriginalCurrency());
    }

    // ── Existing budget matching ─────────────────────────────────────────────

    @Test
    void upsertTransaction_existingBudgetMatch_reusesBudget() {
        Budget existing = budget("b1", 500.0, 100.0);
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(existing));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        upsert(plaidTx("t6", "Lunch", "FOOD_AND_DRINK", 20.0, Instant.now(), "USD", null));

        // The existing budget is reused — spent adjusted atomically in the DB.
        verify(budgetRepository).incrementSpent("b1", 20.0);
    }

    @Test
    void upsertTransaction_caseInsensitiveBudgetMatch_reusesBudget() {
        Budget existing = budget("b2", 100.0, 10.0);
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(existing));
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        upsert(plaidTx("t7", "Dinner", "dinner", 15.0, Instant.now(), "USD", null));

        verify(budgetRepository).incrementSpent("b2", 15.0);
    }

    // ── Upsert conflict (row already exists → reconcile as update) ───────────

    @Test
    void upsertTransaction_duplicatePlaidId_updatesExistingTransaction() {
        Budget budget = budget("b3", 500.0, 30.0);
        Transaction existingTx = transaction("dup-1", 30.0, TransactionType.EXPENSE, budget);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0); // conflict
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("dup-1", "user-1"))
                .thenReturn(Optional.of(existingTx));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        // Same transaction re-sent with a NEW amount (modified).
        upsert(plaidTx("dup-1", "Lunch", "Food", 35.0, Instant.now(), "USD", null));

        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository, times(1)).save(txCaptor.capture());
        assertEquals(35.0, txCaptor.getValue().getAmount());
        // Spent adjusted by the diff (30 -> 35 = +5) atomically.
        verify(budgetRepository).incrementSpent("b3", 5.0);
    }

    @Test
    void upsertTransaction_modifiedAmountDecrease_adjustsSpentDown() {
        Budget budget = budget("b4", 500.0, 50.0);
        Transaction existingTx = transaction("dup-2", 40.0, TransactionType.EXPENSE, budget);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("dup-2", "user-1"))
                .thenReturn(Optional.of(existingTx));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        upsert(plaidTx("dup-2", "Lunch", "Food", 25.0, Instant.now(), "USD", null));

        verify(budgetRepository).decrementSpentClamped("b4", 15.0); // 50 - (40 - 25)
    }

    @Test
    void upsertTransaction_expenseConvertedToIncome_decrementsBudgetSpent() {
        Budget budget = budget("b5", 500.0, 80.0);
        Transaction existingTx = transaction("dup-3", 80.0, TransactionType.EXPENSE, budget);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("dup-3", "user-1"))
                .thenReturn(Optional.of(existingTx));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        // Now the same transaction is an income (negative) — spent must be restored.
        upsert(plaidTx("dup-3", "Refund", "Food", -80.0, Instant.now(), "USD", null));

        verify(budgetRepository).decrementSpentClamped("b5", 80.0);
    }


    // ── Transfers between the user's own accounts ────────────────────────────

    @Test
    void upsertTransaction_transferExpense_insertedWithoutBudgetOrSpent() {
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        // Checking → Savings: money leaves the account (positive Plaid amount
        // => expense-typed transfer).
        upsert(plaidTransfer("tr-1", 2000.0, Instant.parse("2026-08-05T10:00:00Z"), "USD"));

        List<Object> args = capturedInsertArgs();
        assertEquals(TransactionType.EXPENSE.name(), args.get(IDX_TYPE));
        assertEquals(Boolean.TRUE, args.get(IDX_IS_TRANSFER));
        assertNull(args.get(IDX_BUDGET_ID)); // never linked to a budget

        // No budget was auto-created and nothing incremented spent.
        verify(budgetRepository, never()).saveAndFlush(any(Budget.class));
        verify(budgetRepository, never()).save(any(Budget.class));
        verify(budgetRepository, never()).incrementSpent(anyString(), anyDouble());
        verify(budgetRepository, never()).decrementSpentClamped(anyString(), anyDouble());
    }

    @Test
    void upsertTransaction_transferIncome_insertedWithoutBudgetOrSpent() {
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);

        // Savings ← Checking: money enters the account (negative Plaid amount
        // => income-typed transfer).
        upsert(plaidTransfer("tr-2", -2000.0, Instant.parse("2026-08-05T10:00:00Z"), "USD"));

        List<Object> args = capturedInsertArgs();
        assertEquals(TransactionType.INCOME.name(), args.get(IDX_TYPE));
        assertEquals(Boolean.TRUE, args.get(IDX_IS_TRANSFER));
        assertNull(args.get(IDX_BUDGET_ID));
        verify(budgetRepository, never()).saveAndFlush(any(Budget.class));
        verify(budgetRepository, never()).save(any(Budget.class));
        verify(budgetRepository, never()).incrementSpent(anyString(), anyDouble());
        verify(budgetRepository, never()).decrementSpentClamped(anyString(), anyDouble());
    }

    @Test
    void upsertTransaction_transferModified_keepsOutOfBudget() {
        Transaction stored = transaction("tr-mod", 2000.0, TransactionType.EXPENSE, null);
        stored.setTransfer(true);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0); // conflict
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("tr-mod", "user-1"))
                .thenReturn(Optional.of(stored));

        // A transfer re-served in the modified array stays un-budgeted.
        upsert(plaidTransfer("tr-mod", 2000.0, Instant.parse("2026-08-05T10:00:00Z"), "USD"));

        verify(transactionRepository).save(stored);
        assertTrue(stored.isTransfer());
        assertNull(stored.getBudget());
        verify(budgetRepository, never()).save(any(Budget.class));
        verify(budgetRepository, never()).incrementSpent(anyString(), anyDouble());
        verify(budgetRepository, never()).decrementSpentClamped(anyString(), anyDouble());
    }

    @Test
    void upsertTransaction_expenseBecomesTransfer_restoresBudgetSpent() {
        Budget budget = budget("bt2", 500.0, 2000.0);
        Transaction stored = transaction("tr-conv", 2000.0, TransactionType.EXPENSE, budget);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0); // conflict
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("tr-conv", "user-1"))
                .thenReturn(Optional.of(stored));

        // Plaid re-categorized the row as a transfer — its old budget
        // contribution must be restored.
        upsert(plaidTransfer("tr-conv", 2000.0, Instant.parse("2026-08-05T10:00:00Z"), "USD"));

        verify(transactionRepository).save(stored);
        assertTrue(stored.isTransfer());
        assertNull(stored.getBudget());
        // The old budget contribution is restored with an atomic decrement.
        verify(budgetRepository).decrementSpentClamped("bt2", 2000.0);
    }


    // ── Same transaction synced twice ────────────────────────────────────────

    @Test
    void upsertTransaction_sameTransactionTwice_persistsOnce() {
        Budget budget = budget("b11", 500.0, 0.0);
        Transaction stored = transaction("id-A", 5.0, TransactionType.EXPENSE, budget);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1, 0); // insert, then conflict
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("id-A", "user-1"))
                .thenReturn(Optional.of(stored));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        upsert(plaidTx("id-A", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null));
        upsert(plaidTx("id-A", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null));

        // One insert, then the conflict is reconciled as an update.
        verify(jdbcTemplate, times(2)).update(anyString(), any(Object[].class));
        verify(transactionRepository).save(stored);
    }

    @Test
    void upsertTransaction_multipleDuplicates_persistsOnceEach() {
        Budget budget = budget("b12", 500.0, 0.0);
        Transaction storedA = transaction("A", 5.0, TransactionType.EXPENSE, budget);
        Transaction storedB = transaction("B", 18.0, TransactionType.EXPENSE, budget);
        Transaction storedC = transaction("C", 12.0, TransactionType.EXPENSE, budget);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1, 1, 1, 0, 0, 0);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id(anyString(), eq("user-1")))
                .thenReturn(Optional.of(storedA), Optional.of(storedB), Optional.of(storedC));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        Instant date = Instant.parse("2026-01-10T00:00:00Z");
        upsert(plaidTx("A", "STARBUCKS", "Food", 5.0, date, "USD", null));
        upsert(plaidTx("B", "UBER", "Food", 18.0, date, "USD", null));
        upsert(plaidTx("C", "CVS", "Food", 12.0, date, "USD", null));
        // Second pass: each transaction is now recognized by its id and updated.
        upsert(plaidTx("A", "STARBUCKS", "Food", 5.0, date, "USD", null));
        upsert(plaidTx("B", "UBER", "Food", 18.0, date, "USD", null));
        upsert(plaidTx("C", "CVS", "Food", 12.0, date, "USD", null));

        // Exactly three inserts and three conflict-reconciled updates.
        verify(jdbcTemplate, times(6)).update(anyString(), any(Object[].class));
        verify(transactionRepository, times(3)).save(any(Transaction.class));
    }

    // ── Identical values, different ids ──────────────────────────────────────

    @Test
    void upsertTransaction_identicalValuesDifferentIds_sameItem_remainDistinct() {
        stubNewTransactionInsert();

        Instant date = Instant.parse("2026-01-10T00:00:00Z");
        upsert(plaidTx("id-1", "STARBUCKS", "Food", 5.0, date, "USD", null));
        upsert(plaidTx("id-2", "STARBUCKS", "Food", 5.0, date, "USD", null));

        // Both are inserted: two legitimate transactions with identical values.
        verify(jdbcTemplate, times(2)).update(anyString(), any(Object[].class));
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    // ── Insert conflict (existing row reconciles instead of duplicating) ─────

    @Test
    void upsertTransaction_insertConflict_reconcilesExistingRow() {
        Budget budget = budget("b16", 500.0, 5.0);
        Transaction stored = transaction("conf-1", 5.0, TransactionType.EXPENSE, budget);
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(0);
        when(transactionRepository.findByPlaidTransactionIdAndUser_Id("conf-1", "user-1"))
                .thenReturn(Optional.of(stored));
        when(budgetRepository.findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        eq("user-1"), anyString(), any(Instant.class), any(Instant.class)))
                .thenReturn(Optional.of(budget));

        upsert(plaidTx("conf-1", "STARBUCKS", "Food", 5.0, Instant.parse("2026-01-10T00:00:00Z"), "USD", null));

        verify(transactionRepository).save(stored); // reconciled as an update instead
        // Same amount -> no budget adjustment at all (no double increment).
        verify(budgetRepository, never()).incrementSpent(anyString(), anyDouble());
        verify(budgetRepository, never()).decrementSpentClamped(anyString(), anyDouble());
    }


    // ── Removed transactions ─────────────────────────────────────────────────

    @Test
    void removeByPlaidIds_expenseTransactions_restoresBudgetSpentAndDeletes() {
        Budget budget = budget("b6", 500.0, 90.0);
        Transaction tx = transaction("rem-1", 40.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdInAndUser_Id(List.of("rem-1"), "user-1"))
                .thenReturn(List.of(tx));

        service.removeByPlaidIds(List.of("rem-1"), "user-1");

        // Atomic, zero-floored decrement restores the contribution.
        verify(budgetRepository).decrementSpentClamped("b6", 40.0);
        verify(transactionRepository).delete(tx);
    }

    @Test
    void removeByPlaidIds_incomeTransaction_doesNotTouchBudget() {
        Budget budget = budget("b7", 500.0, 30.0);
        Transaction tx = transaction("rem-2", 1000.0, TransactionType.INCOME, budget);
        when(transactionRepository.findByPlaidTransactionIdInAndUser_Id(List.of("rem-2"), "user-1"))
                .thenReturn(List.of(tx));

        service.removeByPlaidIds(List.of("rem-2"), "user-1");

        verifyNoInteractions(budgetRepository);
        verify(transactionRepository).delete(tx);
    }

    @Test
    void removeByPlaidIds_multipleTransactions_deletesAll() {
        Budget b1 = budget("b8", 100.0, 10.0);
        Budget b2 = budget("b9", 100.0, 20.0);
        Transaction t1 = transaction("r1", 10.0, TransactionType.EXPENSE, b1);
        Transaction t2 = transaction("r2", 20.0, TransactionType.EXPENSE, b2);
        when(transactionRepository.findByPlaidTransactionIdInAndUser_Id(List.of("r1", "r2"), "user-1"))
                .thenReturn(List.of(t1, t2));

        service.removeByPlaidIds(List.of("r1", "r2"), "user-1");

        // Both reversals are applied atomically.
        verify(budgetRepository).decrementSpentClamped("b8", 10.0);
        verify(budgetRepository).decrementSpentClamped("b9", 20.0);
        verify(transactionRepository).delete(t1);
        verify(transactionRepository).delete(t2);
    }

    @Test
    void removeByPlaidIds_expenseBudgetSpentFloorsAtZero() {
        Budget budget = budget("b10", 100.0, 5.0);
        Transaction tx = transaction("rem-3", 50.0, TransactionType.EXPENSE, budget);
        when(transactionRepository.findByPlaidTransactionIdInAndUser_Id(List.of("rem-3"), "user-1"))
                .thenReturn(List.of(tx));

        service.removeByPlaidIds(List.of("rem-3"), "user-1");

        verify(budgetRepository).decrementSpentClamped("b10", 50.0); // floored at zero
        verify(transactionRepository).delete(tx);
    }
}
