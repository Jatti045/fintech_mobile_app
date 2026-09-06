package com.fintechapp.fintech_api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fintechapp.fintech_api.config.SecurityConfig;
import com.fintechapp.fintech_api.security.JsonAuthenticationEntryPoint;
import com.fintechapp.fintech_api.security.JwtAuthenticationFilter;
import com.fintechapp.fintech_api.security.JwtService;
import com.fintechapp.fintech_api.service.PlaidService;
import com.fintechapp.fintech_api.service.PlaidTransactionSyncService;
import com.fintechapp.fintech_api.service.PlaidWebhookService;
import com.fintechapp.fintech_api.service.PlaidWebhookVerificationService;

/**
 * Focused security regression tests for the Plaid webhook endpoint.
 *
 * <p>
 * Verifies that the server-to-server security boundary fails closed:
 * unverified, missing, blank, or tampered webhooks must NEVER invoke webhook
 * business logic or dead-letter storage.
 * </p>
 */
@WebMvcTest(PlaidController.class)
@Import({ SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class, JwtService.class })
@ImportAutoConfiguration({ ServletWebSecurityAutoConfiguration.class, SecurityFilterAutoConfiguration.class })
@TestPropertySource(properties = "app.jwt.secret-key=test-secret-key-test-secret-key-1234567890")
class PlaidWebhookSecurityTest {

    private static final String WEBHOOK_URI = "/api/plaid/webhook";
    private static final String WEBHOOK_URI_TRAILING_SLASH = "/api/plaid/webhook/";
    private static final String PLAID_VERIFICATION_HEADER = "Plaid-Verification";

    private static final String SAMPLE_PAYLOAD = """
            {"webhook_type":"TRANSACTIONS","webhook_code":"SYNC_UPDATES_AVAILABLE","item_id":"item-1"}
            """;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlaidService plaidService;

    @MockitoBean
    private PlaidTransactionSyncService syncService;

    @MockitoBean
    private PlaidWebhookService webhookService;

    @MockitoBean
    private PlaidWebhookVerificationService webhookVerificationService;

    @Test
    void webhook_missingVerificationHeader_returnsUnauthorizedAndNeverInvokesService() throws Exception {
        mockMvc.perform(post(WEBHOOK_URI)
                .contentType(MediaType.APPLICATION_JSON)
                .content(SAMPLE_PAYLOAD))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(webhookVerificationService);
        verifyNoInteractions(webhookService);
    }

    @Test
    void webhook_blankVerificationHeader_returnsUnauthorizedAndNeverInvokesService() throws Exception {
        mockMvc.perform(post(WEBHOOK_URI)
                .contentType(MediaType.APPLICATION_JSON)
                .header(PLAID_VERIFICATION_HEADER, "   ")
                .content(SAMPLE_PAYLOAD))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(webhookVerificationService);
        verifyNoInteractions(webhookService);
    }

    @Test
    void webhook_invalidSignature_returnsUnauthorizedAndNeverInvokesService() throws Exception {
        when(webhookVerificationService.verify(eq("invalid-signature-token"), any())).thenReturn(false);

        mockMvc.perform(post(WEBHOOK_URI)
                .contentType(MediaType.APPLICATION_JSON)
                .header(PLAID_VERIFICATION_HEADER, "invalid-signature-token")
                .content(SAMPLE_PAYLOAD))
                .andExpect(status().isUnauthorized());

        verify(webhookVerificationService).verify(eq("invalid-signature-token"), any());
        verifyNoInteractions(webhookService);
    }

    @Test
    void webhook_validSignature_dispatchesToWebhookService() throws Exception {
        when(webhookVerificationService.verify(eq("valid-jwt-token"), any())).thenReturn(true);

        mockMvc.perform(post(WEBHOOK_URI)
                .contentType(MediaType.APPLICATION_JSON)
                .header(PLAID_VERIFICATION_HEADER, "valid-jwt-token")
                .content(SAMPLE_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(webhookVerificationService).verify(eq("valid-jwt-token"), any());
        verify(webhookService).handleWebhook(any());
    }

    @Test
    void webhook_trailingSlash_missingHeader_returnsUnauthorized() throws Exception {
        mockMvc.perform(post(WEBHOOK_URI_TRAILING_SLASH)
                .contentType(MediaType.APPLICATION_JSON)
                .content(SAMPLE_PAYLOAD))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(webhookVerificationService);
        verifyNoInteractions(webhookService);
    }

    @Test
    void webhook_trailingSlash_validSignature_dispatchesToWebhookService() throws Exception {
        when(webhookVerificationService.verify(eq("valid-jwt-token"), any())).thenReturn(true);

        mockMvc.perform(post(WEBHOOK_URI_TRAILING_SLASH)
                .contentType(MediaType.APPLICATION_JSON)
                .header(PLAID_VERIFICATION_HEADER, "valid-jwt-token")
                .content(SAMPLE_PAYLOAD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(webhookVerificationService).verify(eq("valid-jwt-token"), any());
        verify(webhookService).handleWebhook(any());
    }

    @Test
    void webhook_validSignature_malformedJsonBody_deadLettersAndAcks200() throws Exception {
        when(webhookVerificationService.verify(eq("valid-jwt-token"), any())).thenReturn(true);

        mockMvc.perform(post(WEBHOOK_URI)
                .contentType(MediaType.APPLICATION_JSON)
                .header(PLAID_VERIFICATION_HEADER, "valid-jwt-token")
                .content("{invalid-json-body"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(webhookVerificationService).verify(eq("valid-jwt-token"), any());
        verify(webhookService).deadLetterWebhook(eq("{invalid-json-body"), any());
        verify(webhookService, never()).handleWebhook(any());
    }

    @Test
    void webhook_unverified_malformedJsonBody_returnsUnauthorizedAndDoesNotDeadLetter() throws Exception {
        mockMvc.perform(post(WEBHOOK_URI)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{invalid-json-body"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(webhookVerificationService);
        verifyNoInteractions(webhookService);
    }
}
