package com.fintechapp.fintech_api.integration.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.fintechapp.fintech_api.integration.support.BaseIntegrationTest;
import com.fintechapp.fintech_api.model.PlaidItem;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.service.PlaidSyncLockService;

class PlaidSyncDistributedLockIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private PlaidSyncLockService lockService;

    @Autowired
    private PlaidItemRepository plaidItemRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private PlaidItem createTestItem(String itemId, User user) {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        return txTemplate.execute(status -> {
            PlaidItem item = new PlaidItem();
            item.setItemId(itemId);
            item.setAccessTokenEncrypted("enc-" + itemId);
            item.setUser(user);
            return plaidItemRepository.save(item);
        });
    }

    private void cleanup(User user) {
        TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
        txTemplate.executeWithoutResult(status -> {
            plaidItemRepository.deleteByUser_Id(user.getId());
            userRepository.deleteById(user.getId());
        });
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void distributedLock_coordinatesAcrossExecutionContexts() throws Exception {
        User user = createUser("lock-test@example.com", "Password123!", "LockTestUser");
        String itemId = "item-dist-lock-1";
        createTestItem(itemId, user);

        try {
            String token1 = "instance-1-token";
            String token2 = "instance-2-token";

            // Instance 1 acquires the lock
            boolean acq1 = lockService.tryAcquire(itemId, token1, Duration.ofSeconds(30));
            assertTrue(acq1, "Instance 1 must acquire the distributed lease");

            // Instance 2 fails to acquire while Instance 1 holds it
            boolean acq2 = lockService.tryAcquire(itemId, token2, Duration.ofSeconds(30));
            assertFalse(acq2, "Instance 2 must not acquire the distributed lease while held by Instance 1");

            // Instance 2 cannot release Instance 1's lock
            boolean relWrongToken = lockService.release(itemId, token2);
            assertFalse(relWrongToken, "Releasing with wrong token must fail");

            // Instance 1 releases the lock
            boolean rel1 = lockService.release(itemId, token1);
            assertTrue(rel1, "Instance 1 must release its distributed lease");

            // Instance 2 can now acquire the lock
            boolean acq2AfterRelease = lockService.tryAcquire(itemId, token2, Duration.ofSeconds(30));
            assertTrue(acq2AfterRelease, "Instance 2 must acquire the distributed lease after Instance 1 released it");

            lockService.release(itemId, token2);
        } finally {
            cleanup(user);
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void distributedLock_expiresAndAllowsTakeoverAfterCrash() throws Exception {
        User user = createUser("crash-test@example.com", "Password123!", "CrashTestUser");
        String itemId = "item-crash-recovery";
        createTestItem(itemId, user);

        try {
            String crashingInstanceToken = "crashed-instance-token";
            String recoveringInstanceToken = "recovering-instance-token";

            // Instance 1 acquires with very short lease (1 second) and crashes (no
            // release() called)
            boolean acq1 = lockService.tryAcquire(itemId, crashingInstanceToken, Duration.ofSeconds(1));
            assertTrue(acq1);

            // Wait 1.5 seconds for lease to expire
            Thread.sleep(1500);

            // Instance 2 must be able to acquire the expired lease automatically
            boolean acq2 = lockService.tryAcquire(itemId, recoveringInstanceToken, Duration.ofSeconds(30));
            assertTrue(acq2, "Recovering instance must acquire expired lease without operator intervention");

            lockService.release(itemId, recoveringInstanceToken);
        } finally {
            cleanup(user);
        }
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @Test
    void distributedLock_concurrentThreadsCompeteForLease() throws Exception {
        User user = createUser("race-test@example.com", "Password123!", "RaceTestUser");
        String itemId = "item-race-condition";
        createTestItem(itemId, user);

        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch doneSignal = new CountDownLatch(2);
        AtomicBoolean thread1Won = new AtomicBoolean(false);
        AtomicBoolean thread2Won = new AtomicBoolean(false);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            pool.submit(() -> {
                try {
                    startSignal.await(5, TimeUnit.SECONDS);
                    thread1Won.set(lockService.tryAcquire(itemId, "thread-1", Duration.ofSeconds(10)));
                } catch (Exception ignored) {
                } finally {
                    doneSignal.countDown();
                }
            });

            pool.submit(() -> {
                try {
                    startSignal.await(5, TimeUnit.SECONDS);
                    thread2Won.set(lockService.tryAcquire(itemId, "thread-2", Duration.ofSeconds(10)));
                } catch (Exception ignored) {
                } finally {
                    doneSignal.countDown();
                }
            });

            startSignal.countDown();
            assertTrue(doneSignal.await(5, TimeUnit.SECONDS));

            // Exactly ONE thread must have won the lease
            assertTrue(thread1Won.get() ^ thread2Won.get(),
                    "Exactly one thread must acquire the distributed lease");

            String winnerToken = thread1Won.get() ? "thread-1" : "thread-2";
            lockService.release(itemId, winnerToken);
        } finally {
            pool.shutdownNow();
            cleanup(user);
        }
    }
}
