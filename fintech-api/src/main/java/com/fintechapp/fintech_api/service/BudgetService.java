package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
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

import com.fintechapp.fintech_api.dto.budget.ApplyBudgetSuggestionsResponse;
import com.fintechapp.fintech_api.dto.budget.ApplySuggestionsRequest;
import com.fintechapp.fintech_api.dto.budget.BudgetDataResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetIdResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetItemResponse;
import com.fintechapp.fintech_api.dto.budget.BudgetsResponse;
import com.fintechapp.fintech_api.dto.budget.CreateBudgetRequest;
import com.fintechapp.fintech_api.dto.budget.UpdateBudgetRequest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;

@Service
public class BudgetService {

    private final BudgetRepository budgetRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public BudgetService(
            BudgetRepository budgetRepository,
            TransactionRepository transactionRepository,
            UserRepository userRepository) {
        this.budgetRepository = budgetRepository;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public BudgetDataResponse createBudget(AuthenticatedUser authenticatedUser, CreateBudgetRequest request) {
        String userId = requireUserId(authenticatedUser);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category and limit are required");
        }

        Integer month = request.month();
        Integer year = request.year();
        if (month == null || year == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year are required");
        }

        Instant monthStart = monthStart(year, month);
        Instant nextMonthStart = nextMonthStart(year, month);

        if (!StringUtils.hasText(request.category()) || request.limit() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category and limit are required");
        }

        String canonicalCategory = CategoryNormalizer.normalize(request.category());
        if (canonicalCategory == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category and limit are required");
        }

        boolean exists = budgetRepository.existsByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                userId,
                canonicalCategory,
                monthStart,
                nextMonthStart);

        if (exists) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Budget for this category already exists");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));

        Budget budget = new Budget();
        budget.setUser(user);
        budget.setCategory(canonicalCategory);
        budget.setLimit(request.limit());
        budget.setDate(monthStart);
        budget.setAutoCreated(false); // manual budgets always start budgeted

        Budget saved = budgetRepository.save(budget);
        return new BudgetDataResponse(true, "Budget created successfully", toBudgetItem(saved));
    }

    @Transactional(readOnly = true)
    public BudgetsResponse getBudgets(AuthenticatedUser authenticatedUser, String monthRaw, String yearRaw) {
        String userId = requireUserId(authenticatedUser);

        if (monthRaw == null || yearRaw == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year query parameters are required");
        }

        Integer month = parseInteger(monthRaw);
        Integer year = parseInteger(yearRaw);
        if (month == null || year == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Month and year query parameters are required");
        }

        Instant monthStart = monthStart(year, month);
        Instant nextMonthStart = nextMonthStart(year, month);

        List<BudgetItemResponse> budgets = budgetRepository
                .findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(userId, monthStart, nextMonthStart)
                .stream()
                .map(this::toBudgetItem)
                .toList();

        return new BudgetsResponse(true, "Budgets retrieved successfully", budgets);
    }

    @Transactional
    public BudgetIdResponse deleteBudget(AuthenticatedUser authenticatedUser, String budgetId) {
        String userId = requireUserId(authenticatedUser);

        Budget budget = budgetRepository.findByIdAndUser_Id(budgetId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Budget not found"));

        long attachedCount = transactionRepository.countByBudget_IdAndUser_Id(budgetId, userId);
        if (attachedCount > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot delete budget: there are transactions attached to this budget. Remove or reassign those transactions first.");
        }

        budgetRepository.delete(budget);
        return new BudgetIdResponse(true, "Budget deleted successfully", budgetId);
    }

    @Transactional
    public BudgetDataResponse updateBudget(
            AuthenticatedUser authenticatedUser,
            String budgetId,
            UpdateBudgetRequest request) {
        String userId = requireUserId(authenticatedUser);

        if (!StringUtils.hasText(budgetId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "budgetId is required");
        }

        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No update payload provided");
        }

        Budget existing = budgetRepository.findByIdAndUser_Id(budgetId, userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Budget not found or doesn't belong to user"));

        int newMonth = request.month() != null
                ? request.month()
                : LocalDate.ofInstant(existing.getDate(), ZoneOffset.UTC).getMonthValue() - 1;
        int newYear = request.year() != null
                ? request.year()
                : LocalDate.ofInstant(existing.getDate(), ZoneOffset.UTC).getYear();
        String newCategory = request.category() != null
                ? CategoryNormalizer.normalize(request.category())
                : existing.getCategory();

        if (request.category() != null && newCategory == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category cannot be empty");
        }

        boolean categoryOrDateChanged = !newCategory.equalsIgnoreCase(existing.getCategory())
                || newMonth != LocalDate.ofInstant(existing.getDate(), ZoneOffset.UTC).getMonthValue() - 1
                || newYear != LocalDate.ofInstant(existing.getDate(), ZoneOffset.UTC).getYear();

        if (categoryOrDateChanged) {
            Instant monthStart = monthStart(newYear, newMonth);
            Instant nextMonthStart = nextMonthStart(newYear, newMonth);

            boolean conflict = budgetRepository
                    .existsByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThanAndIdNot(
                            userId,
                            newCategory,
                            monthStart,
                            nextMonthStart,
                            budgetId);

            if (conflict) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Another budget with this category exists for the same month");
            }
        }

        if (request.limit() != null) {
            if (request.limit() < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit must be a non-negative number");
            }
            if (request.limit() < existing.getSpent()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Limit cannot be less than current spent amount. Adjust transactions before reducing the limit.");
            }
            existing.setLimit(request.limit());
            // Assigning a limit clears the auto-created/unbudgeted flag.
            existing.setAutoCreated(false);
        }

        if (request.category() != null) {
            existing.setCategory(newCategory);
        }

        if (request.month() != null || request.year() != null) {
            existing.setDate(monthStart(newYear, newMonth));
        }

        Budget updated = budgetRepository.save(existing);
        return new BudgetDataResponse(true, "Budget updated successfully", toBudgetItem(updated));
    }

    /**
     * Applies a user-confirmed set of suggested budgets as one atomic,
     * idempotent transaction.
     *
     * <p>
     * Safety rules enforced server-side:
     * </p>
     * <ul>
     * <li>a category already carrying a <b>manually configured</b> limit in
     * the target month is never overwritten — it is reported as skipped with
     * {@code ALREADY_BUDGETED};</li>
     * <li>an existing auto-created ($0 Plaid) placeholder for the category is
     * given the chosen limit, its {@code autoCreated} flag is cleared (the
     * existing convention from {@link #updateBudget}), and its accumulated
     * {@code spent} is preserved untouched;</li>
     * <li>duplicate categories within one request are applied once
     * (subsequent copies reported as {@code DUPLICATE_CATEGORY});</li>
     * <li>a category with no target-month row creates a new manual budget.</li>
     * </ul>
     *
     * <p>
     * Calling this twice with the same payload is harmless: the second pass
     * simply reports every category as {@code ALREADY_BUDGETED} and changes
     * nothing. Comparison is case-insensitive (matching Plaid ingestion and
     * {@link BudgetController#getBudgets}).
     * </p>
     */
    @Transactional
    public ApplyBudgetSuggestionsResponse applyBudgetSuggestions(
            AuthenticatedUser authenticatedUser,
            ApplySuggestionsRequest request) {
        String userId = requireUserId(authenticatedUser);
        if (request == null || request.month() == null || request.year() == null
                || request.items() == null || request.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Month, year and at least one budget item are required");
        }

        int month = request.month();
        int year = request.year();
        Instant monthStart = monthStart(year, month);
        Instant nextMonth = nextMonthStart(year, month);

        // Target-month budgets indexed by lowercase category (first wins).
        Map<String, Budget> existingByCategory = new LinkedHashMap<>();
        for (Budget b : budgetRepository
                .findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(userId, monthStart, nextMonth)) {
            existingByCategory.putIfAbsent(b.getCategory().toLowerCase(Locale.ROOT), b);
        }

        List<ApplyBudgetSuggestionsResponse.SkippedItem> skipped = new ArrayList<>();
        List<BudgetItemResponse> applied = new ArrayList<>();
        Set<String> written = new LinkedHashSet<>();
        int created = 0;
        int updated = 0;
        int skippedCount = 0;

        for (ApplySuggestionsRequest.Item item : request.items()) {
            if (item == null || item.category() == null) {
                continue;
            }
            String canonical = CategoryNormalizer.normalize(item.category());
            if (canonical == null || item.limit() == null) {
                continue;
            }
            String key = canonical.toLowerCase(Locale.ROOT);

            if (!written.add(key)) {
                skipped.add(new ApplyBudgetSuggestionsResponse.SkippedItem(
                        canonical, item.limit(), "DUPLICATE_CATEGORY"));
                skippedCount++;
                continue;
            }

            Budget existing = existingByCategory.get(key);
            if (existing != null && BudgetSuggestionService.isManuallyConfigured(existing)) {
                // A real user decision already exists for this month — never override it.
                skipped.add(new ApplyBudgetSuggestionsResponse.SkippedItem(
                        existing.getCategory(), item.limit(), "ALREADY_BUDGETED"));
                skippedCount++;
                continue;
            }

            if (existing == null) {
                User user = userRepository.findById(userId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
                Budget budget = new Budget();
                budget.setUser(user);
                budget.setCategory(canonical);
                budget.setLimit(item.limit());
                budget.setDate(monthStart);
                budget.setAutoCreated(false);
                applied.add(toBudgetItem(budgetRepository.save(budget)));
                created++;
            } else {
                // Auto-created ($0) placeholder — set the limit, clear the flag,
                // keep the spent aggregate intact.
                existing.setLimit(item.limit());
                existing.setAutoCreated(false);
                applied.add(toBudgetItem(budgetRepository.save(existing)));
                updated++;
            }
        }

        return new ApplyBudgetSuggestionsResponse(true,
                created + updated + " budget(s) applied", new ApplyBudgetSuggestionsResponse.Data(
                        year, month, created, updated, skippedCount, List.copyOf(skipped), List.copyOf(applied)));
    }

    private BudgetItemResponse toBudgetItem(Budget budget) {
        return new BudgetItemResponse(
                budget.getId(),
                budget.getUser().getId(),
                budget.getDate(),
                budget.getCategory(),
                budget.getLimit(),
                budget.getSpent(),
                budget.isAutoCreated(),
                budget.getCreatedAt(),
                budget.getUpdatedAt());
    }

    private String requireUserId(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return authenticatedUser.userId();
    }

    private Integer parseInteger(String rawValue) {
        try {
            return Integer.parseInt(rawValue);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Instant monthStart(int year, int month) {
        if (month < 0 || month > 11 || year <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid month/year value");
        }
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant nextMonthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1)
                .plusMonths(1)
                .atStartOfDay()
                .toInstant(ZoneOffset.UTC);
    }
}
