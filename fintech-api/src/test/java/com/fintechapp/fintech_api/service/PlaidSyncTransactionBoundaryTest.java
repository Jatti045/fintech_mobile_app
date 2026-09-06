package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.fintechapp.fintech_api.config.PlaidConfig.PlaidSettings;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

/**
 * Verifies that the Plaid /transactions/sync external HTTP request executes
 * strictly OUTSIDE any database transaction, and that database operations
 * execute inside a short, dedicated transaction.
 */
@ExtendWith(MockitoExtension.class)
class PlaidSyncTransactionBoundaryTest {

    @Mock
    private RestClient plaidRestClient;

    @Mock
    private EncryptionService encryptionService;

    @Mock
    private PlaidItemRepository plaidItemRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PlaidTransactionIngestService ingestService;

    @Mock
    private FinancialCacheInvalidator cacheInvalidator;

    private PlaidService plaidService;
    private PlaidItem item;
    private User user;
    private ObjectMapper mapper = new ObjectMapper();

    private AtomicBoolean txActiveDuringHttp = new AtomicBoolean(false);
    private AtomicBoolean txActiveDuringPersistence = new AtomicBoolean(false);

    @BeforeEach
    void setUp() {
        PlaidSettings settings = new PlaidSettings(
                "client-id", "secret", "https://sandbox.plaid.com", "https://example.com/webhook",
                List.of("US"), "en");

        // Custom transaction manager tracking actual transaction state
        PlatformTransactionManager txManager = new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                TransactionSynchronizationManager.setActualTransactionActive(true);
                TransactionSynchronizationManager.initSynchronization();
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {
                TransactionSynchronizationManager.clearSynchronization();
                TransactionSynchronizationManager.setActualTransactionActive(false);
            }

            @Override
            public void rollback(TransactionStatus status) {
                TransactionSynchronizationManager.clearSynchronization();
                TransactionSynchronizationManager.setActualTransactionActive(false);
            }
        };

        plaidService = new PlaidService(
                plaidRestClient, settings, encryptionService, plaidItemRepository,
                userRepository, ingestService, cacheInvalidator, Optional.of(txManager));

        user = new User();
        user.setId("user-1");

        item = new PlaidItem();
        item.setItemId("item-1");
        item.setAccessTokenEncrypted("enc-token");
        item.setCursor("cursor-0");
        item.setUser(user);
    }

    private void stubHttpCall(JsonNode responsePayload) {
        RestClient.RequestBodyUriSpec postSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(plaidRestClient.post()).thenReturn(postSpec);
        when(postSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);

        when(responseSpec.body(JsonNode.class)).thenAnswer(inv -> {
            // Check if transaction is active during HTTP I/O
            txActiveDuringHttp.set(TransactionSynchronizationManager.isActualTransactionActive());
            return responsePayload;
        });
    }

    @Test
    void fetchAndApplySyncPage_httpCallOccursOutsideTransaction_persistenceInsideTransaction() throws Exception {
        JsonNode payload = mapper.readTree("""
                {
                  "added": [],
                  "modified": [],
                  "removed": [],
                  "next_cursor": "cursor-1",
                  "has_more": false
                }
                """);
        stubHttpCall(payload);

        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
        when(plaidItemRepository.findByItemIdForUpdate("item-1")).thenReturn(Optional.of(item));
        when(encryptionService.decrypt("enc-token")).thenReturn("dec-token");
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));

        doAnswer(inv -> {
            txActiveDuringPersistence.set(TransactionSynchronizationManager.isActualTransactionActive());
            return null;
        }).when(ingestService).upsertAddedBatch(any(), any());

        PlaidService.SyncPageResult result = plaidService.fetchAndApplySyncPage("item-1");

        // PROOF: HTTP call executed while no database transaction was active
        assertFalse(txActiveDuringHttp.get(),
                "External Plaid HTTP call must execute outside any database transaction");

        // PROOF: Persistence executed while database transaction WAS active
        assertTrue(txActiveDuringPersistence.get(),
                "Database writes must execute inside an active database transaction");

        assertEquals("cursor-1", result.nextCursor());
        assertFalse(result.hasMore());
        assertEquals("cursor-1", item.getCursor());
        verify(plaidItemRepository).save(item);
    }

    @Test
    void fetchAndApplySyncPage_httpError_noTransactionStartedOrLeftOpen() {
        RestClient.RequestBodyUriSpec postSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(plaidRestClient.post()).thenReturn(postSpec);
        when(postSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any(MediaType.class))).thenReturn(bodySpec);
        when(bodySpec.body(any(Object.class))).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);

        when(responseSpec.body(JsonNode.class)).thenThrow(new RestClientException("Connection timed out"));

        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
        when(encryptionService.decrypt("enc-token")).thenReturn("dec-token");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> plaidService.fetchAndApplySyncPage("item-1"));

        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        assertFalse(TransactionSynchronizationManager.isActualTransactionActive(),
                "No database transaction should remain active after HTTP error");
        assertEquals("cursor-0", item.getCursor(), "Cursor must not change on HTTP failure");
    }

    @Test
    void fetchAndApplySyncPage_persistenceError_rollsBackTransaction() throws Exception {
        JsonNode payload = mapper.readTree("""
                {
                  "added": [],
                  "modified": [],
                  "removed": [],
                  "next_cursor": "cursor-fail",
                  "has_more": false
                }
                """);
        stubHttpCall(payload);

        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
        when(plaidItemRepository.findByItemIdForUpdate("item-1")).thenReturn(Optional.of(item));
        when(encryptionService.decrypt("enc-token")).thenReturn("dec-token");
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));

        // Simulate persistence exception (e.g. database constraint violation)
        doAnswer(inv -> {
            throw new RuntimeException("Database error during ingest");
        }).when(ingestService).upsertAddedBatch(any(), any());

        assertThrows(RuntimeException.class, () -> plaidService.fetchAndApplySyncPage("item-1"));

        assertFalse(TransactionSynchronizationManager.isActualTransactionActive(),
                "Transaction must be rolled back and not left active");
    }
}
