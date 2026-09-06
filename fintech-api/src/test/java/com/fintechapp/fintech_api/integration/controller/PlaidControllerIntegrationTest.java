package com.fintechapp.fintech_api.integration.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.plaid.PlaidItemResponse;
import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.service.PlaidService;
import com.fintechapp.fintech_api.service.PlaidTransactionSyncService;
import com.fintechapp.fintech_api.service.PlaidWebhookService;
import com.fintechapp.fintech_api.service.PlaidWebhookVerificationService;

/**
 * End-to-end tests for the {@code /api/plaid} endpoints (link-token, token
 * exchange, items, disconnect, webhook) against the real security filter
 * chain. The Plaid services are mocked so no real Plaid HTTP call happens.
 */
class PlaidControllerIntegrationTest extends BaseIntegrationTest {

        @MockitoBean
        private PlaidService plaidService;

        @MockitoBean
        private PlaidTransactionSyncService syncService;

        @MockitoBean
        private PlaidWebhookService webhookService;

        @MockitoBean
        private PlaidWebhookVerificationService webhookVerificationService;

        // ── GET /api/plaid/items ────────────────────────────────────────────────

        @Test
        void listItems_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(get("/api/plaid/items"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        void listItems_validToken_returnsConnectedItems() throws Exception {
                User user = createUser("plaid-list@example.com", "Password123!", "plaid-list");
                when(plaidService.listItems(any())).thenReturn(List.of(
                                new PlaidItemResponse(
                                                "item-db-1",
                                                "plaid-item-1",
                                                "Chase",
                                                Instant.ofEpochSecond(1_700_000_000L),
                                                "ACTIVE",
                                                false,
                                                Instant.ofEpochSecond(1_700_000_100L),
                                                null)));

                mockMvc.perform(get("/api/plaid/items")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.items").isArray())
                                .andExpect(jsonPath("$.data.items[0].id").value("item-db-1"))
                                .andExpect(jsonPath("$.data.items[0].itemId").value("plaid-item-1"))
                                .andExpect(jsonPath("$.data.items[0].institutionName").value("Chase"))
                                .andExpect(jsonPath("$.data.items[0].status").value("ACTIVE"))
                                .andExpect(jsonPath("$.data.items[0].syncError").value(false))
                                .andExpect(jsonPath("$.data.items[0].lastSyncedAt").exists());

                verify(plaidService).listItems(any());
        }

        @Test
        void listItems_validToken_noConnections_returnsEmptyArray() throws Exception {
                User user = createUser("plaid-empty@example.com", "Password123!", "plaid-empty");
                when(plaidService.listItems(any())).thenReturn(List.of());

                mockMvc.perform(get("/api/plaid/items")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.items").isArray())
                                .andExpect(jsonPath("$.data.items").isEmpty());
        }

        // ── POST /api/plaid/link-token ───────────────────────────────────────────

        @Test
        void createLinkToken_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(post("/api/plaid/link-token"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        void createLinkToken_validToken_returnsLinkToken() throws Exception {
                User user = createUser("plaid-link@example.com", "Password123!", "plaid-link");
                when(plaidService.createLinkToken(any())).thenReturn("link-token-abc123");

                mockMvc.perform(post("/api/plaid/link-token")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.linkToken").value("link-token-abc123"));

                verify(plaidService).createLinkToken(any());
        }

        // ── POST /api/plaid/token ────────────────────────────────────────────────

        @Test
        void exchangePublicToken_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(post("/api/plaid/token")
                                .contentType(json())
                                .content("{\"publicToken\":\"pub-1\"}"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        void exchangePublicToken_validToken_exchangesAndKicksOffSync() throws Exception {
                User user = createUser("plaid-exchange@example.com", "Password123!", "plaid-exchange");
                PlaidItem item = new PlaidItem();
                item.setId("item-db-1");
                item.setItemId("plaid-item-1");
                item.setInstitutionName("Chase");
                item.setCreatedAt(Instant.ofEpochSecond(1_700_000_000L));
                when(plaidService.exchangePublicToken(any(), eq("pub-1"))).thenReturn(item);

                mockMvc.perform(post("/api/plaid/token")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content("{\"publicToken\":\"pub-1\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.message").value("Bank connected"))
                                .andExpect(jsonPath("$.data.item.itemId").value("plaid-item-1"));

                // Initial sync is dispatched on the background executor.
                verify(syncService).syncItemAsync("plaid-item-1");
        }

        @Test
        void exchangePublicToken_blankPublicToken_returnsBadRequest() throws Exception {
                User user = createUser("plaid-exchange-blank@example.com", "Password123!", "plaid-exchange-blank");

                mockMvc.perform(post("/api/plaid/token")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json())
                                .content("{\"publicToken\":\"\"}"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        void exchangePublicToken_missingBody_returnsBadRequest() throws Exception {
                User user = createUser("plaid-exchange-none@example.com", "Password123!", "plaid-exchange-none");

                mockMvc.perform(post("/api/plaid/token")
                                .header(authHeaderName(), authHeader(user))
                                .contentType(json()))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.success").value(false));
        }

        // ── POST /api/plaid/webhook (public endpoint, requires Plaid signature) ─

        @Test
        void handleWebhook_missingVerificationHeader_returnsUnauthorized() throws Exception {
                mockMvc.perform(post("/api/plaid/webhook")
                                .contentType(json())
                                .content("{\"webhook_type\":\"TRANSACTIONS\",\"webhook_code\":\"SYNC_UPDATES_AVAILABLE\",\"item_id\":\"item-1\"}"))
                                .andExpect(status().isUnauthorized());

                verify(webhookService, never()).handleWebhook(any());
        }

        @Test
        void handleWebhook_validPayload_forwardsToWebhookService() throws Exception {
                when(webhookVerificationService.verify(eq("valid-jwt"), any())).thenReturn(true);
                Map<String, Object> payload = Map.of(
                                "webhook_type", "TRANSACTIONS",
                                "webhook_code", "SYNC_UPDATES_AVAILABLE",
                                "item_id", "item-77");

                mockMvc.perform(post("/api/plaid/webhook")
                                .header("Plaid-Verification", "valid-jwt")
                                .contentType(json())
                                .content(asJson(payload)))
                                .andExpect(status().isOk());

                verify(webhookService).handleWebhook(payload);
        }

        @Test
        void handleWebhook_nonTransactionPayload_returns200() throws Exception {
                when(webhookVerificationService.verify(eq("valid-jwt"), any())).thenReturn(true);

                mockMvc.perform(post("/api/plaid/webhook")
                                .header("Plaid-Verification", "valid-jwt")
                                .contentType(json())
                                .content("{\"webhook_type\":\"TRANSFER\",\"webhook_code\":\"TRANSFER_EVENTS_UPDATE\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true));
        }

        @Test
        void handleWebhook_trailingSlash_noAuth_returnsUnauthorized() throws Exception {
                mockMvc.perform(post("/api/plaid/webhook/")
                                .contentType(json())
                                .content("{\"webhook_type\":\"TRANSACTIONS\",\"webhook_code\":\"SYNC_UPDATES_AVAILABLE\",\"item_id\":\"item-1\"}"))
                                .andExpect(status().isUnauthorized());

                verify(webhookService, never()).handleWebhook(any());
        }

        @Test
        void handleWebhook_trailingSlash_validAuth_returns200() throws Exception {
                when(webhookVerificationService.verify(eq("valid-jwt"), any())).thenReturn(true);

                mockMvc.perform(post("/api/plaid/webhook/")
                                .header("Plaid-Verification", "valid-jwt")
                                .contentType(json())
                                .content("{\"webhook_type\":\"TRANSACTIONS\",\"webhook_code\":\"SYNC_UPDATES_AVAILABLE\",\"item_id\":\"item-1\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true));
        }

        @Test
        void handleWebhook_invalidVerificationHeader_returnsUnauthorized() throws Exception {
                when(webhookVerificationService.verify(eq("not-a-jwt"), any())).thenReturn(false);

                mockMvc.perform(post("/api/plaid/webhook")
                                .contentType(json())
                                .header("Plaid-Verification", "not-a-jwt")
                                .content("{\"webhook_type\":\"TRANSACTIONS\",\"webhook_code\":\"SYNC_UPDATES_AVAILABLE\",\"item_id\":\"item-1\"}"))
                                .andExpect(status().isUnauthorized());

                verify(webhookService, never()).handleWebhook(any());
        }

        @Test
        void handleWebhook_invalidJsonBody_withValidVerification_deadLettersAndAcks200() throws Exception {
                when(webhookVerificationService.verify(eq("valid-jwt"), any())).thenReturn(true);

                // Contract: malformed payloads that are cryptographically verified are
                // dead-lettered
                // and acked with 200 so Plaid does not retry a payload that can never parse.
                mockMvc.perform(post("/api/plaid/webhook")
                                .header("Plaid-Verification", "valid-jwt")
                                .contentType(json())
                                .content("{not-json"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true));

                verify(webhookService).deadLetterWebhook(eq("{not-json"), any());
                verify(webhookService, never()).handleWebhook(any());
        }

        // ── DELETE /api/plaid/items/{itemId} ────────────────────────────────────

        @Test
        void disconnectItem_noToken_returnsUnauthorized() throws Exception {
                mockMvc.perform(delete("/api/plaid/items/item-db-1"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.success").value(false));
        }

        @Test
        void disconnectItem_validToken_deletesItemAndReturnsSuccess() throws Exception {
                User user = createUser("plaid-delete@example.com", "Password123!", "plaid-delete");
                when(plaidService.disconnectItem(any(), eq("item-db-1"))).thenReturn("item-db-1");

                mockMvc.perform(delete("/api/plaid/items/{itemId}", "item-db-1")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.success").value(true))
                                .andExpect(jsonPath("$.data.deletedItemId").value("item-db-1"));

                verify(plaidService).disconnectItem(any(), eq("item-db-1"));
        }

        @Test
        void disconnectItem_nonExistentOrForeignItem_returnsNotFound() throws Exception {
                User user = createUser("plaid-delete-missing@example.com", "Password123!", "plaid-delete-missing");
                when(plaidService.disconnectItem(any(), eq("missing-item")))
                                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Plaid item not found"));

                mockMvc.perform(delete("/api/plaid/items/{itemId}", "missing-item")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.success").value(false))
                                .andExpect(jsonPath("$.message").value("Plaid item not found"));
        }

        @Test
        void disconnectItem_emptyItemId_returnsNotFound() throws Exception {
                User user = createUser("plaid-delete-empty@example.com", "Password123!", "plaid-delete-empty");
                when(plaidService.disconnectItem(any(), eq("")))
                                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Plaid item not found"));

                mockMvc.perform(delete("/api/plaid/items/{itemId}", "")
                                .header(authHeaderName(), authHeader(user)))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.success").value(false));
        }
}
