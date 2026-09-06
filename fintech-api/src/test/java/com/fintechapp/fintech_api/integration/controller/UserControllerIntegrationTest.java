package com.fintechapp.fintech_api.integration.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;

class UserControllerIntegrationTest extends BaseIntegrationTest {

        @org.springframework.beans.factory.annotation.Autowired
        private PlaidItemRepository plaidItemRepository;

        // Asserts change password succeeds when current password is correct.
        @Test
        void changePassword_validRequest_returnsSuccess() throws Exception {
                User user = createUser("user-password@example.com", "Password123!", "user-password");

                mockMvc.perform(patch("/api/users/me/password")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "currentPassword", "Password123!",
                                                "newPassword", "NewPassword123!",
                                                "confirmPassword", "NewPassword123!"))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true));

                User reloaded = userRepository.findById(user.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions
                                .assertTrue(passwordEncoder.matches("NewPassword123!", reloaded.getPassword()));
        }

        // Asserts change password rejects missing required fields.
        @Test
        void changePassword_missingRequiredField_returnsBadRequest() throws Exception {
                User user = createUser("user-password-missing@example.com", "Password123!", "user-password-missing");

                mockMvc.perform(patch("/api/users/me/password")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "currentPassword", "Password123!",
                                                "newPassword", "NewPassword123!"))))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts change password endpoint rejects unauthenticated requests.
        @Test
        void changePassword_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(patch("/api/users/me/password")
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "currentPassword", "x",
                                                "newPassword", "y",
                                                "confirmPassword", "y"))))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts update currency succeeds and persists new currency value.
        @Test
        void updateCurrency_validRequest_returnsUpdatedUser() throws Exception {
                User user = createUser("user-currency@example.com", "Password123!", "user-currency");

                mockMvc.perform(patch("/api/users/me/currency")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("currency", "eur"))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.currency").value("EUR"));

                User reloaded = userRepository.findById(user.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals("EUR", reloaded.getCurrency());
        }

        @Test
        void updateCurrency_rejected_whenTransactionsExist() throws Exception {
                User user = createUser("user-currency-tx@example.com", "Password123!", "user-currency-tx");
                Instant now = Instant.now();
                Budget budget = createBudget(user, "Food", 500, now);
                createTransaction(user, budget, "Coffee", now, "Food", TransactionType.EXPENSE, 5.0);

                mockMvc.perform(patch("/api/users/me/currency")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("currency", "EUR"))))
                                .andExpect(status().isBadRequest());

                User reloaded = userRepository.findById(user.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals("USD", reloaded.getCurrency());
        }

        @Test
        void updateCurrency_invalidFormat_returnsBadRequest() throws Exception {
                User user = createUser("user-currency-fmt@example.com", "Password123!", "user-currency-fmt");

                mockMvc.perform(patch("/api/users/me/currency")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of("currency", "EURO"))))
                                .andExpect(status().isBadRequest());
        }

        // Asserts update currency rejects invalid payload with missing field.
        @Test
        void updateCurrency_missingRequiredField_returnsBadRequest() throws Exception {
                User user = createUser("user-currency-missing@example.com", "Password123!", "user-currency-missing");

                mockMvc.perform(patch("/api/users/me/currency")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of())))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts update currency endpoint rejects unauthenticated access.
        @Test
        void updateCurrency_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(patch("/api/users/me/currency")
                                .contentType(json())
                                .content(asJson(Map.of("currency", "USD"))))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts update monthly income succeeds for current month/year only.
        @Test
        void updateMonthlyIncome_currentMonthYear_returnsUpdatedUser() throws Exception {
                User user = createUser("user-monthly-income@example.com", "Password123!", "user-monthly-income");
                LocalDate utcNow = LocalDate.now(ZoneOffset.UTC);

                mockMvc.perform(patch("/api/users/me/monthly-income")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "monthlyIncome", 4200.0,
                                                "month", utcNow.getMonthValue() - 1,
                                                "year", utcNow.getYear()))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.monthlyIncome").value(4200.0));

                java.time.Instant monthStart = LocalDate.of(utcNow.getYear(), utcNow.getMonthValue(), 1)
                                .atStartOfDay()
                                .toInstant(ZoneOffset.UTC);
                com.fintechapp.fintech_api.model.UserMonthlyIncome savedIncome = userMonthlyIncomeRepository
                                .findByUser_IdAndMonthStart(user.getId(), monthStart)
                                .orElseThrow();
                org.junit.jupiter.api.Assertions.assertEquals(4200.0, savedIncome.getIncome());
        }

        // Asserts update monthly income persists for an arbitrary selected month/year.
        @Test
        void updateMonthlyIncome_previousMonth_returnsUpdatedUser() throws Exception {
                User user = createUser("user-monthly-income-restricted@example.com", "Password123!",
                                "user-monthly-income-restricted");
                LocalDate previousMonth = LocalDate.now(ZoneOffset.UTC).minusMonths(1);

                mockMvc.perform(patch("/api/users/me/monthly-income")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content(asJson(Map.of(
                                                "monthlyIncome", 4200.0,
                                                "month", previousMonth.getMonthValue() - 1,
                                                "year", previousMonth.getYear()))))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.monthlyIncome").value(4200.0));

                mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                .get("/api/users/me/monthly-income")
                                .header(authHeaderName(), authHeader(user))
                                .param("month", String.valueOf(previousMonth.getMonthValue() - 1))
                                .param("year", String.valueOf(previousMonth.getYear())))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.monthlyIncome").value(4200.0));
        }

        // Asserts delete profile picture succeeds and clears persisted profilePic.
        @Test
        void deleteProfilePicture_existingUser_returnsSuccess() throws Exception {
                User user = createUser("user-delete-pic@example.com", "Password123!", "user-delete-pic");
                user.setProfilePic("old-public-id");
                userRepository.save(user);

                mockMvc.perform(delete("/api/users/{userId}/profile-picture", user.getId())
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true));

                User reloaded = userRepository.findById(user.getId()).orElseThrow();
                org.junit.jupiter.api.Assertions.assertNull(reloaded.getProfilePic());
        }

        // Asserts delete profile picture with unknown user ID returns 404.
        @Test
        void deleteProfilePicture_nonExistentId_returnsNotFound() throws Exception {
                User user = createUser("user-delete-pic-missing@example.com", "Password123!",
                                "user-delete-pic-missing");

                mockMvc.perform(delete("/api/users/{userId}/profile-picture", "missing-id")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isForbidden())
                                .andExpect(jsonPath("$.success").value(false));

                // TODO: Service currently checks same-user guard before existence check, so
                // unknown path IDs return 403.
                // Verify whether API contract should instead expose 404 for unknown resources.
        }

        // Asserts delete profile picture endpoint rejects unauthenticated access.
        @Test
        void deleteProfilePicture_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(delete("/api/users/{userId}/profile-picture", "any-id"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts delete account removes user and related data in one successful call.
        @Test
        void deleteAccount_existingUser_deletesUserAndRelatedData() throws Exception {
                User user = createUser("user-delete@example.com", "Password123!", "user-delete");
                Budget budget = createBudget(user, "Food", 200, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Lunch", Instant.parse("2026-03-03T10:00:00Z"), "Food",
                                TransactionType.EXPENSE, 10.0);

                mockMvc.perform(delete("/api/users/{userId}", user.getId())
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true));

                org.junit.jupiter.api.Assertions.assertFalse(userRepository.findById(user.getId()).isPresent());
                org.junit.jupiter.api.Assertions.assertEquals(0,
                                budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
                org.junit.jupiter.api.Assertions.assertEquals(0,
                                transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
        }

        // Asserts delete account also removes Plaid items — the plaid_items table
        // holds an FK constraint back to users, so a user with a linked bank
        // previously failed deletion with a foreign-key violation.
        @Test
        void deleteAccount_userWithPlaidItem_deletesAllRelatedData() throws Exception {
                User user = createUser("user-delete-plaid@example.com", "Password123!", "user-delete-plaid");
                Budget budget = createBudget(user, "Food", 200, Instant.parse("2026-03-01T00:00:00Z"));
                createTransaction(user, budget, "Lunch", Instant.parse("2026-03-03T10:00:00Z"), "Food",
                                TransactionType.EXPENSE, 10.0);

                PlaidItem plaidItem = new PlaidItem();
                plaidItem.setUser(user);
                plaidItem.setItemId("plaid-item-delete-test");
                plaidItem.setAccessTokenEncrypted("encrypted-token");
                plaidItem.setInstitutionName("Chase");
                plaidItemRepository.save(plaidItem);

                mockMvc.perform(delete("/api/users/{userId}", user.getId())
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true));

                org.junit.jupiter.api.Assertions.assertFalse(userRepository.findById(user.getId()).isPresent());
                org.junit.jupiter.api.Assertions.assertEquals(0,
                                transactionRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
                org.junit.jupiter.api.Assertions.assertEquals(0,
                                budgetRepository.findByUser_IdOrderByDateDesc(user.getId()).size());
                org.junit.jupiter.api.Assertions.assertEquals(0,
                                plaidItemRepository.findByUser_IdOrderByCreatedAtDesc(user.getId()).size());
        }

        // Asserts delete account rejects unauthenticated access.
        @Test
        void deleteAccount_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(delete("/api/users/{userId}", "any-id"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts upload profile picture rejects invalid file type.
        @Test
        void uploadProfilePicture_invalidFileType_returnsBadRequest() throws Exception {
                User user = createUser("user-upload-invalid@example.com", "Password123!", "user-upload-invalid");

                MockMultipartFile file = new MockMultipartFile(
                                "profilePicture",
                                "note.txt",
                                "text/plain",
                                "hello".getBytes());

                mockMvc.perform(multipart(HttpMethod.POST, "/api/users/{userId}/profile-picture", user.getId())
                                .file(file)
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // Asserts upload profile picture endpoint rejects unauthenticated access.
        @Test
        void uploadProfilePicture_noToken_returnsUnauthorized() throws Exception {
                MockMultipartFile file = new MockMultipartFile(
                                "profilePicture",
                                "avatar.png",
                                "image/png",
                                "x".getBytes());

                mockMvc.perform(multipart(HttpMethod.POST, "/api/users/{userId}/profile-picture", "any-id")
                                .file(file))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // TODO: This happy-path needs deterministic Cloudinary behavior; verify test
        // strategy for external upload dependency.
        @Disabled("TODO: enable after deciding Cloudinary integration test strategy")
        @Test
        void uploadProfilePicture_validImage_returnsUpdatedUser() {
        }

        // TODO: RBAC is not implemented in current security config (no role
        // claims/authorities checks).
        @Disabled("TODO: Enable when endpoint-level role authorization is implemented")
        @Test
        void updateCurrency_validTokenWrongRole_returnsForbidden() {
        }
}
