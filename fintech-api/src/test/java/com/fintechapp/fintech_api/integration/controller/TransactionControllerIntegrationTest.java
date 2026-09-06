package com.fintechapp.fintech_api.integration.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.AbstractMap;
import java.util.Map;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.mockito.Mockito.when;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;

import jakarta.persistence.EntityManager;

class TransactionControllerIntegrationTest extends BaseIntegrationTest {

        @Autowired
        private EntityManager entityManager;

        // Asserts create transaction succeeds and updates linked budget spent for
        // expense transactions.
        @Test
        void createTransaction_validExpenseRequest_createsTransactionAndUpdatesBudget() throws Exception {
                User user = createUser("tx-create@example.com", "Password123!", "tx-create");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));

                // The user's aggregation currency is USD (default); the transaction is
                // authored in SGD. The API normalizes 25.5 SGD into 18.73 USD at
                // ingestion time; the raw values are preserved alongside.
                when(currencyConversionService.convert(25.5, "SGD", "USD")).thenReturn(18.73);

                mockMvc.perform(post("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.ofEntries(
                                                new AbstractMap.SimpleEntry<>("name", "Lunch"),
                                                new AbstractMap.SimpleEntry<>("month", 2),
                                                new AbstractMap.SimpleEntry<>("year", 2026),
                                                new AbstractMap.SimpleEntry<>("date", "2026-03-05T10:00:00Z"),
                                                new AbstractMap.SimpleEntry<>("category", "Food"),
                                                new AbstractMap.SimpleEntry<>("type", "EXPENSE"),
                                                new AbstractMap.SimpleEntry<>("amount", 18.73),
                                                new AbstractMap.SimpleEntry<>("baseCurrency", "USD"),
                                                new AbstractMap.SimpleEntry<>("originalAmount", 25.5),
                                                new AbstractMap.SimpleEntry<>("originalCurrency", "SGD"),
                                                new AbstractMap.SimpleEntry<>("budgetId", budget.getId()),
                                                new AbstractMap.SimpleEntry<>("description", "Team lunch")))))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction.name").value("Lunch"))
                                .andExpect(jsonPath("$.data.transaction.amount").value(18.73))
                                .andExpect(jsonPath("$.data.transaction.baseCurrency").value("USD"))
                                .andExpect(jsonPath("$.data.transaction.originalAmount").value(25.5))
                                .andExpect(jsonPath("$.data.transaction.originalCurrency").value("SGD"));

                Budget updatedBudget = budgetRepository.findById(budget.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals(18.73, updatedBudget.getSpent());

                Transaction savedTx = transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).get(0);
                org.junit.jupiter.api.Assertions.assertEquals(18.73, savedTx.getAmount());
                org.junit.jupiter.api.Assertions.assertEquals("USD", savedTx.getBaseCurrency());
                org.junit.jupiter.api.Assertions.assertEquals(25.5, savedTx.getOriginalAmount());
                org.junit.jupiter.api.Assertions.assertEquals("SGD", savedTx.getOriginalCurrency());
        }

        // End-to-end proof of the mixed-currency invariant: a CAD user with a
        // 100 CAD expense and a 100 USD expense must aggregate to 100 + 125 = 225
        // CAD (each transaction normalized at ingestion), never the raw 200.
        @Test
        void createTransaction_mixedCurrencies_summaryAggregatesNormalizedAmounts() throws Exception {
                User user = createUser("tx-mixed@example.com", "Password123!", "tx-mixed");
                user.setCurrency("CAD");
                userRepository.save(user);

                LocalDate utc = LocalDate.now(ZoneOffset.UTC);
                int month = utc.getMonthValue() - 1;
                int year = utc.getYear();
                Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
                Instant txDate = monthStart.plusSeconds(86_400);
                Budget food = createBudget(user, "Food", 5000, monthStart);

                // 100 CAD expense — the user's aggregation currency; value unchanged.
                mockMvc.perform(post("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.ofEntries(
                                                new AbstractMap.SimpleEntry<>("name", "Groceries"),
                                                new AbstractMap.SimpleEntry<>("month", month),
                                                new AbstractMap.SimpleEntry<>("year", year),
                                                new AbstractMap.SimpleEntry<>("date", txDate.toString()),
                                                new AbstractMap.SimpleEntry<>("category", "Food"),
                                                new AbstractMap.SimpleEntry<>("type", "EXPENSE"),
                                                new AbstractMap.SimpleEntry<>("amount", 100.0),
                                                new AbstractMap.SimpleEntry<>("originalAmount", 100.0),
                                                new AbstractMap.SimpleEntry<>("originalCurrency", "CAD"),
                                                new AbstractMap.SimpleEntry<>("budgetId", food.getId())))))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.data.transaction.amount").value(100.0))
                                .andExpect(jsonPath("$.data.transaction.baseCurrency").value("CAD"))
                                .andExpect(jsonPath("$.data.transaction.originalAmount").value(100.0))
                                .andExpect(jsonPath("$.data.transaction.originalCurrency").value("CAD"));

                // 100 USD expense — normalized to 125 CAD at ingestion time.
                when(currencyConversionService.convert(100.0, "USD", "CAD")).thenReturn(125.0);
                mockMvc.perform(post("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.ofEntries(
                                                new AbstractMap.SimpleEntry<>("name", "US Purchase"),
                                                new AbstractMap.SimpleEntry<>("month", month),
                                                new AbstractMap.SimpleEntry<>("year", year),
                                                new AbstractMap.SimpleEntry<>("date", txDate.toString()),
                                                new AbstractMap.SimpleEntry<>("category", "Food"),
                                                new AbstractMap.SimpleEntry<>("type", "EXPENSE"),
                                                new AbstractMap.SimpleEntry<>("amount", 125.0),
                                                new AbstractMap.SimpleEntry<>("originalAmount", 100.0),
                                                new AbstractMap.SimpleEntry<>("originalCurrency", "USD"),
                                                new AbstractMap.SimpleEntry<>("budgetId", food.getId())))))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.data.transaction.amount").value(125.0))
                                .andExpect(jsonPath("$.data.transaction.baseCurrency").value("CAD"))
                                .andExpect(jsonPath("$.data.transaction.originalAmount").value(100.0))
                                .andExpect(jsonPath("$.data.transaction.originalCurrency").value("USD"));

                // The month summary is already denominated in CAD: 100 + 125 = 225 —
                // not convert(200) under one guessed currency.
                mockMvc.perform(get("/api/financial-summary")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(month))
                                .param("year", String.valueOf(year)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.totalAmount").value(225.0));

                Budget updatedBudget = budgetRepository.findById(food.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals(225.0, updatedBudget.getSpent());
        }

        // Asserts an income transaction can be created without a linked budget.
        @Test
        void createTransaction_incomeWithoutBudget_returnsCreated() throws Exception {
                User user = createUser("tx-income@example.com", "Password123!", "tx-income");

                mockMvc.perform(post("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "name", "Salary",
                                                "month", 2,
                                                "year", 2026,
                                                "date", "2026-03-01T08:00:00Z",
                                                "category", "Income",
                                                "type", "INCOME",
                                                "amount", 3000.0,
                                                "baseCurrency", "USD"))))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction.name").value("Salary"))
                                .andExpect(jsonPath("$.data.transaction.type").value("INCOME"))
                                .andExpect(jsonPath("$.data.transaction.amount").value(3000.0));

                // No budget is attached, and the expense flow did not create one.
                org.junit.jupiter.api.Assertions.assertEquals(
                                0, budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
        }

        // Asserts create transaction rejects missing required fields with 400.
        @Test
        void createTransaction_missingRequiredField_returnsBadRequest() throws Exception {
                User user = createUser("tx-missing@example.com", "Password123!", "tx-missing");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));

                mockMvc.perform(post("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "month", 2,
                                                "year", 2026,
                                                "date", "2026-03-05T10:00:00Z",
                                                "category", "Food",
                                                "type", "EXPENSE",
                                                "amount", 25.5,
                                                "budgetId", budget.getId()))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts create transaction rejects invalid transaction type and does not
        // persist partial state.
        @Test
        void createTransaction_invalidType_returnsBadRequestAndDoesNotPersist() throws Exception {
                User user = createUser("tx-invalid-type@example.com", "Password123!", "tx-invalid-type");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));

                mockMvc.perform(post("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "name", "Lunch",
                                                "month", 2,
                                                "year", 2026,
                                                "date", "2026-03-05T10:00:00Z",
                                                "category", "Food",
                                                "type", "INVALID",
                                                "amount", 25.5,
                                                "budgetId", budget.getId()))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));

                org.junit.jupiter.api.Assertions.assertEquals(0,
                                transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
        }

        // Asserts create transaction endpoint rejects unauthenticated requests.
        @Test
        void createTransaction_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(post("/api/transactions")
                                .contentType(json())
                                .content(asJson(Map.of("name", "Lunch"))))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts get transactions returns persisted transactions with success
        // response.
        @Test
        void getTransactions_validToken_returnsTransactions() throws Exception {
                User user = createUser("tx-list@example.com", "Password123!", "tx-list");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Lunch", Instant.parse("2026-03-05T10:00:00Z"), "Food",
                                TransactionType.EXPENSE, 25.5);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(1)))
                                .andExpect(jsonPath("$.data.transaction[0].name").value("Lunch"));
        }

        // Asserts the transaction endpoint is focused on transaction data and no
        // longer bundles financial summary/aggregate information. Aggregates are
        // served by GET /api/financial-summary instead.
        @Test
        void getTransactions_doesNotReturnFinancialSummary() throws Exception {
                User user = createUser("tx-no-summary@example.com", "Password123!", "tx-no-summary");
                LocalDate utc = LocalDate.now(ZoneOffset.UTC);
                int month = utc.getMonthValue() - 1;
                int year = utc.getYear();
                Instant monthStart = LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
                Budget budget = createBudget(user, "Food", 500, monthStart);
                createTransaction(user, budget, "Lunch", monthStart.plusSeconds(3600), "Food", TransactionType.EXPENSE,
                                18.73);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .param("currentMonth", String.valueOf(month))
                                .param("currentYear", String.valueOf(year)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(1)))
                                .andExpect(jsonPath("$.data.summary").doesNotExist())
                                .andExpect(jsonPath("$.data.spendingInsight").doesNotExist());
        }

        // Asserts get transactions endpoint rejects unauthenticated access.
        @Test
        void getTransactions_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(get("/api/transactions"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        void getTransactions_minAmountFilter_returnsOnlyEqualOrGreater() throws Exception {
                User user = createUser("tx-filter-min@example.com", "Password123!", "tx-filter-min");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Coffee", Instant.parse("2026-03-02T10:00:00Z"), "Food",
                                TransactionType.EXPENSE, 10.0);
                createTransaction(user, budget, "Lunch", Instant.parse("2026-03-05T12:00:00Z"), "Food",
                                TransactionType.EXPENSE, 25.5);
                createTransaction(user, budget, "Dinner", Instant.parse("2026-03-08T18:00:00Z"), "Food",
                                TransactionType.EXPENSE, 50.0);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("minAmount", "25.5"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(2)))
                                .andExpect(jsonPath("$.data.filters.minAmount").value(25.5));
        }

        @Test
        void getTransactions_maxAmountFilter_returnsOnlyEqualOrLesser() throws Exception {
                User user = createUser("tx-filter-max@example.com", "Password123!", "tx-filter-max");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Coffee", Instant.parse("2026-03-02T10:00:00Z"), "Food",
                                TransactionType.EXPENSE, 10.0);
                createTransaction(user, budget, "Lunch", Instant.parse("2026-03-05T12:00:00Z"), "Food",
                                TransactionType.EXPENSE, 25.5);
                createTransaction(user, budget, "Dinner", Instant.parse("2026-03-08T18:00:00Z"), "Food",
                                TransactionType.EXPENSE, 50.0);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("maxAmount", "25.5"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(2)))
                                .andExpect(jsonPath("$.data.filters.maxAmount").value(25.5));
        }

        @Test
        void getTransactions_amountRangeFilter_returnsBetweenInclusive() throws Exception {
                User user = createUser("tx-filter-range@example.com", "Password123!", "tx-filter-range");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Coffee", Instant.parse("2026-03-02T10:00:00Z"), "Food",
                                TransactionType.EXPENSE, 10.0);
                createTransaction(user, budget, "Lunch", Instant.parse("2026-03-05T12:00:00Z"), "Food",
                                TransactionType.EXPENSE, 25.5);
                createTransaction(user, budget, "Dinner", Instant.parse("2026-03-08T18:00:00Z"), "Food",
                                TransactionType.EXPENSE, 50.0);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("minAmount", "20.0")
                                .queryParam("maxAmount", "30.0"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(1)))
                                .andExpect(jsonPath("$.data.transaction[0].name").value("Lunch"));
        }

        @Test
        void getTransactions_dateOnlyRangeFilter_returnsWithinInclusiveDateRange() throws Exception {
                User user = createUser("tx-filter-date@example.com", "Password123!", "tx-filter-date");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Early", Instant.parse("2026-03-04T23:59:59Z"), "Food",
                                TransactionType.EXPENSE, 10.0);
                createTransaction(user, budget, "Target Start", Instant.parse("2026-03-05T00:00:00Z"), "Food",
                                TransactionType.EXPENSE, 15.0);
                createTransaction(user, budget, "Target Mid", Instant.parse("2026-03-05T15:30:00Z"), "Food",
                                TransactionType.EXPENSE, 20.0);
                createTransaction(user, budget, "Target End", Instant.parse("2026-03-05T23:59:59Z"), "Food",
                                TransactionType.EXPENSE, 25.0);
                createTransaction(user, budget, "Late", Instant.parse("2026-03-06T00:00:00Z"), "Food",
                                TransactionType.EXPENSE, 30.0);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("startDate", "2026-03-05")
                                .queryParam("endDate", "2026-03-05"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(3)));
        }

        @Test
        void getTransactions_timestampRangeFilter_returnsWithinInclusiveTimestampRange() throws Exception {
                User user = createUser("tx-filter-ts@example.com", "Password123!", "tx-filter-ts");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Before", Instant.parse("2026-03-05T09:59:59Z"), "Food",
                                TransactionType.EXPENSE, 10.0);
                createTransaction(user, budget, "Inside", Instant.parse("2026-03-05T10:00:00Z"), "Food",
                                TransactionType.EXPENSE, 20.0);
                createTransaction(user, budget, "After", Instant.parse("2026-03-05T12:00:01Z"), "Food",
                                TransactionType.EXPENSE, 30.0);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("startDate", "2026-03-05T10:00:00Z")
                                .queryParam("endDate", "2026-03-05T12:00:00Z"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(1)))
                                .andExpect(jsonPath("$.data.transaction[0].name").value("Inside"));
        }

        @Test
        void getTransactions_combinedFilters_returnsMatchingSubset() throws Exception {
                User user = createUser("tx-filter-comb@example.com", "Password123!", "tx-filter-comb");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Lunch", Instant.parse("2026-03-05T12:00:00Z"), "Food",
                                TransactionType.EXPENSE, 25.0);
                createTransaction(user, budget, "Dinner", Instant.parse("2026-03-05T18:00:00Z"), "Food",
                                TransactionType.EXPENSE, 85.0);
                createTransaction(user, budget, "Refund", Instant.parse("2026-03-05T12:00:00Z"), "Food",
                                TransactionType.INCOME, 25.0);
                createTransaction(user, budget, "Groceries", Instant.parse("2026-03-10T12:00:00Z"), "Food",
                                TransactionType.EXPENSE, 25.0);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("startDate", "2026-03-01")
                                .queryParam("endDate", "2026-03-06")
                                .queryParam("minAmount", "20")
                                .queryParam("maxAmount", "30")
                                .queryParam("category", "food")
                                .queryParam("type", "EXPENSE"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(1)))
                                .andExpect(jsonPath("$.data.transaction[0].name").value("Lunch"));
        }

        @Test
        void getTransactions_caseInsensitiveCategoryFilter_matchesMixedCase() throws Exception {
                User user = createUser("tx-filter-ci@example.com", "Password123!", "tx-filter-ci");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Lunch", Instant.parse("2026-03-05T12:00:00Z"), "Food",
                                TransactionType.EXPENSE, 25.0);

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("category", "foOD"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction", hasSize(1)))
                                .andExpect(jsonPath("$.data.transaction[0].name").value("Lunch"));
        }

        @Test
        void getTransactions_invalidMinAmount_returnsBadRequest() throws Exception {
                User user = createUser("tx-filter-bad-amt@example.com", "Password123!", "tx-filter-bad-amt");

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("minAmount", "not-a-number"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        void getTransactions_invalidStartDate_returnsBadRequest() throws Exception {
                User user = createUser("tx-filter-bad-date@example.com", "Password123!", "tx-filter-bad-date");

                mockMvc.perform(get("/api/transactions")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("startDate", "invalid-date"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts update transaction succeeds and persists updated amount.
        @Test
        void updateTransaction_validPatch_updatesTransaction() throws Exception {
                User user = createUser("tx-update@example.com", "Password123!", "tx-update");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                Transaction transaction = createTransaction(
                                user,
                                budget,
                                "Lunch",
                                Instant.parse("2026-03-05T10:00:00Z"),
                                "Food",
                                TransactionType.EXPENSE,
                                25.5);
                budget.setSpent(25.5);
                budgetRepository.save(budget);

                mockMvc.perform(patch("/api/transactions/{transactionId}", transaction.getId())
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("amount", 40.0))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction.amount").value(40.0));

                Transaction reloaded = transactionRepository.findById(transaction.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals(40.0, reloaded.getAmount());
        }

        // Asserts updating an expense to a budget from a different month is rejected,
        // matching createTransaction's month-window validation so budget spent totals
        // never span months.
        @Test
        void updateTransaction_budgetFromDifferentMonth_returnsNotFound() throws Exception {
                User user = createUser("tx-update-month@example.com", "Password123!", "tx-update-month");
                Budget marchBudget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                Budget aprilBudget = createBudget(user, "Transport", 400, Instant.parse("2026-04-01T00:00:00Z"));
                Transaction transaction = createTransaction(
                                user,
                                marchBudget,
                                "Lunch",
                                Instant.parse("2026-03-05T10:00:00Z"),
                                "Food",
                                TransactionType.EXPENSE,
                                25.5);
                marchBudget.setSpent(25.5);
                budgetRepository.save(marchBudget);

                mockMvc.perform(patch("/api/transactions/{transactionId}", transaction.getId())
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("budgetId", aprilBudget.getId()))))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts updating an expense to a budget within the same month succeeds and
        // moves the spent amount between the two budgets.
        @Test
        void updateTransaction_budgetWithinSameMonth_movesSpentAmount() throws Exception {
                User user = createUser("tx-update-samemonth@example.com", "Password123!", "tx-update-samemonth");
                Budget foodBudget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                Budget diningBudget = createBudget(user, "Dining", 300, Instant.parse("2026-03-01T00:00:00Z"));
                Transaction transaction = createTransaction(
                                user,
                                foodBudget,
                                "Lunch",
                                Instant.parse("2026-03-05T10:00:00Z"),
                                "Food",
                                TransactionType.EXPENSE,
                                25.5);
                foodBudget.setSpent(25.5);
                budgetRepository.save(foodBudget);

                mockMvc.perform(patch("/api/transactions/{transactionId}", transaction.getId())
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("budgetId", diningBudget.getId()))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.transaction.budget.id").value(diningBudget.getId()));

                // The atomic spent updates bypass the JPA first-level cache; flush and
                // clear the test-managed persistence context so the reloads below read
                // true database state instead of stale managed entities.
                entityManager.flush();
                entityManager.clear();

                Budget reloadedFood = budgetRepository.findById(foodBudget.getId()).orElseThrow();
                Budget reloadedDining = budgetRepository.findById(diningBudget.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals(0.0, reloadedFood.getSpent());
                org.junit.jupiter.api.Assertions.assertEquals(25.5, reloadedDining.getSpent());
        }

        // Asserts update transaction with unknown id returns 404.
        @Test
        void updateTransaction_nonExistentId_returnsNotFound() throws Exception {
                User user = createUser("tx-update-missing@example.com", "Password123!", "tx-update-missing");

                mockMvc.perform(patch("/api/transactions/{transactionId}", "missing-id")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("amount", 40.0))))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts update transaction endpoint rejects unauthenticated access.
        @Test
        void updateTransaction_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(patch("/api/transactions/{transactionId}", "any-id")
                                .contentType(json())
                                .content(asJson(Map.of("amount", 40.0))))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts delete transaction removes the transaction row and returns deleted
        // ID.
        @Test
        void deleteTransaction_existingId_deletesTransaction() throws Exception {
                User user = createUser("tx-delete@example.com", "Password123!", "tx-delete");
                Budget budget = createBudget(user, "Food", 500, Instant.parse("2026-03-01T00:00:00Z"));
                Transaction transaction = createTransaction(
                                user,
                                budget,
                                "Lunch",
                                Instant.parse("2026-03-05T10:00:00Z"),
                                "Food",
                                TransactionType.EXPENSE,
                                25.5);
                budget.setSpent(25.5);
                budgetRepository.save(budget);

                mockMvc.perform(delete("/api/transactions/{transactionId}", transaction.getId())
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.deletedTransactionId").value(transaction.getId()));

                org.junit.jupiter.api.Assertions
                                .assertFalse(transactionRepository.findById(transaction.getId()).isPresent());
        }

        // Asserts delete transaction with unknown id returns 404.
        @Test
        void deleteTransaction_nonExistentId_returnsNotFound() throws Exception {
                User user = createUser("tx-delete-missing@example.com", "Password123!", "tx-delete-missing");

                mockMvc.perform(delete("/api/transactions/{transactionId}", "missing-id")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts delete transaction endpoint rejects unauthenticated access.
        @Test
        void deleteTransaction_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(delete("/api/transactions/{transactionId}", "any-id"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // TODO: RBAC is not implemented in current security config (no role
        // claims/authorities checks).
        @Disabled("TODO: Enable when endpoint-level role authorization is implemented")
        @Test
        void deleteTransaction_validTokenWrongRole_returnsForbidden() {
        }
}
