package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fintechapp.fintech_api.repository.PlaidItemRepository;

@ExtendWith(MockitoExtension.class)
class PlaidSyncLockServiceTest {

    @Mock
    private PlaidItemRepository plaidItemRepository;

    private PlaidSyncLockService lockService;

    @BeforeEach
    void setUp() {
        lockService = new PlaidSyncLockService(plaidItemRepository);
    }

    @Test
    void tryAcquire_blankItemId_returnsFalse() {
        assertFalse(lockService.tryAcquire("", "token-1", Duration.ofSeconds(60)));
        assertFalse(lockService.tryAcquire(null, "token-1", Duration.ofSeconds(60)));
        verify(plaidItemRepository, never()).acquireSyncLock(any(), any(), any(), any());
    }

    @Test
    void tryAcquire_blankToken_returnsFalse() {
        assertFalse(lockService.tryAcquire("item-1", "", Duration.ofSeconds(60)));
        assertFalse(lockService.tryAcquire("item-1", null, Duration.ofSeconds(60)));
        verify(plaidItemRepository, never()).acquireSyncLock(any(), any(), any(), any());
    }

    @Test
    void tryAcquire_nullDuration_returnsFalse() {
        assertFalse(lockService.tryAcquire("item-1", "token-1", null));
        verify(plaidItemRepository, never()).acquireSyncLock(any(), any(), any(), any());
    }

    @Test
    void tryAcquire_repositoryReturnsOne_returnsTrue() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(1);

        boolean acquired = lockService.tryAcquire("item-1", "token-1", Duration.ofSeconds(60));

        assertTrue(acquired);
        verify(plaidItemRepository).acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class),
                any(Instant.class));
    }

    @Test
    void tryAcquire_repositoryReturnsZero_returnsFalse() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(0);

        boolean acquired = lockService.tryAcquire("item-1", "token-1", Duration.ofSeconds(60));

        assertFalse(acquired);
    }

    @Test
    void acquireWithTimeout_immediateSuccess_returnsTrueWithoutSleeping() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(1);

        boolean acquired = lockService.acquireWithTimeout("item-1", "token-1", Duration.ofSeconds(5),
                Duration.ofSeconds(60));

        assertTrue(acquired);
        verify(plaidItemRepository, times(1)).acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class),
                any(Instant.class));
    }

    @Test
    void acquireWithTimeout_eventualSuccess_returnsTrue() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(0)
                .thenReturn(1);

        boolean acquired = lockService.acquireWithTimeout("item-1", "token-1", Duration.ofMillis(800),
                Duration.ofSeconds(60));

        assertTrue(acquired);
        verify(plaidItemRepository, times(2)).acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class),
                any(Instant.class));
    }

    @Test
    void acquireWithTimeout_timeoutExpires_returnsFalse() {
        when(plaidItemRepository.acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class)))
                .thenReturn(0);

        boolean acquired = lockService.acquireWithTimeout("item-1", "token-1", Duration.ofMillis(300),
                Duration.ofSeconds(60));

        assertFalse(acquired);
        verify(plaidItemRepository, org.mockito.Mockito.atLeast(2))
                .acquireSyncLock(eq("item-1"), eq("token-1"), any(Instant.class), any(Instant.class));
    }

    @Test
    void release_blankParams_returnsFalse() {
        assertFalse(lockService.release(null, "token-1"));
        assertFalse(lockService.release("item-1", ""));
        verify(plaidItemRepository, never()).releaseSyncLock(any(), any());
    }

    @Test
    void release_repositoryUpdatesRow_returnsTrue() {
        when(plaidItemRepository.releaseSyncLock("item-1", "token-1")).thenReturn(1);

        assertTrue(lockService.release("item-1", "token-1"));
        verify(plaidItemRepository).releaseSyncLock("item-1", "token-1");
    }

    @Test
    void release_repositoryUpdatesZero_returnsFalse() {
        when(plaidItemRepository.releaseSyncLock("item-1", "token-1")).thenReturn(0);

        assertFalse(lockService.release("item-1", "token-1"));
    }

    @Test
    void extend_blankParams_returnsFalse() {
        assertFalse(lockService.extend(null, "token-1", Duration.ofSeconds(60)));
        assertFalse(lockService.extend("item-1", null, Duration.ofSeconds(60)));
        assertFalse(lockService.extend("item-1", "token-1", null));
        verify(plaidItemRepository, never()).extendSyncLock(any(), any(), any());
    }

    @Test
    void extend_repositoryUpdatesRow_returnsTrue() {
        when(plaidItemRepository.extendSyncLock(eq("item-1"), eq("token-1"), any(Instant.class))).thenReturn(1);

        assertTrue(lockService.extend("item-1", "token-1", Duration.ofSeconds(60)));
        verify(plaidItemRepository).extendSyncLock(eq("item-1"), eq("token-1"), any(Instant.class));
    }
}
