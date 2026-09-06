package com.fintechapp.fintech_api.service;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidService.SyncPageResult;

/**
 * Asynchronous driver for Plaid "transactions sync". Webhook handlers and the
 * immediate post-link sync both hand off to {@link #syncItemAsync(String)} so
 * the HTTP request/response cycle is never blocked by the sync work.
 *
 * <p>
 * Sync runs for the <em>same</em> {@code item_id} are serialized across
 * application instances using a two-tier locking strategy:
 * <ol>
 * <li>An in-process {@link ReentrantLock} per {@code item_id} that coordinates
 * threads running within the same JVM without hitting the database.</li>
 * <li>A distributed, atomic database lease on {@code plaid_items} with bounded
 * expiration semantics managed by {@link PlaidSyncLockService} to coordinate
 * across multiple JVM instances and prevent concurrent or duplicate sync
 * loops.</li>
 * </ol>
 * </p>
 */
@Service
public class PlaidTransactionSyncService {

    private static final Logger logger = LoggerFactory.getLogger(PlaidTransactionSyncService.class);
    private static final int MAX_PAGES_PER_RUN = 50;

    /**
     * Per-item in-process mutex, keyed by Plaid {@code item_id}.
     */
    private static final ConcurrentMap<String, ReentrantLock> ITEM_LOCKS = new ConcurrentHashMap<>();

    /**
     * How long a run waits for another sync of the same item before giving up.
     * A timed-out run is skipped; Plaid re-fires {@code SYNC_UPDATES_AVAILABLE}
     * on the next change, so no update is permanently lost.
     */
    @Value("${app.plaid.sync.item-lock-timeout-ms:30000}")
    private long itemLockTimeoutMs = 30_000L;

    /**
     * Lease duration for the distributed item lock. Must be sufficiently long
     * to allow page processing while remaining bounded to prevent deadlocks on
     * crash.
     */
    @Value("${app.plaid.sync.item-lock-lease-duration-ms:60000}")
    private long itemLockLeaseDurationMs = 60_000L;

    private final PlaidItemRepository plaidItemRepository;
    private final PlaidService plaidService;
    private final PlaidSyncLockService syncLockService;

    public PlaidTransactionSyncService(
            PlaidItemRepository plaidItemRepository,
            PlaidService plaidService) {
        this(plaidItemRepository, plaidService, new PlaidSyncLockService(plaidItemRepository));
    }

    @Autowired
    public PlaidTransactionSyncService(
            PlaidItemRepository plaidItemRepository,
            PlaidService plaidService,
            PlaidSyncLockService syncLockService) {
        this.plaidItemRepository = plaidItemRepository;
        this.plaidService = plaidService;
        this.syncLockService = syncLockService;
    }

    /**
     * Runs the /transactions/sync cursor loop for the given Plaid item on a
     * background thread. Safe to call fire-and-forget.
     */
    @Async("plaidTaskExecutor")
    public void syncItemAsync(String itemId) {
        PlaidItem item = plaidItemRepository.findByItemId(itemId).orElse(null);
        if (item == null) {
            logger.warn("Plaid sync skipped: no item registered for item_id={}", itemId);
            return;
        }
        String userId = item.getUser().getId();
        String lockToken = UUID.randomUUID().toString();
        Duration timeout = Duration.ofMillis(itemLockTimeoutMs);
        Duration leaseDuration = Duration.ofMillis(Math.max(itemLockLeaseDurationMs, 30_000L));

        // Step A — secure the two-tier lock (local mutex + distributed lease).
        if (!acquireItemLock(itemId, lockToken, timeout, leaseDuration)) {
            return;
        }
        try {
            boolean hasMore = true;
            int page = 0;
            while (hasMore && page < MAX_PAGES_PER_RUN) {
                // Steps B–E live in fetchAndApplySyncPage: it fetches Plaid HTTP
                // outside the database transaction, then persists the page and
                // cursor in a short dedicated transaction.
                SyncPageResult result = plaidService.fetchAndApplySyncPage(itemId);
                hasMore = result.hasMore();
                page++;

                // Extend distributed lease if there are more pages to process.
                if (hasMore && syncLockService != null) {
                    syncLockService.extend(itemId, lockToken, leaseDuration);
                }
            }
            logger.debug("Plaid sync finished for item_id={} pages={} hasMore={}", itemId, page, hasMore);
            // The full run completed without an exception — surface health for
            // the clients (per-page commits already stamped lastSyncedAt).
            clearSyncError(itemId);
        } catch (Exception ex) {
            logger.error("Plaid transaction sync failed for item_id={} user_id={}",
                    itemId, userId, ex);
            // Persisted item health — NOT an in-memory flag. The clients show a
            // non-dismissible warning and offer a manual retry.
            markSyncError(itemId);
        } finally {
            // Step F — release the distributed lease and local lock.
            releaseItemLock(itemId, lockToken);
        }
    }

    /**
     * Persists {@code syncError = true} on the item so every connected client
     * can display the "trouble syncing" warning. Never throws: the flag is
     * best-effort operator feedback on an already-failed sync.
     */
    private void markSyncError(String itemId) {
        try {
            plaidItemRepository.findByItemId(itemId).ifPresent(item -> {
                item.setSyncError(true);
                plaidItemRepository.save(item);
                logger.warn("Marked item_id={} with syncError after a failed sync", itemId);
            });
        } catch (Exception persistEx) {
            logger.error("Failed to persist syncError flag for item_id={}", itemId, persistEx);
        }
    }

    /**
     * Clears {@code syncError} after a completed sync run. Best-effort and
     * guarded exactly like {@link #markSyncError(String)}.
     */
    private void clearSyncError(String itemId) {
        try {
            plaidItemRepository.findByItemId(itemId).ifPresent(item -> {
                if (item.isSyncError()) {
                    item.setSyncError(false);
                    plaidItemRepository.save(item);
                    logger.info("Cleared syncError for item_id={} after a successful sync", itemId);
                }
            });
        } catch (Exception persistEx) {
            logger.error("Failed to clear syncError flag for item_id={}", itemId, persistEx);
        }
    }

    /**
     * Acquires both the JVM-local lock and the distributed lease for the item.
     *
     * @return {@code true} when this thread owns the lock, {@code false}
     *         when the lock could not be obtained (timeout/interrupt) and the
     *         run must be skipped.
     */
    private boolean acquireItemLock(String itemId, String lockToken, Duration timeout, Duration leaseDuration) {
        ReentrantLock localLock = ITEM_LOCKS.computeIfAbsent(itemId, k -> new ReentrantLock());
        long start = System.currentTimeMillis();
        boolean localAcquired;
        try {
            localAcquired = localLock.tryLock(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            logger.warn("Interrupted while waiting for local Plaid item lock for item_id={}", itemId);
            return false;
        }

        if (!localAcquired) {
            logger.warn("Timed out waiting {}ms for local Plaid item lock for item_id={}; skipping this sync run",
                    timeout.toMillis(), itemId);
            return false;
        }

        long elapsed = System.currentTimeMillis() - start;
        long remaining = Math.max(0, timeout.toMillis() - elapsed);

        boolean distAcquired = syncLockService.acquireWithTimeout(itemId, lockToken, Duration.ofMillis(remaining),
                leaseDuration);
        if (!distAcquired) {
            localLock.unlock();
            return false;
        }
        return true;
    }

    private void releaseItemLock(String itemId, String lockToken) {
        try {
            if (syncLockService != null && lockToken != null) {
                syncLockService.release(itemId, lockToken);
            }
        } catch (Exception ex) {
            logger.warn("Failed to release distributed sync lease for item_id={}: {}", itemId, ex.getMessage());
        } finally {
            ReentrantLock localLock = ITEM_LOCKS.get(itemId);
            if (localLock != null && localLock.isHeldByCurrentThread()) {
                localLock.unlock();
            }
        }
    }
}
