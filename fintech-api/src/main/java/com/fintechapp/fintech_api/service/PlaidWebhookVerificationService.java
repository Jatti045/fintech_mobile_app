package com.fintechapp.fintech_api.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fintechapp.fintech_api.config.PlaidConfig.PlaidSettings;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import tools.jackson.databind.JsonNode;

/**
 * Verifies the {@code Plaid-Verification} JWT that Plaid attaches to outgoing
 * webhooks. The JWT is signed with ES256 using a P-256 key published at
 * {@code /webhook_verification_key/get}; verification keys are cached by
 * {@code kid}.
 *
 * <p>
 * Mandatory cryptographic verification is enforced on all incoming webhooks:
 * the endpoint is public, and verification prevents forged webhooks from
 * triggering syncs or deleting local items. The raw request body is hashed
 * exactly as delivered to avoid whitespace-normalization mismatches.
 * </p>
 */
@Service
public class PlaidWebhookVerificationService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidWebhookVerificationService.class);

    private static final String VERIFICATION_KEY_ENDPOINT = "/webhook_verification_key/get";
    private static final long MAX_WEBHOOK_AGE_SECONDS = 5 * 60L;
    private static final long KEY_CACHE_TTL_SECONDS = 24 * 60 * 60L;

    private record CachedKey(JWK jwk, Instant fetchedAt) {
        boolean expired() {
            return Instant.now().isAfter(fetchedAt.plusSeconds(KEY_CACHE_TTL_SECONDS));
        }
    }

    private final RestClient plaidRestClient;
    private final PlaidSettings settings;
    private final Map<String, CachedKey> keyCache = new ConcurrentHashMap<>();

    public PlaidWebhookVerificationService(
            @Qualifier("plaidRestClient") RestClient plaidRestClient,
            PlaidSettings settings) {
        this.plaidRestClient = plaidRestClient;
        this.settings = settings;
    }

    /**
     * Verifies a Plaid webhook signature. Returns {@code false} for any
     * missing, malformed, stale or tampered input.
     */
    public boolean verify(String signedJwt, String rawBody) {
        if (!StringUtils.hasText(signedJwt) || rawBody == null) {
            return false;
        }
        try {
            SignedJWT jwt = SignedJWT.parse(signedJwt.trim());
            JWSHeader header = jwt.getHeader();

            // Plaid signs webhooks with ES256 only; reject anything else.
            if (!JWSAlgorithm.ES256.equals(header.getAlgorithm())) {
                logger.warn("Plaid webhook rejected: unexpected JWT algorithm {}", header.getAlgorithm());
                return false;
            }
            String keyId = header.getKeyID();
            if (!StringUtils.hasText(keyId)) {
                logger.warn("Plaid webhook rejected: JWT header missing kid");
                return false;
            }

            ECKey verificationKey = resolveVerificationKey(keyId.trim());
            if (verificationKey == null) {
                logger.warn("Plaid webhook rejected: no verification key available for kid={}", keyId);
                return false;
            }
            if (!jwt.verify(new ECDSAVerifier(verificationKey))) {
                logger.warn("Plaid webhook rejected: JWT signature verification failed");
                return false;
            }

            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            Date issuedAt = claims.getIssueTime();
            if (issuedAt == null
                    || Math.abs(Instant.now().getEpochSecond()
                            - issuedAt.toInstant().getEpochSecond()) > MAX_WEBHOOK_AGE_SECONDS) {
                logger.warn("Plaid webhook rejected: JWT iat missing or outside the 5 minute window");
                return false;
            }

            String claimedHash = claims.getStringClaim("request_body_sha256");
            if (!StringUtils.hasText(claimedHash)) {
                logger.warn("Plaid webhook rejected: JWT missing request_body_sha256");
                return false;
            }
            byte[] claimedBytes = decodeHex(claimedHash.trim());
            if (claimedBytes.length != 32) {
                logger.warn("Plaid webhook rejected: request_body_sha256 claim is not a valid 32-byte hex string");
                return false;
            }
            byte[] actualBytes = sha256(rawBody);
            if (!MessageDigest.isEqual(claimedBytes, actualBytes)) {
                logger.warn("Plaid webhook rejected: request body hash mismatch");
                return false;
            }
            return true;
        } catch (Exception ex) {
            logger.warn("Plaid webhook verification failed: {}", ex.getMessage());
            return false;
        }
    }

    private ECKey resolveVerificationKey(String keyId) {
        CachedKey cached = keyCache.get(keyId);
        if (cached != null && !cached.expired()) {
            return cached.jwk() instanceof ECKey ecKey ? ecKey : null;
        }

        JsonNode keyNode = requestVerificationKey(keyId);
        if (keyNode == null) {
            return null;
        }
        try {
            JWK jwk = JWK.parse(keyNode.toString());
            if (!(jwk instanceof ECKey ecKey)) {
                logger.warn("Plaid verification key for kid={} is not an EC key", keyId);
                return null;
            }
            keyCache.put(keyId, new CachedKey(ecKey, Instant.now()));
            return ecKey;
        } catch (Exception ex) {
            logger.warn("Could not parse Plaid verification key for kid={}: {}", keyId, ex.getMessage());
            return null;
        }
    }

    /**
     * Fetches the public verification key (JWK) for a key id from Plaid's
     * {@code /webhook_verification_key/get} endpoint. Overridable so tests can
     * substitute a fixed key.
     */
    protected JsonNode requestVerificationKey(String keyId) {
        try {
            JsonNode response = plaidRestClient.post()
                    .uri(VERIFICATION_KEY_ENDPOINT)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "client_id", settings.clientId(),
                            "secret", settings.secret(),
                            "key_id", keyId))
                    .retrieve()
                    .body(JsonNode.class);
            return response == null ? null : response.get("key");
        } catch (RestClientException ex) {
            logger.error("Failed to fetch Plaid webhook verification key for kid={}: {}", keyId, ex.getMessage());
            return null;
        }
    }

    private static byte[] sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return digest.digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 digest is unavailable", ex);
        }
    }

    private static byte[] decodeHex(String hex) {
        int length = hex.length();
        if (length % 2 != 0) {
            return new byte[0];
        }
        byte[] out = new byte[length / 2];
        for (int i = 0; i < out.length; i++) {
            int high = Character.digit(hex.charAt(i * 2), 16);
            int low = Character.digit(hex.charAt(i * 2 + 1), 16);
            if (high < 0 || low < 0) {
                return new byte[0];
            }
            out[i] = (byte) ((high << 4) | low);
        }
        return out;
    }
}
