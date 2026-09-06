package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidService.SyncPageResult;

@ExtendWith(MockitoExtension.class)
class PlaidTransactionSyncServiceTest {

    @Mock
    private PlaidItemRepository plaidItemRepository;

    @Mock
    private PlaidService plaidService;

    @Mock
    private PlaidSyncLockService syncLockService;

    private PlaidTransactionSyncService service;

    private PlaidItem item;

    @BeforeEach
    void setUp() {
        service = new PlaidTransactionSyncService(plaidItemRepository, plaidService, syncLockService);
        User user = new User();
        user.setId("user-1");
        item = new PlaidItem();
        item.setItemId("item-1");
        item.setUser(user);
    }

    private void stubItem() {
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
        when(syncLockService.acquireWithTimeout(any(), any(), any(), any())).thenReturn(true);
    }

    // ── Missing item ─────────────────────────────────────────────────────────

    @Test
    void syncItemAsync_itemNotFound_skipsSync() {
        when(plaidItemRepository.findByItemId("missing")).thenReturn(Optional.empty());
        service.syncItemAsync("missing");
        verify(plaidService, never()).fetchAndApplySyncPage(any());
    }

    // ── Single page ──────────────────────────────────────────────────────────

    @Test
    void syncItemAsync_singlePage_noMore_returnsAfterOneFetch() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-1", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(1)).fetchAndApplySyncPage("item-1");
    }

    // ── Multi-page cursor loop (Steps B–F) ───────────────────────────────────

    @Test
    void syncItemAsync_multiPage_loopsUntilHasMoreFalse() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-1", true))
                .thenReturn(new SyncPageResult("cursor-2", true))
                .thenReturn(new SyncPageResult("cursor-3", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(3)).fetchAndApplySyncPage("item-1");
    }

    // ── Zero-update pages still advance until has_more=false ─────────────────

    @Test
    void syncItemAsync_zeroUpdates_stillLoopsUntilNoMore() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("c1", true))
                .thenReturn(new SyncPageResult("c2", false));

        service.syncItemAsync("item-1");

        verify(plaidService, times(2)).fetchAndApplySyncPage("item-1");
    }

    // ── Max page cap ─────────────────────────────────────────────────────────

    @Test
    void syncItemAsync_hasMoreAlwaysTrue_stopsAtPageCap() {
        stubItem();
        // Always return hasMore=true; the guard must cap the loop.
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-x", true));

        service.syncItemAsync("item-1");

        // 50 is the hard cap (MAX_PAGES_PER_RUN) — must not loop forever.
        verify(plaidService, times(50)).fetchAndApplySyncPage("item-1");
    }

    // ── Per-item lock: a second run must wait for the first ──────────────────

    @Test
    void syncItemAsync_concurrentRunsForSameItem_serializeOnLock() throws Exception {
        stubItem();
        CountDownLatch firstEntered = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        AtomicInteger fetchCount = new AtomicInteger();
        AtomicReference<String> secondRunCursor = new AtomicReference<>();

        when(plaidService.fetchAndApplySyncPage("item-1")).thenAnswer(inv -> {
            if (fetchCount.incrementAndGet() == 1) {
                firstEntered.countDown();
                releaseFirst.await(5, TimeUnit.SECONDS);
                return new SyncPageResult("cursor-1", false);
            }
            secondRunCursor.set("cursor-1");
            return new SyncPageResult("cursor-1", false);
        });

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            pool.submit(() -> service.syncItemAsync("item-1"));
            assertTrue(firstEntered.await(5, TimeUnit.SECONDS), "first sync did not start");

            // Second run for the same item must block behind the first run's lock.
            Future<?> second = pool.submit(() -> service.syncItemAsync("item-1"));
            Thread.sleep(300);
            assertNull(secondRunCursor.get(), "second sync ran while the first held the item lock");
            assertEquals(1, fetchCount.get(), "no second /transactions/sync call may start in parallel");

            releaseFirst.countDown();
            second.get(5, TimeUnit.SECONDS);
            assertNotNull(secondRunCursor.get(), "second sync must run after the first releases the lock");
            assertEquals(2, fetchCount.get());
        } finally {
            releaseFirst.countDown();
            pool.shutdownNow();
        }
    }

    // ── Per-item lock: a waiting run times out and skips instead of piling up ─

    @Test
    void syncItemAsync_lockWaitTimesOut_skipsRun() throws Exception {
        stubItem();
        ReflectionTestUtils.setField(service, "itemLockTimeoutMs", 200L);

        CountDownLatch firstEntered = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        AtomicInteger fetchCount = new AtomicInteger();

        when(plaidService.fetchAndApplySyncPage("item-1")).thenAnswer(inv -> {
            fetchCount.incrementAndGet();
            firstEntered.countDown();
            releaseFirst.await(5, TimeUnit.SECONDS);
            return new SyncPageResult("cursor-1", false);
        });

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            pool.submit(() -> service.syncItemAsync("item-1"));
            assertTrue(firstEntered.await(5, TimeUnit.SECONDS), "first sync did not start");

            // The second run gives up after 200ms and returns without syncing.
            Future<?> second = pool.submit(() -> service.syncItemAsync("item-1"));
            second.get(5, TimeUnit.SECONDS);
            assertEquals(1, fetchCount.get(), "timed-out run must not call /transactions/sync");
        } finally {
            releaseFirst.countDown();
            pool.shutdownNow();
        }

        verify(plaidService, times(1)).fetchAndApplySyncPage("item-1");
    }

    // ── Distributed lock timeout ─────────────────────────────────────────────

    @Test
    void syncItemAsync_distributedLockFails_skipsSync() {
        when(plaidItemRepository.findByItemId("item-1")).thenReturn(Optional.of(item));
        when(syncLockService.acquireWithTimeout(any(), any(), any(), any())).thenReturn(false);

        service.syncItemAsync("item-1");

        verify(plaidService, never()).fetchAndApplySyncPage(any());
        verify(syncLockService, never()).release(any(), any());
    }

    // ── Lock cleanup on exception ────────────────────────────────────────────

    @Test
    void syncItemAsync_syncThrowsException_releasesLockAndMarksError() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1")).thenThrow(new RuntimeException("Plaid error"));

        service.syncItemAsync("item-1");

        verify(syncLockService).release(eq("item-1"), any());
        assertTrue(item.isSyncError());
        verify(plaidItemRepository).save(item);
    }

    // ── Multi-page lease extension ───────────────────────────────────────────

    @Test
    void syncItemAsync_multiPage_extendsLockLease() {
        stubItem();
        when(plaidService.fetchAndApplySyncPage("item-1"))
                .thenReturn(new SyncPageResult("cursor-1", true))
                .thenReturn(new SyncPageResult("cursor-2", false));

        service.syncItemAsync("item-1");

        verify(syncLockService, times(1)).extend(eq("item-1"), any(), any());
        verify(syncLockService, times(1)).release(eq("item-1"), any());
    }
}
