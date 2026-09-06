package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.fintechapp.fintech_api.dto.budget.BudgetSuggestionsResponse.Data;
import com.fintechapp.fintech_api.dto.budget.BudgetSuggestionsResponse.Item;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository.CategoryTotal;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BudgetSuggestionServiceTest {

    /** Fixed clock = 2026-05-15 so sample months through April are "completed". */
    private final Instant now = LocalDate.of(2026, 5, 15).atStartOfDay().toInstant(ZoneOffset.UTC);

    private BudgetRepository budgetRepository;
    private TransactionRepository transactionRepository;
    private BudgetSuggestionService service;

    @BeforeEach
    void setUp() {
        budgetRepository = mock(BudgetRepository.class);
        transactionRepository = mock(TransactionRepository.class);
        service = new BudgetSuggestionService(budgetRepository, transactionRepository);
    }

    /** Zero-based month index → LocalDate.of(year, month+1, 1). */
    private static Instant monthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private static int monthIdx(Instant instant) {
        return LocalDate.ofInstant(instant, ZoneOffset.UTC).getMonthValue() - 1;
    }

    private Budget budget(String category, double limit, boolean autoCreated, double spent) {
        Budget b = new Budget();
        b.setCategory(category);
        b.setLimit(limit);
        b.setAutoCreated(autoCreated);
        b.setSpent(spent);
        b.setId("id-" + category);
        return b;
    }

    private static CategoryTotal total(String category, double value) {
        CategoryTotal ct = mock(CategoryTotal.class);
        when(ct.getCategory()).thenReturn(category);
        when(ct.getTotal()).thenReturn(value);
        return ct;
    }

    /**
     * Stubs the budget repo so target month returns {@code target} and other months
     * {@code rest}.
     */
    private void stubBudgets(int targetMonthIdx, List<Budget> target, List<Budget> rest) {
        lenient().when(budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                eq("user-1"), any(Instant.class), any(Instant.class)))
                .thenAnswer(invocation -> {
                    int idx = monthIdx(invocation.getArgument(1));
                    // Previous month = target - 1.
                    if (idx == targetMonthIdx) {
                        return target;
                    }
                    if (idx == targetMonthIdx - 1) {
                        return rest;
                    }
                    return List.of();
                });
    }

    /**
     * Stubs the grouped-spend repo to return {@code perMonthTotals} for completed
     * sample months.
     */
    private void stubSpend(java.util.Map<Integer, List<CategoryTotal>> perMonthTotals) {
        lenient().when(transactionRepository.sumAmountByUserAndTypeGroupedByCategory(
                eq("user-1"), eq(TransactionType.EXPENSE), any(Instant.class), any(Instant.class)))
                .thenAnswer(invocation -> {
                    int idx = monthIdx(invocation.getArgument(2));
                    return perMonthTotals.getOrDefault(idx, List.of());
                });
    }

    private static Item item(Data data, String category) {
        return data.suggestions().stream()
                .filter(i -> i.category().equalsIgnoreCase(category))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no suggestion for " + category));
    }

    @Test
    void roundSuggestion_roundsUpByTier() {
        assertEquals(8, BudgetSuggestionService.roundSuggestion(8)); // <10 → nearest 1
        assertEquals(15, BudgetSuggestionService.roundSuggestion(13)); // <50 → nearest 5
        assertEquals(120, BudgetSuggestionService.roundSuggestion(113)); // <200 → nearest 10
        assertEquals(425, BudgetSuggestionService.roundSuggestion(404)); // <1000 → nearest 25
        assertEquals(500, BudgetSuggestionService.roundSuggestion(498)); // <1000 → nearest 25 yields 500
        assertEquals(1300, BudgetSuggestionService.roundSuggestion(1205)); // ≥1000 → nearest 100
        assertEquals(0, BudgetSuggestionService.roundSuggestion(0));
        assertEquals(0, BudgetSuggestionService.roundSuggestion(-5));
    }

    @Test
    void median_handlesOddAndEvenCounts() {
        assertEquals(30, BudgetSuggestionService.median(List.of(30.0)));
        assertEquals(25, BudgetSuggestionService.median(List.of(20.0, 30.0)));
        assertEquals(40, BudgetSuggestionService.median(List.of(10.0, 40.0, 80.0)));
    }

    @Test
    void suggests_previousMonthManualBudget_inherited() {
        Budget prevFood = budget("Food", 300, false, 0);
        // Target = May (index 4), previous = April (index 3).
        stubBudgets(4, List.of(), List.of(prevFood));

        Data data = service.suggestForUser("user-1", 2026, 4, now);

        Item food = item(data, "Food");
        assertEquals(300, food.suggestedLimit());
        assertEquals(BudgetSuggestionService.SOURCE_PREVIOUS_MONTH_BUDGET, food.source());
        assertTrue(food.inherited());
        assertEquals(0, food.monthsSampled());
        assertFalse(food.autoCreated());
        assertEquals(0, food.spentToDate());
    }

    @Test
    void excludes_autoCreatedPreviousMonthBudgets_fromInheritedSignal() {
        Budget prevFood = budget("Food", 0, true, 50); // auto-created $0 row — no intent
        stubBudgets(5, List.of(), List.of(prevFood));

        Data data = service.suggestForUser("user-1", 2026, 5, now);

        assertEquals(0, data.suggestions().size());
    }

    @Test
    void suggests_historicalSpending_usingRoundedMedian() {
        stubBudgets(5, List.of(), List.of()); // no previous budgets → estimate path
        // Two completed months (March and April): 421 & 433 → median 427 → round 450
        // (100-999 tier).
        stubSpend(java.util.Map.of(
                2, List.of(total("Groceries", 421.0)),
                3, List.of(total("Groceries", 433.0))));

        Data data = service.suggestForUser("user-1", 2026, 5, now);

        Item groceries = item(data, "Groceries");
        assertEquals(450, groceries.suggestedLimit());
        assertEquals(BudgetSuggestionService.SOURCE_HISTORICAL_SPENDING, groceries.source());
        assertFalse(groceries.inherited());
        assertEquals(2, groceries.monthsSampled());
    }

    @Test
    void skipsInsufficientHistory_singleMonthOfSpending() {
        stubBudgets(5, List.of(), List.of());
        // Only one distinct completed month → below MIN_EVIDENCE_MONTHS.
        stubSpend(java.util.Map.of(3, List.of(total("Groceries", 150.0))));

        Data data = service.suggestForUser("user-1", 2026, 5, now);

        assertEquals(0, data.suggestions().size());
    }

    @Test
    void refusesToEstimate_fromIncompleteCurrentMonth() {
        stubBudgets(4, List.of(), List.of());
        // Spending exists ONLY in the current (in-progress) May — must be ignored.
        stubSpend(java.util.Map.of(4, List.of(total("Groceries", 250.0))));

        Data data = service.suggestForUser("user-1", 2026, 4, now);

        assertEquals(0, data.suggestions().size());
    }

    @Test
    void excludesCategory_manuallyBudgetedInTargetMonth() {
        Budget inTarget = budget("Food", 500, false, 120);
        Budget prevFood = budget("Food", 300, false, 0);
        stubBudgets(5, List.of(inTarget), List.of(prevFood));

        Data data = service.suggestForUser("user-1", 2026, 5, now);

        assertEquals(0, data.suggestions().size());
    }

    @Test
    void marksInTargetAutoCreatedBudget_withSpentPreserved() {
        Budget inTarget = budget("Food", 0, true, 42); // $0 auto-created, $42 spent
        Budget prevFood = budget("Food", 300, false, 0);
        stubBudgets(5, List.of(inTarget), List.of(prevFood));

        Data data = service.suggestForUser("user-1", 2026, 5, now);

        Item food = item(data, "Food");
        assertEquals(inTarget.getId(), food.existingBudgetId());
        assertTrue(food.autoCreated());
        assertEquals(42, food.spentToDate());
        assertEquals(300, food.suggestedLimit());
    }

    @Test
    void suggests_historicalSpending_normalizesCategoryToCanonicalTitleCase() {
        stubBudgets(5, List.of(), List.of());
        stubSpend(java.util.Map.of(
                2, List.of(total("groceries", 421.0)),
                3, List.of(total("groceries", 433.0))));

        Data data = service.suggestForUser("user-1", 2026, 5, now);

        assertEquals(1, data.suggestions().size());
        Item groceries = data.suggestions().get(0);
        assertEquals("Groceries", groceries.category());
        assertEquals(450, groceries.suggestedLimit());
    }

    @Test
    void suggests_matchesTargetAutoCreatedBudgetCaseInsensitively() {
        Budget inTarget = budget("food", 0, true, 42); // lowercase in target
        Budget prevFood = budget("Food", 300, false, 0); // uppercase in previous
        stubBudgets(5, List.of(inTarget), List.of(prevFood));

        Data data = service.suggestForUser("user-1", 2026, 5, now);

        Item food = item(data, "Food");
        assertEquals(inTarget.getId(), food.existingBudgetId());
        assertTrue(food.autoCreated());
        assertEquals(42, food.spentToDate());
        assertEquals(300, food.suggestedLimit());
        assertEquals("Food", food.category());
    }
}