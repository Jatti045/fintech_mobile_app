package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class FinancialSummaryServiceTest {

    @Mock
    private IncomeCalculationService incomeCalculationService;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private UserRepository userRepository;

    private FinancialSummaryService service;

    private final User user = new User();

    @BeforeEach
    void setUp() {
        user.setId("user-1");
        service = new FinancialSummaryService(
                incomeCalculationService,
                transactionRepository,
                userRepository);
    }

    private void stubExpenseTotal(double value) {
        lenient().when(transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                        eq("user-1"), eq(TransactionType.EXPENSE), any(Instant.class), any(Instant.class)))
                .thenReturn(value);
    }

    private void stubIncome(double expected, double actual) {
        lenient().when(incomeCalculationService.resolveExpectedForMonth(eq(user), any(Integer.class), any(Integer.class)))
                .thenReturn(expected);
        lenient().when(incomeCalculationService.resolveActualForMonth(eq(user), any(Integer.class), any(Integer.class)))
                .thenReturn(actual);
    }

    @Test
    void resolveForMonth_sumsExpensesIntoTotalAmount() {
        stubExpenseTotal(250.0);
        stubIncome(1000.0, 0.0);

        FinancialSummaryData summary = service.resolveForMonth(user, 2026, 7);

        assertEquals(250.0, summary.totalAmount());
        assertEquals(250.0, summary.netSpent());
    }

    @Test
    void resolveForMonth_mixedCurrencyMonth_aggregatesNormalizedAmountsOnly() {
        // Currency-safety contract: the repository sums amounts that were
        // already normalized into the user's aggregation currency at ingestion
        // time. For a CAD user with 100 CAD + 100 USD of expenses (rate 1.25),
        // the sum is 100 + 125 = 225 — never the raw 200 under one currency.
        stubExpenseTotal(225.0);
        stubIncome(1000.0, 1000.0);

        FinancialSummaryData summary = service.resolveForMonth(user, 2026, 7);

        assertEquals(225.0, summary.totalAmount());
        // Net math runs on normalized values: normalized income - normalized
        // expenses.
        assertEquals(775.0, summary.netRemaining());
        assertEquals(22.5, summary.spentPercentageOfIncome());
    }

    @Test
    void resolveForMonth_usesExpectedIncomeWhenNoActualInflow() {
        stubExpenseTotal(200.0);
        stubIncome(4000.0, 0.0);

        FinancialSummaryData summary = service.resolveForMonth(user, 2026, 7);

        assertEquals(4000.0, summary.monthlyIncome());
        assertEquals(3800.0, summary.netRemaining());
        assertEquals(5.0, summary.spentPercentageOfIncome());
    }

    @Test
    void resolveForMonth_usesActualInflowWhenPresent() {
        stubExpenseTotal(200.0);
        stubIncome(4000.0, 3000.0);

        FinancialSummaryData summary = service.resolveForMonth(user, 2026, 7);

        assertEquals(3000.0, summary.monthlyIncome());
        assertEquals(3000.0, summary.actualIncome());
        assertEquals(4000.0, summary.expectedIncome());
        assertEquals(2800.0, summary.netRemaining());
    }

    @Test
    void resolveForMonth_negativeActualFallsBackToExpected() {
        stubExpenseTotal(200.0);
        stubIncome(2500.0, -120.0);

        FinancialSummaryData summary = service.resolveForMonth(user, 2026, 7);

        assertEquals(2500.0, summary.monthlyIncome());
        assertEquals(2300.0, summary.netRemaining());
    }

    @Test
    void resolveForMonth_zeroIncomeReturnsZeroPercentageAndNegativeRemaining() {
        stubExpenseTotal(200.0);
        stubIncome(0.0, 0.0);

        FinancialSummaryData summary = service.resolveForMonth(user, 2026, 7);

        assertEquals(0.0, summary.spentPercentageOfIncome());
        assertEquals(-200.0, summary.netRemaining());
    }

    @Test
    void resolveForMonth_roundsPercentToTwoDecimals() {
        stubExpenseTotal(1.0);
        stubIncome(3.0, 0.0);

        FinancialSummaryData summary = service.resolveForMonth(user, 2026, 7);

        assertEquals(33.33, summary.spentPercentageOfIncome());
    }

    @Test
    void resolveForMonth_delegatesIncomeResolutionToIncomeCalculationService() {
        stubExpenseTotal(0.0);
        stubIncome(5000.0, 0.0);

        service.resolveForMonth(user, 2026, 7);

        verify(incomeCalculationService).resolveExpectedForMonth(eq(user), eq(2026), eq(7));
        verify(incomeCalculationService).resolveActualForMonth(eq(user), eq(2026), eq(7));
    }
}
