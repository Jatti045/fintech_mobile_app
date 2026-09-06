package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.budget.BudgetSuggestionsResponse.Data;
import com.fintechapp.fintech_api.dto.budget.BudgetSuggestionsResponse.Item;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;

/**
 * Deterministic, explainable suggested limits for setting up a month.
 *
 * <p>
 * Signal priority (strongest first):
 * </p>
 *
 * <ol>
 * <li><b>Previous month's manually configured budget</b> — inherited
 * verbatim. Auto-created $0 rows from Plaid carry no intent and are never a
 * source.</li>
 * <li><b>Recent completed-month spending</b> — median of up to
 * {@value #HISTORY_MONTHS} completed months' expense totals (transfers
 * excluded, consistent with every other aggregate), rounded up
 * conservatively. Requires {@value #MIN_EVIDENCE_MONTHS}+ distinct months of
 * evidence; one month is not enough to invent a confident number.</li>
 * </ol>
 *
 * <p>
 * Categories already manually budgeted in the target month are never
 * suggested, and incomplete/current sample months are excluded so estimates
 * never come from a month still in progress. Read-only service.
 * </p>
 */
@Service
public class BudgetSuggestionService {

    /** Completed months of spending evidence considered for an estimate. */
    static final int HISTORY_MONTHS = 3;

    /** Distinct months of positive spend required before estimating at all. */
    static final int MIN_EVIDENCE_MONTHS = 2;

    public static final String SOURCE_PREVIOUS_MONTH_BUDGET = "PREVIOUS_MONTH_BUDGET";
    public static final String SOURCE_HISTORICAL_SPENDING = "HISTORICAL_SPENDING";

    private final BudgetRepository budgetRepository;
    private final TransactionRepository transactionRepository;

    public BudgetSuggestionService(
            BudgetRepository budgetRepository,
            TransactionRepository transactionRepository) {
        this.budgetRepository = budgetRepository;
        this.transactionRepository = transactionRepository;
    }

    /** Resolves the authenticated user and computes suggestions. */
    @Transactional(readOnly = true)
    public Data suggestForAuthenticatedUser(AuthenticatedUser authenticatedUser, int year, int month) {
        return suggestForUser(requireUserId(authenticatedUser), year, month);
    }

    /** Production entry point using the real clock. */
    @Transactional(readOnly = true)
    public Data suggestForUser(String userId, int year, int month) {
        return suggestForUser(userId, year, month, Instant.now());
    }

    /**
     * Overload with an explicit {@code now} keeps the "completed month" rule
     * deterministic under test.
     */
    @Transactional(readOnly = true)
    public Data suggestForUser(String userId, int year, int month, Instant now) {
        validateMonthYear(year, month);
        Instant targetStart = monthStart(year, month);
        Instant targetEnd = nextMonthStart(year, month);

        Map<String, Budget> currentByCategory = new LinkedHashMap<>();
        for (Budget b : budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                userId, targetStart, targetEnd)) {
            currentByCategory.putIfAbsent(b.getCategory().toLowerCase(Locale.ROOT), b);
        }

        // A category already limited by the user this month is done — never suggested.
        Set<String> manualInTarget = new LinkedHashSet<>();
        for (Map.Entry<String, Budget> e : currentByCategory.entrySet()) {
            if (isManuallyConfigured(e.getValue())) {
                manualInTarget.add(e.getKey());
            }
        }

        List<Item> suggestions = new ArrayList<>();
        Set<String> claimed = new LinkedHashSet<>();

        // ── Signal 1: previous month's manual budgets ────────────────────────
        YearMonth target = YearMonth.from(LocalDate.ofInstant(targetStart, ZoneOffset.UTC));
        YearMonth previous = target.minusMonths(1);
        for (Budget prev : budgetsIn(userId, previous)) {
            if (!isManuallyConfigured(prev)) {
                continue; // auto-created $0 rows carry no intent
            }
            String key = prev.getCategory().toLowerCase(Locale.ROOT);
            if (manualInTarget.contains(key) || !claimed.add(key)) {
                continue;
            }
            suggestions.add(buildItem(prev.getCategory(), prev.getLimit(),
                    SOURCE_PREVIOUS_MONTH_BUDGET, true, 0, currentByCategory.get(key)));
        }

        // ── Signal 2: recent completed-month spending ────────────────────────
        Map<String, List<Double>> evidence = new LinkedHashMap<>();
        Map<String, String> displayNames = new LinkedHashMap<>();
        for (int k = 1; k <= HISTORY_MONTHS; k++) {
            YearMonth sample = target.minusMonths(k);
            Instant windowStart = sample.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant windowEnd = sample.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            if (windowEnd.isAfter(now)) {
                continue; // incomplete/current month — never estimate from it
            }
            for (TransactionRepository.CategoryTotal ct : transactionRepository
                    .sumAmountByUserAndTypeGroupedByCategory(userId, TransactionType.EXPENSE, windowStart, windowEnd)) {
                if (ct.getCategory() == null || ct.getTotal() == null || ct.getTotal() <= 0) {
                    continue;
                }
                String canonical = CategoryNormalizer.normalize(ct.getCategory());
                String key = canonical != null ? canonical.toLowerCase(Locale.ROOT)
                        : ct.getCategory().toLowerCase(Locale.ROOT);
                displayNames.putIfAbsent(key, canonical != null ? canonical : ct.getCategory());
                evidence.computeIfAbsent(key, x -> new ArrayList<>())
                        .add(ct.getTotal());
            }
        }

        for (Map.Entry<String, List<Double>> e : evidence.entrySet()) {
            String key = e.getKey();
            List<Double> totals = e.getValue();
            if (totals.size() < MIN_EVIDENCE_MONTHS) {
                continue; // insufficient history — refuse to invent a number
            }
            if (manualInTarget.contains(key) || !claimed.add(key)) {
                continue;
            }
            Budget inTarget = currentByCategory.get(key);
            String name = inTarget != null ? inTarget.getCategory()
                    : displayNames.getOrDefault(key, CategoryNormalizer.normalize(key));
            suggestions.add(buildItem(name, roundSuggestion(median(totals)),
                    SOURCE_HISTORICAL_SPENDING, false, totals.size(), inTarget));
        }

        // Deterministic order: largest commitment first, then alphabetical.
        suggestions.sort(Comparator
                .comparingDouble(Item::suggestedLimit).reversed()
                .thenComparing(Comparator.comparing(Item::category, String.CASE_INSENSITIVE_ORDER)));

        return new Data(year, month, List.copyOf(suggestions));
    }

    private List<Budget> budgetsIn(String userId, YearMonth ym) {
        Instant start = ym.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant end = ym.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        return budgetRepository.findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                userId, start, end);
    }

    private Item buildItem(String category, double limit, String source, boolean inherited,
            int monthsSampled, Budget inTarget) {
        return new Item(
                category,
                limit,
                source,
                inherited,
                inTarget == null ? null : inTarget.getId(),
                inTarget != null && inTarget.isAutoCreated(),
                inTarget == null ? 0 : inTarget.getSpent(),
                monthsSampled);
    }

    /**
     * A budget reflects an explicit user decision only when it was not
     * auto-created by Plaid AND carries a positive limit.
     */
    static boolean isManuallyConfigured(Budget budget) {
        return !budget.isAutoCreated() && budget.getLimit() > 0;
    }

    /** Standard median (mean of the two middle values for even counts). */
    static double median(List<Double> values) {
        List<Double> sorted = new ArrayList<>(values);
        sorted.sort(Comparator.naturalOrder());
        int n = sorted.size();
        if (n % 2 == 1) {
            return sorted.get(n / 2);
        }
        return (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    /**
     * Conservative tiered round-UP so a suggestion never undershoots the
     * observed need, while converging to friendly numbers: nearest 1 below
     * 10, nearest 5 below 50, nearest 10 below 200, nearest 25 below 1000,
     * nearest 100 above that. Deterministic and monotonic.
     */
    static double roundSuggestion(double value) {
        if (value <= 0) {
            return 0;
        }
        double step;
        if (value < 10) {
            step = 1;
        } else if (value < 50) {
            step = 5;
        } else if (value < 200) {
            step = 10;
        } else if (value < 1000) {
            step = 25;
        } else {
            step = 100;
        }
        return Math.ceil(value / step) * step;
    }

    private void validateMonthYear(int year, int month) {
        if (month < 0 || month > 11 || year <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month/year value");
        }
    }

    private Instant monthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant nextMonthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).plusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private String requireUserId(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return authenticatedUser.userId();
    }
}