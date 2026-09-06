package com.fintechapp.fintech_api.service;

import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.fintechapp.fintech_api.repository.PlaidItemRepository;

/**
 * Manages distributed synchronization leases for Plaid items across application
 * instances.
 *
 * <p>
 * Uses atomic, conditional updates against the {@code plaid_items} table in
 * PostgreSQL.
 * Each lease is bounded by an expiration timestamp so that if an instance
 * crashes or is killed
 * mid-sync, the lease automatically expires without permanent deadlocks. All
 * lock operations
 * (acquire, release, extend) execute inside short, independent transactions
 * (~1ms), ensuring
 * database connections are never held while waiting on locks or external HTTP
 * calls.
 * </p>
 */
@Service
public class PlaidSyncLockService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidSyncLockService.class);
    private static final long POLL_INTERVAL_MS = 200L;

    private final PlaidItemRepository plaidItemRepository;

    public PlaidSyncLockService(PlaidItemRepository plaidItemRepository) {
        this.plaidItemRepository = plaidItemRepository;
    }

    /**
     * Attempts a single atomic acquisition of the distributed sync lease for
     * {@code itemId}.
     *
     * @param itemId        the Plaid item id to lock
     * @param token         unique token identifying the caller/instance
     * @param leaseDuration how long the lease remains valid before auto-expiring
     * @return {@code true} if acquired or renewed; {@code false} if held by another
     *         active token
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean tryAcquire(String itemId, String token, Duration leaseDuration) {
        if (!StringUtils.hasText(itemId) || !StringUtils.hasText(token) || leaseDuration == null) {
            return false;
        }
        Instant now = Instant.now();
        Instant expiresAt = now.plus(leaseDuration);
        int updated = plaidItemRepository.acquireSyncLock(itemId, token, expiresAt, now);
        return updated > 0;
    }

    /**
     * Polls with backoff until the distributed lease is acquired or the timeout
     * expires.
     *
     * <p>
     * Sleep pauses occur outside any database transaction, so zero database
     * connections
     * are checked out while waiting.
     * </p>
     *
     * @param itemId        the Plaid item id to lock
     * @param token         unique token identifying the caller/instance
     * @param timeout       maximum duration to wait for the lease
     * @param leaseDuration duration of the lease once acquired
     * @return {@code true} if acquired; {@code false} if timed out or interrupted
     */
    public boolean acquireWithTimeout(String itemId, String token, Duration timeout, Duration leaseDuration) {
        if (tryAcquire(itemId, token, leaseDuration)) {
            logger.info("Acquired distributed sync lease for item_id={} token={}", itemId, token);
            return true;
        }

        long timeoutMs = timeout != null ? timeout.toMillis() : 0L;
        long deadline = System.currentTimeMillis() + timeoutMs;

        logger.warn("Distributed sync lease for item_id={} is held by another instance; waiting up to {}ms",
                itemId, timeoutMs);

        while (System.currentTimeMillis() < deadline) {
            long remaining = deadline - System.currentTimeMillis();
            long sleepTime = Math.min(remaining, POLL_INTERVAL_MS);
            if (sleepTime > 0) {
                try {
                    Thread.sleep(sleepTime);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    logger.warn("Interrupted while waiting for distributed sync lease for item_id={}", itemId);
                    return false;
                }
            }

            if (tryAcquire(itemId, token, leaseDuration)) {
                logger.warn("Acquired distributed sync lease for item_id={} token={} after waiting", itemId, token);
                return true;
            }
        }

        logger.warn("Timed out waiting {}ms for distributed sync lease for item_id={}; skipping run",
                timeoutMs, itemId);
        return false;
    }

    /**
     * Releases the distributed sync lease if the stored token matches.
     *
     * @param itemId the Plaid item id
     * @param token  the token that acquired the lease
     * @return {@code true} if released; {@code false} if not owned or already
     *         cleared
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean release(String itemId, String token) {
        if (!StringUtils.hasText(itemId) || !StringUtils.hasText(token)) {
            return false;
        }
        int updated = plaidItemRepository.releaseSyncLock(itemId, token);
        if (updated > 0) {
            logger.info("Released distributed sync lease for item_id={} token={}", itemId, token);
            return true;
        }
        logger.debug("Did not release distributed sync lease for item_id={} token={} (already released or expired)",
                itemId, token);
        return false;
    }

    /**
     * Extends the expiration of an active distributed sync lease if owned by
     * {@code token}.
     *
     * @param itemId        the Plaid item id
     * @param token         the token that acquired the lease
     * @param leaseDuration additional lease duration from now
     * @return {@code true} if extended; {@code false} if not owned
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean extend(String itemId, String token, Duration leaseDuration) {
        if (!StringUtils.hasText(itemId) || !StringUtils.hasText(token) || leaseDuration == null) {
            return false;
        }
        Instant expiresAt = Instant.now().plus(leaseDuration);
        int updated = plaidItemRepository.extendSyncLock(itemId, token, expiresAt);
        return updated > 0;
    }
}
