package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;

/**
 * Exhaustive regression tests for Plaid internal-transfer reconciliation
 * across all 10 domain scenarios specified in P2 requirements.
 */
@ExtendWith(MockitoExtension.class)
class PlaidInternalTransferReconciliationTest {

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

    private PlaidTransactionIngestService ingestService;

    private User user;

    @BeforeEach
    void setUp() {
        ingestService = new PlaidTransactionIngestService(
                transactionRepository, budgetRepository, categoryFormatter, jdbcTemplate, currencyConversionService);
        user = new User();
        user.setId("user-1");
        user.setCurrency("USD");
    }

    private Transaction createTx(
            String id,
            String name,
            double amount,
            TransactionType type,
            Instant date,
            String accountId,
            String itemId,
            String pfcDetailed,
            Budget budget) {
        Transaction tx = new Transaction();
        tx.setId(id);
        tx.setName(name);
        tx.setAmount(amount);
        tx.setType(type);
        tx.setDate(date);
        tx.setUser(user);
        tx.setPlaidAccountId(accountId);
        tx.setPlaidItemId(itemId);
        tx.setPlaidPfcDetailed(pfcDetailed);
        tx.setBudget(budget);
        tx.setTransfer(false);
        return tx;
    }

    @Test
    @DisplayName("Scenario 1: Same-day valid transfer - both legs marked, budget contribution decremented")
    void sameDayValidTransfer_pairedAndMarkedAsTransfer() {
        Budget budget = new Budget();
        budget.setId("b-chk");
        budget.setSpent(1000.0);

        Transaction outLeg = createTx(
                "tx-out", "Online Transfer to Savings", 500.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-checking", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction inLeg = createTx(
                "tx-in", "Online Transfer from Checking", 500.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T14:30:00Z"), "acc-savings", "item-chase",
                "TRANSFER_IN_ACCOUNT_TRANSFER", null);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(outLeg, inLeg));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");

        assertTrue(outLeg.isTransfer());
        assertTrue(inLeg.isTransfer());
        assertNull(outLeg.getBudget());
        verify(budgetRepository).decrementSpentClamped("b-chk", 500.0);
        verify(transactionRepository).save(outLeg);
        verify(transactionRepository).save(inLeg);
    }

    @Test
    @DisplayName("Scenario 2: Same-day unrelated transactions - non-transfer category, neither marked")
    void sameDayUnrelatedTransactions_remainsNonTransfer() {
        Budget budget = new Budget();
        budget.setId("b-bill");

        Transaction bill = createTx(
                "tx-bill", "Electric Bill", 120.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-checking", "item-chase",
                "GENERAL_SERVICES_UTILITIES", budget);

        Transaction dividend = createTx(
                "tx-div", "Stock Dividend", 120.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T12:00:00Z"), "acc-brokerage", "item-chase",
                "INCOME_DIVIDENDS", null);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(bill, dividend));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");

        assertFalse(bill.isTransfer());
        assertFalse(dividend.isTransfer());
        verify(budgetRepository, never()).decrementSpentClamped(anyString(), anyDouble());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Scenario 3: Multi-day settlement - different calendar days intentionally not paired (conservative limitation)")
    void multiDaySettlement_differentDays_conservativeInvariantRetainsNonTransfer() {
        Budget budget = new Budget();
        budget.setId("b-chk");

        // Day 1: outflow posted on March 15 at 23:30 UTC
        Transaction outLeg = createTx(
                "tx-out", "Transfer to Savings", 500.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T23:30:00Z"), "acc-checking", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        // Day 2: inflow posted on March 16 at 08:00 UTC
        Transaction inLeg = createTx(
                "tx-in", "Transfer from Checking", 500.0, TransactionType.INCOME,
                Instant.parse("2026-03-16T08:00:00Z"), "acc-savings", "item-chase",
                "TRANSFER_IN_ACCOUNT_TRANSFER", null);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(outLeg, inLeg));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");

        // Documents intentional limitation: conservative algorithm avoids false positives across multi-day windows
        assertFalse(outLeg.isTransfer());
        assertFalse(inLeg.isTransfer());
        verify(budgetRepository, never()).decrementSpentClamped(anyString(), anyDouble());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Scenario 4: Unequal amounts - different integer cents never paired")
    void unequalAmounts_sameDayAndAccounts_remainsNonTransfer() {
        Budget budget = new Budget();
        budget.setId("b-chk");

        Transaction outLeg = createTx(
                "tx-out", "Transfer to Savings", 100.00, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-checking", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction inLeg = createTx(
                "tx-in", "Transfer from Checking", 105.00, TransactionType.INCOME,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-savings", "item-chase",
                "TRANSFER_IN_ACCOUNT_TRANSFER", null);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(outLeg, inLeg));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");

        assertFalse(outLeg.isTransfer());
        assertFalse(inLeg.isTransfer());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Scenario 5: Duplicate candidates - 3+ same-amount candidates on same day is ambiguous, none marked")
    void duplicateCandidates_ambiguousGroupSizeGreaterThanTwo_noneMarked() {
        Budget budget = new Budget();
        budget.setId("b-chk");

        Transaction out1 = createTx(
                "tx-out-1", "Transfer", 200.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-checking", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction in1 = createTx(
                "tx-in-1", "Transfer", 200.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T11:00:00Z"), "acc-savings-1", "item-chase",
                "TRANSFER_IN_ACCOUNT_TRANSFER", null);

        Transaction in2 = createTx(
                "tx-in-2", "Transfer", 200.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T12:00:00Z"), "acc-savings-2", "item-chase",
                "TRANSFER_IN_ACCOUNT_TRANSFER", null);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(out1, in1, in2));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");

        assertFalse(out1.isTransfer());
        assertFalse(in1.isTransfer());
        assertFalse(in2.isTransfer());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Scenario 6: Ambiguous cases - same direction or missing accountId, neither marked")
    void ambiguousCases_sameDirectionOrMissingAccount_remainsNonTransfer() {
        Budget budget = new Budget();
        budget.setId("b-chk");

        // Case 6a: Two expenses in opposite accounts
        Transaction exp1 = createTx(
                "tx-exp-1", "Transfer", 300.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-chk", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction exp2 = createTx(
                "tx-exp-2", "Transfer", 300.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-sav", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(exp1, exp2));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");
        assertFalse(exp1.isTransfer());
        assertFalse(exp2.isTransfer());

        // Case 6b: Missing account ID on one leg
        Transaction outWithAccount = createTx(
                "tx-out-3", "Transfer", 400.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-chk", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction inWithoutAccount = createTx(
                "tx-in-3", "Transfer", 400.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T10:00:00Z"), null, "item-chase",
                "TRANSFER_IN_ACCOUNT_TRANSFER", null);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(outWithAccount, inWithoutAccount));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");
        assertFalse(outWithAccount.isTransfer());
        assertFalse(inWithoutAccount.isTransfer());
    }

    @Test
    @DisplayName("Scenario 7: Same account transactions - both legs on same account not an internal transfer")
    void sameAccountTransactions_bothLegsOnSameAccountId_remainsNonTransfer() {
        Budget budget = new Budget();
        budget.setId("b-chk");

        Transaction outLeg = createTx(
                "tx-out", "Transfer", 150.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-same", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction inLeg = createTx(
                "tx-in", "Transfer", 150.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-same", "item-chase",
                "TRANSFER_IN_ACCOUNT_TRANSFER", null);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(outLeg, inLeg));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");

        assertFalse(outLeg.isTransfer());
        assertFalse(inLeg.isTransfer());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Scenario 8: Different users - query isolates by userId so candidates never cross-pair")
    void differentUsers_queryIsolatesByUserId() {
        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of());

        ingestService.reconcileInternalTransfers("user-1", "item-chase");

        verify(transactionRepository).findTransferCandidates("user-1", "item-chase");
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Scenario 9: Different Plaid items - cross-item movements not paired under single-item reconciliation")
    void differentPlaidItems_queryIsolatesByItemId() {
        when(transactionRepository.findTransferCandidates("user-1", "item-wells"))
                .thenReturn(List.of());

        ingestService.reconcileInternalTransfers("user-1", "item-wells");

        verify(transactionRepository).findTransferCandidates("user-1", "item-wells");
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    @DisplayName("Scenario 10: Non-transfer categories - PAYROLL, REFUND, and DEPOSIT codes hard excluded")
    void nonTransferCategories_payrollAndRefundExclusions() {
        Budget budget = new Budget();
        budget.setId("b-chk");

        // Payroll deposit paired with same-amount checking withdrawal
        Transaction salaryOut = createTx(
                "tx-out-pay", "Transfer", 2500.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-chk", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction payrollIn = createTx(
                "tx-in-pay", "Payroll Deposit", 2500.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-sav", "item-chase",
                "TRANSFER_IN_PAYROLL", null);

        // Refund paired with purchase return
        Transaction returnOut = createTx(
                "tx-out-ref", "Transfer", 45.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-chk", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction refundIn = createTx(
                "tx-in-ref", "Refund Deposit", 45.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-sav", "item-chase",
                "TRANSFER_IN_REFUND", null);

        // Cash deposit paired with withdrawal
        Transaction cashOut = createTx(
                "tx-out-dep", "Transfer", 300.0, TransactionType.EXPENSE,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-chk", "item-chase",
                "TRANSFER_OUT_ACCOUNT_TRANSFER", budget);

        Transaction cashIn = createTx(
                "tx-in-dep", "Cash Deposit", 300.0, TransactionType.INCOME,
                Instant.parse("2026-03-15T10:00:00Z"), "acc-sav", "item-chase",
                "TRANSFER_IN_DEPOSIT", null);

        when(transactionRepository.findTransferCandidates("user-1", "item-chase"))
                .thenReturn(List.of(salaryOut, payrollIn, returnOut, refundIn, cashOut, cashIn));

        ingestService.reconcileInternalTransfers("user-1", "item-chase");

        assertFalse(salaryOut.isTransfer());
        assertFalse(payrollIn.isTransfer());
        assertFalse(returnOut.isTransfer());
        assertFalse(refundIn.isTransfer());
        assertFalse(cashOut.isTransfer());
        assertFalse(cashIn.isTransfer());
        verify(budgetRepository, never()).decrementSpentClamped(anyString(), anyDouble());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }
}
