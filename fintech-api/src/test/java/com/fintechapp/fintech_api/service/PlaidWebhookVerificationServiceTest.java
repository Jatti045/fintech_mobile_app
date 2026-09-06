package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Date;
import java.util.HexFormat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Unit tests for the Plaid webhook signature verification. A real P-256 key
 * pair is used so the JWT is genuinely signed and verified with Nimbus; the
 * key fetch from Plaid is substituted with the generated public key.
 */
class PlaidWebhookVerificationServiceTest {

    private static final String KID = "test-kid-1";

    private ECPrivateKey privateKey;
    private PlaidWebhookVerificationService service;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(256);
        KeyPair keyPair = generator.generateKeyPair();
        privateKey = (ECPrivateKey) keyPair.getPrivate();
        ECPublicKey publicKey = (ECPublicKey) keyPair.getPublic();
        ECKey publicJwk = new ECKey.Builder(Curve.P_256, publicKey).keyID(KID).build();

        JsonNode keyNode = JsonMapper.builder().build().readTree(publicJwk.toJSONString());
        service = new TestPlaidWebhookVerificationService(keyNode);
    }

    private static String sha256Hex(String body) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return HexFormat.of().formatHex(digest.digest(body.getBytes(StandardCharsets.UTF_8)));
    }

    private SignedJWT sign(JWTClaimsSet claims) throws Exception {
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(KID).build(),
                claims);
        jwt.sign(new ECDSASigner(privateKey));
        return jwt;
    }

    private JWTClaimsSet claimsFor(String body) throws Exception {
        return new JWTClaimsSet.Builder()
                .issueTime(new Date())
                .claim("request_body_sha256", sha256Hex(body))
                .build();
    }

    @Test
    void verify_validSignatureAndBody_returnsTrue() throws Exception {
        String body = "{\"webhook_type\":\"TRANSACTIONS\",\"webhook_code\":\"SYNC_UPDATES_AVAILABLE\"}";
        assertTrue(service.verify(sign(claimsFor(body)).serialize(), body));
    }

    @Test
    void verify_nullJwt_returnsFalse() {
        assertFalse(service.verify(null, "{}"));
    }

    @Test
    void verify_blankJwt_returnsFalse() {
        assertFalse(service.verify("   ", "{}"));
    }

    @Test
    void verify_nullBody_returnsFalse() throws Exception {
        String body = "{}";
        assertFalse(service.verify(sign(claimsFor(body)).serialize(), null));
    }

    @Test
    void verify_tamperedBody_returnsFalse() throws Exception {
        String body = "{\"webhook_type\":\"TRANSACTIONS\",\"webhook_code\":\"SYNC_UPDATES_AVAILABLE\"}";
        assertFalse(service.verify(sign(claimsFor(body)).serialize(), "{\"webhook_type\":\"TRANSACTIONS\"}"));
    }

    @Test
    void verify_garbageJwt_returnsFalse() {
        assertFalse(service.verify("not-a-jwt", "{}"));
    }

    @Test
    void verify_staleJwt_returnsFalse() throws Exception {
        String body = "{}";
        JWTClaimsSet stale = new JWTClaimsSet.Builder()
                .issueTime(new Date(System.currentTimeMillis() - 10 * 60 * 1000L))
                .claim("request_body_sha256", sha256Hex(body))
                .build();
        assertFalse(service.verify(sign(stale).serialize(), body));
    }

    @Test
    void verify_futureJwt_returnsFalse() throws Exception {
        String body = "{}";
        JWTClaimsSet future = new JWTClaimsSet.Builder()
                .issueTime(new Date(System.currentTimeMillis() + 10 * 60 * 1000L))
                .claim("request_body_sha256", sha256Hex(body))
                .build();
        assertFalse(service.verify(sign(future).serialize(), body));
    }

    @Test
    void verify_missingIat_returnsFalse() throws Exception {
        String body = "{}";
        JWTClaimsSet noIat = new JWTClaimsSet.Builder()
                .claim("request_body_sha256", sha256Hex(body))
                .build();
        assertFalse(service.verify(sign(noIat).serialize(), body));
    }

    @Test
    void verify_missingKid_returnsFalse() throws Exception {
        String body = "{}";
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.ES256).build(),
                claimsFor(body));
        jwt.sign(new ECDSASigner(privateKey));
        assertFalse(service.verify(jwt.serialize(), body));
    }

    @Test
    void verify_blankKid_returnsFalse() throws Exception {
        String body = "{}";
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.ES256).keyID("   ").build(),
                claimsFor(body));
        jwt.sign(new ECDSASigner(privateKey));
        assertFalse(service.verify(jwt.serialize(), body));
    }

    @Test
    void verify_unknownKid_returnsFalse() throws Exception {
        String body = "{}";
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.ES256).keyID("unknown-kid").build(),
                claimsFor(body));
        jwt.sign(new ECDSASigner(privateKey));
        assertFalse(service.verify(jwt.serialize(), body));
    }

    @Test
    void verify_missingRequestBodyHashClaim_returnsFalse() throws Exception {
        String body = "{}";
        JWTClaimsSet noHash = new JWTClaimsSet.Builder()
                .issueTime(new Date())
                .build();
        assertFalse(service.verify(sign(noHash).serialize(), body));
    }

    @Test
    void verify_invalidHexRequestBodyHash_returnsFalse() throws Exception {
        String body = "{}";
        JWTClaimsSet invalidHex = new JWTClaimsSet.Builder()
                .issueTime(new Date())
                .claim("request_body_sha256", "not-hex-chars-!!")
                .build();
        assertFalse(service.verify(sign(invalidHex).serialize(), body));
    }

    @Test
    void verify_truncatedHexRequestBodyHash_returnsFalse() throws Exception {
        String body = "{}";
        JWTClaimsSet shortHex = new JWTClaimsSet.Builder()
                .issueTime(new Date())
                .claim("request_body_sha256", "abcd1234ef")
                .build();
        assertFalse(service.verify(sign(shortHex).serialize(), body));
    }

    /**
     * Service subclass that serves a fixed verification key instead of calling
     * Plaid.
     */
    private static final class TestPlaidWebhookVerificationService extends PlaidWebhookVerificationService {
        private final JsonNode keyNode;

        TestPlaidWebhookVerificationService(JsonNode keyNode) {
            super(null, null);
            this.keyNode = keyNode;
        }

        @Override
        protected JsonNode requestVerificationKey(String keyId) {
            return KID.equals(keyId) ? keyNode : null;
        }
    }
}
