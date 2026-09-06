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
import java.util.Map;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.User;

class BudgetControllerIntegrationTest extends BaseIntegrationTest {

        // Asserts creating a budget with valid input returns 201 and persists the
        // budget.
        @Test
        void createBudget_validRequest_returnsCreated() throws Exception {
                User user = createUser("budget-owner@example.com", "Password123!", "budget-owner");

                mockMvc.perform(post("/api/budgets")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "category", "Food",
                                                "limit", 300.0,
                                                "month", 2,
                                                "year", 2026))))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.category").value("Food"))
                                .andExpect(jsonPath("$.data.autoCreated").value(false));

                org.junit.jupiter.api.Assertions.assertEquals(1,
                                budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
        }

        @Test
        void createBudget_caseVariantDuplicate_returnsBadRequest() throws Exception {
                User user = createUser("budget-case-dup@example.com", "Password123!", "budget-case-dup");

                // Create initial budget with "Food"
                mockMvc.perform(post("/api/budgets")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "category", "Food",
                                                "limit", 300.0,
                                                "month", 2,
                                                "year", 2026))))
                                .andExpect(status().isCreated());

                // Attempt to create budget with lower-case "food" for the same month
                mockMvc.perform(post("/api/budgets")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "category", "food",
                                                "limit", 200.0,
                                                "month", 2,
                                                "year", 2026))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false))
                                .andExpect(jsonPath("$.message").value("Budget for this category already exists"));
        }

        @Test
        void createBudget_normalizesCategoryCanonicalTitleCase() throws Exception {
                User user = createUser("budget-norm@example.com", "Password123!", "budget-norm");

                mockMvc.perform(post("/api/budgets")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "category", "groceries & food / dining",
                                                "limit", 350.0,
                                                "month", 2,
                                                "year", 2026))))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.category").value("Groceries & Food / Dining"));

                Budget saved = budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).get(0);
                org.junit.jupiter.api.Assertions.assertEquals("Groceries & Food / Dining", saved.getCategory());
        }

        // Asserts create budget rejects missing required request fields.
        @Test
        void createBudget_missingRequiredField_returnsBadRequest() throws Exception {
                User user = createUser("budget-missing@example.com", "Password123!", "budget-missing");

                mockMvc.perform(post("/api/budgets")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "category", "Food",
                                                "month", 2,
                                                "year", 2026))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts create budget endpoint rejects unauthenticated requests.
        @Test
        void createBudget_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(post("/api/budgets")
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "category", "Food",
                                                "limit", 300.0,
                                                "month", 2,
                                                "year", 2026))))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts get budgets returns only budgets for requested month/year.
        @Test
        void getBudgets_validMonthYear_returnsFilteredBudgets() throws Exception {
                User user = createUser("budget-list@example.com", "Password123!", "budget-list");
                createBudget(user, "Food", 300, LocalDate.of(2026, 3, 1).atStartOfDay().toInstant(ZoneOffset.UTC));
                createBudget(user, "Transport", 200, LocalDate.of(2026, 2, 1).atStartOfDay().toInstant(ZoneOffset.UTC));

                mockMvc.perform(get("/api/budgets")
                                .header(authHeaderName(), authHeader(user))
                                .queryParam("month", "2")
                                .queryParam("year", "2026"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data", hasSize(1)))
                                .andExpect(jsonPath("$.data[0].category").value("Food"));
        }

        // Asserts get budgets endpoint rejects unauthenticated access.
        @Test
        void getBudgets_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(get("/api/budgets").queryParam("month", "2").queryParam("year", "2026"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts patch budget updates mutable fields and persists new values.
        @Test
        void updateBudget_validRequest_returnsUpdatedBudget() throws Exception {
                User user = createUser("budget-update@example.com", "Password123!", "budget-update");
                Budget budget = createBudget(
                                user,
                                "Food",
                                300,
                                LocalDate.of(2026, 3, 1).atStartOfDay().toInstant(ZoneOffset.UTC));

                mockMvc.perform(patch("/api/budgets/{budgetId}", budget.getId())
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("limit", 450.0))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.limit").value(450.0));

                Budget reloaded = budgetRepository.findById(budget.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals(450.0, reloaded.getLimit());
        }

        @Test
        void updateBudget_caseVariantDuplicate_returnsBadRequest() throws Exception {
                User user = createUser("budget-patch-dup@example.com", "Password123!", "budget-patch-dup");
                Budget food = createBudget(user, "Food", 300,
                                LocalDate.of(2026, 3, 1).atStartOfDay().toInstant(ZoneOffset.UTC));
                Budget transport = createBudget(user, "Transport", 200,
                                LocalDate.of(2026, 3, 1).atStartOfDay().toInstant(ZoneOffset.UTC));

                // Attempt to patch transport category to "food" (case-variant of existing
                // "Food")
                mockMvc.perform(patch("/api/budgets/{budgetId}", transport.getId())
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("category", "food"))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false))
                                .andExpect(jsonPath("$.message")
                                                .value("Another budget with this category exists for the same month"));
        }

        @Test
        void updateBudget_normalizesCategoryCanonicalTitleCase() throws Exception {
                User user = createUser("budget-patch-norm@example.com", "Password123!", "budget-patch-norm");
                Budget budget = createBudget(user, "Food", 300,
                                LocalDate.of(2026, 3, 1).atStartOfDay().toInstant(ZoneOffset.UTC));

                mockMvc.perform(patch("/api/budgets/{budgetId}", budget.getId())
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("category", "fast food"))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.category").value("Fast Food"));

                Budget reloaded = budgetRepository.findById(budget.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals("Fast Food", reloaded.getCategory());
        }

        // Asserts patch budget with non-existent ID returns 404.
        @Test
        void updateBudget_nonExistentId_returnsNotFound() throws Exception {
                User user = createUser("budget-update-missing@example.com", "Password123!", "budget-update-missing");

                mockMvc.perform(patch("/api/budgets/{budgetId}", "missing-id")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("limit", 450.0))))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts patch budget rejects unauthenticated access.
        @Test
        void updateBudget_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(patch("/api/budgets/{budgetId}", "some-id")
                                .contentType(json())
                                .content(asJson(Map.of("limit", 450.0))))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts delete budget removes persisted record and returns deleted id.
        @Test
        void deleteBudget_existingBudget_returnsSuccess() throws Exception {
                User user = createUser("budget-delete@example.com", "Password123!", "budget-delete");
                Budget budget = createBudget(
                                user,
                                "Food",
                                300,
                                Instant.parse("2026-03-01T00:00:00Z"));

                mockMvc.perform(delete("/api/budgets/{budgetId}", budget.getId())
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data").value(budget.getId()));

                org.junit.jupiter.api.Assertions.assertFalse(budgetRepository.findById(budget.getId()).isPresent());
        }

        // Asserts delete budget with unknown id returns 404.
        @Test
        void deleteBudget_nonExistentId_returnsNotFound() throws Exception {
                User user = createUser("budget-delete-missing@example.com", "Password123!", "budget-delete-missing");

                mockMvc.perform(delete("/api/budgets/{budgetId}", "missing-id")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts delete budget rejects unauthenticated access.
        @Test
        void deleteBudget_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(delete("/api/budgets/{budgetId}", "any-id"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // TODO: RBAC is not implemented in current security config (no role
        // claims/authorities checks).
        @Disabled("TODO: Enable when endpoint-level role authorization is implemented")
        @Test
        void createBudget_validTokenWrongRole_returnsForbidden() {
        }
}
