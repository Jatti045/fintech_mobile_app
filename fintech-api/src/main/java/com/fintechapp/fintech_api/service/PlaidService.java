package com.fintechapp.fintech_api.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.fintechapp.fintech_api.config.PlaidConfig;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.plaid.PlaidItemResponse;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.PlaidItemStatus;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.repository.UserRepository;
import com.fintechapp.fintech_api.service.PlaidTransactionIngestService.PlaidTransaction;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Client for the Plaid HTTP API plus the orchestration that binds link-token
 * creation, item token exchange, and asynchronous transaction ingestion.
 *
 * <p>
 * All requests are made server-side with the plaid {@code client_id} and
 * {@code secret}; clients only ever see scoped link/public tokens. The durable
 * {@code access_token} is encrypted before it is persisted.
 * </p>
 */
@Service
public class PlaidService {

    /** Result of one /transactions/sync page. */
    public record SyncPageResult(String nextCursor, boolean hasMore) {
    }

    private static final String PRODUCT_TRANSACTIONS = "transactions";
    private static final int SYNC_COUNT = 500;
    private static final DateTimeFormatter ISO_OFFSET = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final DateTimeFormatter PLAID_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private static final Logger logger = LoggerFactory.getLogger(PlaidService.class);

    /** Used only to parse Plaid's error payloads so they can be surfaced. */
    private static final ObjectMapper ERROR_BODY_MAPPER = new ObjectMapper();

    private final RestClient plaidRestClient;
    private final PlaidConfig.PlaidSettings settings;
    private final EncryptionService encryptionService;
    private final PlaidItemRepository plaidItemRepository;
    private final UserRepository userRepository;
    private final PlaidTransactionIngestService ingestService;
    private final FinancialCacheInvalidator cacheInvalidator;
    private final TransactionTemplate transactionTemplate;

    @Autowired
    public PlaidService(
            @Qualifier("plaidRestClient") RestClient plaidRestClient,
            PlaidConfig.PlaidSettings settings,
            EncryptionService encryptionService,
            PlaidItemRepository plaidItemRepository,
            UserRepository userRepository,
            PlaidTransactionIngestService ingestService,
            FinancialCacheInvalidator cacheInvalidator,
            Optional<PlatformTransactionManager> transactionManager) {
        this.plaidRestClient = plaidRestClient;
        this.settings = settings;
        this.encryptionService = encryptionService;
        this.plaidItemRepository = plaidItemRepository;
        this.userRepository = userRepository;
        this.ingestService = ingestService;
        this.cacheInvalidator = cacheInvalidator;
        this.transactionTemplate = transactionManager != null && transactionManager.isPresent()
                ? new TransactionTemplate(transactionManager.get())
                : null;
    }

    public PlaidService(
            @Qualifier("plaidRestClient") RestClient plaidRestClient,
            PlaidConfig.PlaidSettings settings,
            EncryptionService encryptionService,
            PlaidItemRepository plaidItemRepository,
            UserRepository userRepository,
            PlaidTransactionIngestService ingestService,
            FinancialCacheInvalidator cacheInvalidator) {
        this(plaidRestClient, settings, encryptionService, plaidItemRepository, userRepository, ingestService,
                cacheInvalidator, Optional.empty());
    }

    private <T> T inTransaction(TransactionCallback<T> action) {
        if (transactionTemplate != null) {
            return transactionTemplate.execute(action);
        }
        return action.doInTransaction(new SimpleTransactionStatus());
    }

    /**
     * Creates a Plaid Link token for the authenticated user, configured for
     * transaction tracking and pointing at our webhook handler.
     */
    public String createLinkToken(AuthenticatedUser authenticatedUser) {
        String userId = requireUserId(authenticatedUser);

        Map<String, Object> body = baseBody();
        body.put("client_name", "Budgee");
        body.put("country_codes", settings.countryCodes());
        body.put("language", settings.language());
        body.put("user", Map.of("client_user_id", userId));
        body.put("products", List.of(PRODUCT_TRANSACTIONS));
        body.put("transactions", Map.of("days_requested", 365));
        if (StringUtils.hasText(settings.webhookUrl())) {
            body.put("webhook", settings.webhookUrl());
        } else {
            logger.warn("PLAID_WEBHOOK_URL is not configured; link tokens are created WITHOUT a webhook URL "
                    + "and Plaid will not send webhooks for new items.");
        }

        JsonNode response = post("/link/token/create", body);
        JsonNode linkToken = response.get("link_token");
        if (linkToken == null || !StringUtils.hasText(linkToken.asString())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Plaid did not return a link token.");
        }
        return linkToken.asString();
    }

    /**
     * Exchanges a {@code public_token} (returned by the mobile Plaid Link flow)
     * for a durable {@code access_token} + {@code item_id}, persists the item
     * with the access token encrypted at rest, and returns the saved item.
     */
    @Transactional
    public PlaidItem exchangePublicToken(AuthenticatedUser authenticatedUser, String publicToken) {
        String userId = requireUserId(authenticatedUser);
        if (!StringUtils.hasText(publicToken)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "publicToken is required");
        }

        Map<String, Object> body = baseBody();
        body.put("public_token", publicToken.trim());

        JsonNode response = post("/item/public_token/exchange", body);
        JsonNode accessTokenNode = response.get("access_token");
        JsonNode itemIdNode = response.get("item_id");
        if (accessTokenNode == null || itemIdNode == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Plaid token exchange failed.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated"));

        PlaidItem item = new PlaidItem();
        item.setUser(user);
        item.setItemId(itemIdNode.asString());
        item.setAccessTokenEncrypted(encryptionService.encrypt(accessTokenNode.asString()));
        return plaidItemRepository.save(item);
    }

    /**
     * Fetches a single /transactions/sync page for the item, applies
     * added/modified/removed records idempotently, and advances the stored
     * cursor.
     *
     * <p>
     * The external Plaid HTTP call executes strictly outside any database
     * transaction, without holding any row locks or database connections.
     * The returned page is then persisted atomically within a short, dedicated
     * database transaction.
     * </p>
     */
    public SyncPageResult fetchAndApplySyncPage(String itemId) {
        // Step 1: Read cursor and decrypt access token outside of any database
        // transaction.
        PlaidItem item = plaidItemRepository.findByItemId(itemId)
                .or(() -> plaidItemRepository.findByItemIdForUpdate(itemId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plaid item not found"));
        String cursor = item.getCursor();
        String userId = item.getUser().getId();

        String accessToken;
        try {
            accessToken = encryptionService.decrypt(item.getAccessTokenEncrypted());
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not decrypt Plaid access token.",
                    ex);
        }

        Map<String, Object> body = baseBody();
        body.put("access_token", accessToken);
        body.put("count", SYNC_COUNT);
        if (StringUtils.hasText(cursor)) {
            body.put("cursor", cursor);
        }

        // Step 2: External Plaid HTTP call happens OUTSIDE of any database transaction.
        JsonNode response = post("/transactions/sync", body);

        // Step 3: Persist the returned page in a short, dedicated database transaction.
        return inTransaction(status -> {
            PlaidItem managedItem = plaidItemRepository.findByItemIdForUpdate(itemId)
                    .or(() -> plaidItemRepository.findByItemId(itemId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plaid item not found"));

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
            List<String> removedIds = new ArrayList<>();

            List<PlaidTransaction> added = nodes(response, "added").stream()
                    .map(node -> toPlaidTransaction(node, managedItem.getItemId()))
                    .toList();
            List<PlaidTransaction> modified = nodes(response, "modified").stream()
                    .map(node -> toPlaidTransaction(node, managedItem.getItemId()))
                    .toList();
            ingestService.upsertAddedBatch(user, added);
            for (PlaidTransaction plaidTx : modified) {
                ingestService.upsertTransaction(user, plaidTx);
            }
            for (JsonNode node : nodes(response, "removed")) {
                JsonNode txId = node.get("transaction_id");
                if (txId != null && StringUtils.hasText(txId.asString())) {
                    removedIds.add(txId.asString());
                }
            }
            if (!removedIds.isEmpty()) {
                ingestService.removeByPlaidIds(removedIds, userId);
            }

            String nextCursor = response.path("next_cursor").asString(null);
            boolean hasMore = response.path("has_more").asBoolean(false);

            managedItem.setCursor(StringUtils.hasText(nextCursor) ? nextCursor : managedItem.getCursor());
            managedItem.setLastSyncedAt(Instant.now());
            managedItem.setSyncError(false);
            plaidItemRepository.save(managedItem);

            logger.info("Plaid sync payload received for item_id={}: added={}, modified={}, removed={}, new_cursor={}",
                    itemId, added.size(), modified.size(), removedIds.size(), nextCursor);

            cacheInvalidator.evictFinancialSummaryRegion(userId);
            cacheInvalidator.evictRecurringPayments(userId);

            registerCursorCommitMilestone(itemId, userId, cursor, managedItem.getCursor());

            return new SyncPageResult(managedItem.getCursor(), hasMore);
        });
    }

    /**
     * Logs a persistence milestone only after the surrounding transaction has
     * actually committed, so the INFO line is a reliable signal that the page's
     * rows and the updated cursor are durable.
     */
    private void registerCursorCommitMilestone(String itemId, String userId, String oldCursor, String newCursor) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                logger.info("Committed Plaid sync page for item_id={} user_id={}: cursor {} -> {}",
                        itemId, userId, oldCursor, newCursor);
            }
        });
    }

    /**
     * Lists the active Plaid items connected to the authenticated user,
     * newest first. The encrypted access token is never exposed.
     */
    public List<PlaidItemResponse> listItems(AuthenticatedUser authenticatedUser) {
        String userId = requireUserId(authenticatedUser);
        return plaidItemRepository.findByUser_IdOrderByCreatedAtDesc(userId).stream()
                .map(item -> new PlaidItemResponse(
                        item.getId(), item.getItemId(), item.getInstitutionName(), item.getCreatedAt(),
                        item.getStatus() == null ? PlaidItemStatus.ACTIVE.name() : item.getStatus().name(),
                        item.isSyncError(), item.getLastSyncedAt(), item.getReauthRequestedAt()))
                .toList();
    }

    /**
     * Creates an <em>update-mode</em> Plaid Link token so the user can repair a
     * connection that needs re-authentication.
     *
     * <p>
     * Update mode re-uses the item's durable {@code access_token} and the
     * request body deliberately omits a {@code products} array. The access
     * token does NOT change, so the client must NOT call
     * {@code /item/public_token/exchange} after update mode completes.
     * </p>
     */
    public String createUpdateLinkToken(AuthenticatedUser authenticatedUser, String itemId) {
        String userId = requireUserId(authenticatedUser);
        PlaidItem item = findOwnedItem(authenticatedUser, itemId);

        String accessToken;
        try {
            accessToken = encryptionService.decrypt(item.getAccessTokenEncrypted());
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not decrypt Plaid access token.",
                    ex);
        }

        Map<String, Object> body = baseBody();
        body.put("access_token", accessToken);
        body.put("client_name", "Budgee");
        body.put("country_codes", settings.countryCodes());
        body.put("language", settings.language());
        body.put("user", Map.of("client_user_id", userId));
        if (StringUtils.hasText(settings.webhookUrl())) {
            body.put("webhook", settings.webhookUrl());
        } else {
            logger.warn(
                    "PLAID_WEBHOOK_URL is not configured; update-mode link tokens are created WITHOUT a webhook URL "
                            + "and Plaid will not send LOGIN_REPAIRED webhooks for the repaired item.");
        }

        JsonNode response = post("/link/token/create", body);
        JsonNode linkToken = response.get("link_token");
        if (linkToken == null || !StringUtils.hasText(linkToken.asString())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Plaid did not return a link token.");
        }
        return linkToken.asString();
    }

    /**
     * Marks an owned item back to {@code ACTIVE} after the user completes
     * update mode. The access token is unchanged; no exchange is performed.
     */
    @Transactional
    public PlaidItem completeReauth(AuthenticatedUser authenticatedUser, String itemId) {
        PlaidItem item = findOwnedItem(authenticatedUser, itemId);
        item.setStatus(PlaidItemStatus.ACTIVE);
        item.setReauthRequestedAt(null);
        return plaidItemRepository.save(item);
    }

    /**
     * Resolves a Plaid item owned by the authenticated user by its internal
     * {@code PlaidItem.id}, or throws 404 when missing / not owned.
     */
    public PlaidItem findOwnedItem(AuthenticatedUser authenticatedUser, String itemId) {
        String userId = requireUserId(authenticatedUser);
        return plaidItemRepository.findByIdAndUser_Id(itemId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plaid item not found"));
    }

    /**
     * Disconnects a Plaid item owned by the authenticated user: revokes the
     * token at Plaid via {@code /item/remove}, then deletes the persisted item.
     *
     * 
     * Revocation is best-effort — if Plaid is unreachable (or the item has
     * already been dropped by Plaid, e.g. a sandbox item), the local record is
     * still removed so the user is no longer presented with a stale
     * connection. Webhooks for the item are then ignored by the sync service
     * because the item lookup no longer resolves.
     * 
     *
     * @return the deleted {@code PlaidItem} id
     * @throws ResponseStatusException 404 when the item is missing or belongs
     *                                 to a different user
     */
    @Transactional
    public String disconnectItem(AuthenticatedUser authenticatedUser, String itemId) {
        String userId = requireUserId(authenticatedUser);
        PlaidItem item = plaidItemRepository.findByIdAndUser_Id(itemId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plaid item not found"));

        try {
            String accessToken = encryptionService.decrypt(item.getAccessTokenEncrypted());
            Map<String, Object> body = baseBody();
            body.put("access_token", accessToken);
            post("/item/remove", body);
            logger.info("Plaid /item/remove succeeded for item_id={}", item.getItemId());
        } catch (Exception ex) {
            logger.warn("Plaid /item/remove failed for item_id={}; deleting locally anyway: {}",
                    item.getItemId(), ex.getMessage());
        }

        plaidItemRepository.delete(item);
        logger.info("Disconnected Plaid item_id={} for user_id={}", item.getItemId(), userId);
        return item.getId();
    }

    private String requireUserId(AuthenticatedUser authenticatedUser) {
        if (authenticatedUser == null || !StringUtils.hasText(authenticatedUser.userId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        return authenticatedUser.userId();
    }

    private Map<String, Object> baseBody() {
        Map<String, Object> body = new HashMap<>();
        body.put("client_id", settings.clientId());
        body.put("secret", settings.secret());
        return body;
    }

    private JsonNode post(String path, Map<String, Object> body) {
        try {
            JsonNode response = plaidRestClient.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from Plaid.");
            }
            if (response.has("error_type")) {
                throw plaidError(HttpStatus.BAD_GATEWAY, response);
            }
            return response;
        } catch (RestClientResponseException ex) {
            // Plaid returned a non-2xx status (e.g. INVALID_API_KEYS, INVALID_INPUT,
            // ITEM_LOGIN_REQUIRED). The Plaid error payload is carried on the
            // exception; log the full body and surface the actual error code and
            // message instead of a generic "unavailable" 502 that hides the cause.
            String errorBody = ex.getResponseBodyAsString();
            logger.error("Plaid request '{}' failed with HTTP {}: {}",
                    path, ex.getStatusCode().value(),
                    StringUtils.hasText(errorBody) ? errorBody : ex.getMessage());
            throw plaidError(HttpStatus.BAD_GATEWAY, errorBody);
        } catch (RestClientException ex) {
            // Network-level failure (connect timeout, DNS, connection refused) —
            // not a Plaid error response.
            logger.error("Plaid request '{}' failed: {}", path, ex.getMessage(), ex);
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY, "Plaid is temporarily unavailable, please try again.");
        }
    }

    /** 502 that surfaces the error payload from a parsed Plaid error body. */
    private static ResponseStatusException plaidError(HttpStatus status, JsonNode body) {
        String code = body.path("error_code").asString("unknown");
        String message = body.path("error_message").asString("Plaid reported an error.");
        return new ResponseStatusException(status, "Plaid error " + code + ": " + message);
    }

    /** 502 that surfaces Plaid's raw error body (parsed when possible). */
    private static ResponseStatusException plaidError(HttpStatus status, String errorBody) {
        if (StringUtils.hasText(errorBody)) {
            try {
                return plaidError(status, ERROR_BODY_MAPPER.readTree(errorBody));
            } catch (JacksonException ignored) {
                // Body was not JSON (e.g. an intermediary HTML error page) — show it raw.
                return new ResponseStatusException(status, "Plaid request failed: " + errorBody);
            }
        }
        return new ResponseStatusException(status, "Plaid request failed.");
    }

    private static List<JsonNode> nodes(JsonNode root, String field) {
        List<JsonNode> out = new ArrayList<>();
        JsonNode arr = root.get(field);
        if (arr != null && arr.isArray()) {
            arr.forEach(out::add);
        }
        return out;
    }

    private PlaidTransaction toPlaidTransaction(JsonNode node, String plaidItemId) {
        String name = node.path("merchant_name").asText(null);
        if (!StringUtils.hasText(name)) {
            name = node.path("name").asText(null);
        }

        String category = readCategory(node);
        double amount = node.path("amount").asDouble(0.0);
        Instant date = parseDate(node);
        boolean transfer = PlaidTransferDetector.isTransfer(node);
        // Plaid's structured account_id identifies which of the user's accounts
        // this transaction belongs to; the item id identifies the connected
        // financial institution. Both are persisted for ownership-based
        // transfer classification.
        String plaidAccountId = node.path("account_id").asText(null);
        String pfcDetailed = readPfcDetailed(node);

        return new PlaidTransaction(
                node.path("transaction_id").asText(null),
                name,
                date,
                category,
                amount,
                transfer,
                node.path("iso_currency_code").asText(null),
                node.path("unofficial_currency_code").asText(null),
                plaidAccountId,
                plaidItemId,
                pfcDetailed);
    }

    /** @return personal_finance_category.detailed if present, otherwise null. */
    private static String readPfcDetailed(JsonNode node) {
        JsonNode personalFinance = node.get("personal_finance_category");
        if (personalFinance != null) {
            String value = personalFinance.path("detailed").asText(null);
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private static String readCategory(JsonNode node) {
        JsonNode personalFinance = node.get("personal_finance_category");
        if (personalFinance != null) {
            // Prefer the fine-grained code, fall back to the hierarchical one.
            for (String key : List.of("primary", "detailed", "subcategory")) {
                String value = personalFinance.path(key).asText(null);
                if (StringUtils.hasText(value)) {
                    return value;
                }
            }
        }
        JsonNode legacy = node.get("category");
        if (legacy != null && legacy.isArray() && legacy.size() > 0) {
            return legacy.get(0).asText("Other");
        }
        return "Other";
    }

    private static Instant parseDate(JsonNode node) {
        // Prefer the transaction timestamp when Plaid provides one
        // (authorized_datetime is the current field; datetime is its deprecated
        // alias). Preserving the time-of-day lets reconnect matching tell apart
        // multiple same-day transactions instead of relying on day-level data.
        for (String field : List.of("authorized_datetime", "datetime")) {
            String raw = node.path(field).asText(null);
            if (StringUtils.hasText(raw)) {
                try {
                    return Instant.from(ISO_OFFSET.parse(raw));
                } catch (Exception ignored) {
                    // fall through to the next field
                }
            }
        }
        String rawDate = node.path("date").asText(null);
        if (StringUtils.hasText(rawDate)) {
            try {
                return LocalDate.parse(rawDate, PLAID_DATE)
                        .atStartOfDay()
                        .toInstant(ZoneOffset.UTC);
            } catch (Exception ignored) {
                // fall through
            }
        }
        return Instant.EPOCH;
    }
}