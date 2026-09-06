package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.config.CacheConfig;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.financialSummary.FinancialSummaryResponse.FinancialSummaryData;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

/**
 * Single source of truth for month-level financial aggregation.
 *
 * <p>Owns every aggregate the app surfaces on dashboards and summary headers:
 * total spending, expected/actual/effective income, net remaining, and the
 * spending percentage of income. Income math is delegated to
 * {@link IncomeCalculationService} so there is exactly one implementation of
 * each calculation.
 *
 * <p>Transaction retrieval ({@link TransactionService}) has no responsibility
 * for these aggregates.
 */
@Service
public class FinancialSummaryService {

    private final IncomeCalculationService incomeCalculationService;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public FinancialSummaryService(
            IncomeCalculationService incomeCalculationService,
            TransactionRepository transactionRepository,
            UserRepository userRepository) {
        this.incomeCalculationService = incomeCalculationService;
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    /**
     * Resolves the authenticated user and computes the month summary.
     *
     * <p>Cached per user/month (Redis, TTL 10 min). Eviction is handled by
     * {@link FinancialCacheInvalidator} on every financial mutation.
     *
     * @param month zero-based month index (0 = January)
     */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CacheConfig.FINANCIAL_SUMMARY_CACHE,
            key = "#authenticatedUser?.userId() + ':' + #year + ':' + #month")
    public FinancialSummaryData resolveForAuthenticatedUser(
            AuthenticatedUser authenticatedUser,
            int year,
            int month) {
        User user = requireUser(authenticatedUser);
        return resolveForMonth(user, year, month);
    }

    /**
     * Computes the full month summary for the user.
     *
     * <p>Shares the same cache keyspace as
     * {@link #resolveForAuthenticatedUser}, so internal callers (e.g. the
     * monthly insight assembly) reuse the cached aggregate.
     *
     * @param month zero-based month index (0 = January)
     */
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = CacheConfig.FINANCIAL_SUMMARY_CACHE,
            key = "#user?.id + ':' + #year + ':' + #month")
    public FinancialSummaryData resolveForMonth(User user, int year, int month) {
        Instant from = monthStart(year, month);
        Instant to = nextMonthStart(year, month);

        // Currency-safety invariant: SUM here is only correct because every
        // stored `amount` has already been normalized into the user's
        // aggregation currency at ingestion time (Plaid sync, manual
        // create/update — see CurrencyConversionService). Never sum raw
        // original amounts across currencies.
        double expenseTotal = transactionRepository.sumAmountByUserAndTypeAndDateBetween(
                user.getId(), TransactionType.EXPENSE, from, to);
        double totalAmount = round2(expenseTotal);
        double expectedIncome = incomeCalculationService.resolveExpectedForMonth(user, year, month);
        double actualIncome = incomeCalculationService.resolveActualForMonth(user, year, month);
        // Net calculations use effective income: actual inflow when present,
        // otherwise the expected baseline the user set on their profile.
        double monthlyIncome = actualIncome > 0 ? actualIncome : expectedIncome;

        double netRemaining = round2(monthlyIncome - totalAmount);
        double spentPercentage = monthlyIncome > 0 ? round2((totalAmount / monthlyIncome) * 100) : 0;

        return new FinancialSummaryData(
                totalAmount,
                round2(monthlyIncome),
                round2(expectedIncome),
                round2(actualIncome),
                totalAmount,
                netRemaining,
                spentPercentage);
    }

    private User requireUser(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        return userRepository.findById(authenticatedUser.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated"));
    }

    public Instant monthStart(int year, int month) {
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

    private double round2(double value) {
        return Math.round(value * 100) / 100d;
    }
}

