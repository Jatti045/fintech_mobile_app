package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.transaction.CreateTransactionRequest;
import com.fintechapp.fintech_api.dto.transaction.TransactionDataResponse;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

import jakarta.persistence.EntityManager;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

        @Mock
        private BudgetRepository budgetRepository;

        @Mock
        private TransactionRepository transactionRepository;

        @Mock
        private UserRepository userRepository;

        @Mock
        private FinancialCacheInvalidator cacheInvalidator;

        @Mock
        private CurrencyConversionService currencyConversionService;

        @Mock
        private EntityManager entityManager;

        private TransactionService transactionService;

        private AuthenticatedUser authUser;
        private User user;

        @BeforeEach
        void setUp() {
                transactionService = new TransactionService(
                                budgetRepository,
                                transactionRepository,
                                userRepository,
                                cacheInvalidator,
                                currencyConversionService);
                // @PersistenceContext fields are not populated by plain `new`;
                // inject the mock the same way the container would.
                org.springframework.test.util.ReflectionTestUtils.setField(
                                transactionService, "entityManager", entityManager);

                authUser = new AuthenticatedUser("user-123", "user@example.com", 1234567890L);
                user = new User();
                user.setId("user-123");
                user.setEmail("user@example.com");
                user.setUsername("testuser");
                user.setCurrency("USD");
                lenient().when(currencyConversionService.convert(any(Double.class), any(String.class), any(String.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));
        }

        @Test
        void updateTransaction_budgetReassignment_updatesBudgetCategoryAndSpent() {
                // Given existing transaction in Budget A (Groceries)
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setLimit(500.0);
                budgetA.setSpent(50.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                Budget budgetB = new Budget();
                budgetB.setId("budget-b");
                budgetB.setCategory("Shopping");
                budgetB.setLimit(300.0);
                budgetB.setSpent(20.0);
                budgetB.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetB.setUser(user);

                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setCategory("Groceries");
                existing.setType(TransactionType.EXPENSE);
                existing.setBaseCurrency("USD");
                existing.setOriginalAmount(50.0);
                existing.setOriginalCurrency("USD");
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                when(budgetRepository.findByIdAndUser_Id("budget-b", "user-123")).thenReturn(Optional.of(budgetB));
                when(transactionRepository.save(any(Transaction.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                // Reassign to Budget B with category omitted
                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                null, null, null, null, null, null, "budget-b", null, null, null);

                TransactionDataResponse response = transactionService.updateTransaction(authUser, "tx-1", request);

                // Verify budget reassignment and category synchronization
                assertEquals("budget-b", existing.getBudget().getId());
                assertEquals("Shopping", existing.getCategory());
                // Budget spent adjustments are atomic database updates, not
                // in-memory read-modify-write entity saves.
                verify(budgetRepository).decrementSpent("budget-a", 50.0);
                verify(budgetRepository).incrementSpent("budget-b", 50.0);
                verify(transactionRepository).save(existing);

                // Verify DTO contains both budgetId and category
                assertNotNull(response.data());
                assertNotNull(response.data().transaction());
                assertEquals("budget-b", response.data().transaction().budgetId());
                assertEquals("Shopping", response.data().transaction().category());
                assertEquals("budget-b", response.data().transaction().budget().id());

                // Verify cache invalidation (evicted for both old date and updated date)
                verify(cacheInvalidator, org.mockito.Mockito.times(2)).evictFinancialSummaryForDate(eq("user-123"),
                                any(Instant.class));
                verify(cacheInvalidator).evictRecurringPayments("user-123");
        }

        @Test
        void createTransaction_mixedCurrency_normalizesAmountIntoUserAggregationCurrency() {
                // User aggregates in CAD; the transaction is authored in USD.
                // Deterministic rate: 1 USD = 1.25 CAD.
                user.setCurrency("CAD");
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setLimit(500.0);
                budgetA.setSpent(0.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(budgetRepository.findByIdAndUser_Id("budget-a", "user-123")).thenReturn(Optional.of(budgetA));
                when(transactionRepository.save(any(Transaction.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));
                when(currencyConversionService.convert(100.0, "USD", "CAD")).thenReturn(125.0);

                CreateTransactionRequest request = new CreateTransactionRequest(
                                "US Subscription", 2, 2026, "2026-03-15T10:00:00Z", "Groceries", "EXPENSE",
                                125.0, null, "budget-a", null, "USD", 100.0);

                transactionService.createTransaction(authUser, request);

                ArgumentCaptor<Transaction> captor = ArgumentCaptor.forClass(Transaction.class);
                verify(transactionRepository).save(captor.capture());
                Transaction saved = captor.getValue();

                // The stored aggregate amount is the CONVERTED value (125 CAD),
                // never the raw original amount (100 USD).
                assertEquals(125.0, saved.getAmount(), 0.0001);
                assertEquals("CAD", saved.getBaseCurrency());
                // Raw source values are preserved for display/audit.
                assertEquals(100.0, saved.getOriginalAmount(), 0.0001);
                assertEquals("USD", saved.getOriginalCurrency());
                // Budget spent is aggregated by an atomic database increment.
                verify(budgetRepository).incrementSpent("budget-a", 125.0);
        }

        @Test
        void createTransaction_noCurrencySupplied_usesUserCurrencyForNormalization() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setLimit(500.0);
                budgetA.setSpent(0.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(budgetRepository.findByIdAndUser_Id("budget-a", "user-123")).thenReturn(Optional.of(budgetA));
                when(transactionRepository.save(any(Transaction.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                // No baseCurrency/originalCurrency on the request: the original
                // currency falls back to the user's currency (USD), so the
                // amount must pass through unchanged (single-currency path).
                CreateTransactionRequest request = new CreateTransactionRequest(
                                "Coffee", 2, 2026, "2026-03-15T10:00:00Z", "Groceries", "EXPENSE",
                                100.0, null, "budget-a", null, null, null);

                transactionService.createTransaction(authUser, request);

                verify(currencyConversionService).convert(100.0, "USD", "USD");

                ArgumentCaptor<Transaction> captor = ArgumentCaptor.forClass(Transaction.class);
                verify(transactionRepository).save(captor.capture());
                Transaction saved = captor.getValue();
                assertEquals(100.0, saved.getAmount(), 0.0001);
                assertEquals("USD", saved.getBaseCurrency());
                assertEquals("USD", saved.getOriginalCurrency());
                assertEquals(100.0, saved.getOriginalAmount(), 0.0001);
        }

        @Test
        void updateTransaction_budgetReassignmentWithExplicitCategory_preservesExplicitCategory() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setSpent(50.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                Budget budgetB = new Budget();
                budgetB.setId("budget-b");
                budgetB.setCategory("Shopping");
                budgetB.setSpent(20.0);
                budgetB.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetB.setUser(user);

                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setCategory("Groceries");
                existing.setType(TransactionType.EXPENSE);
                existing.setBaseCurrency("USD");
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                when(budgetRepository.findByIdAndUser_Id("budget-b", "user-123")).thenReturn(Optional.of(budgetB));
                when(transactionRepository.save(any(Transaction.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                null, null, "Custom Shopping", null, null, null, "budget-b", null, null, null);

                TransactionDataResponse response = transactionService.updateTransaction(authUser, "tx-1", request);

                assertEquals("budget-b", existing.getBudget().getId());
                assertEquals("Custom Shopping", existing.getCategory());
                assertEquals("Custom Shopping", response.data().transaction().category());
        }

        @Test
        void updateTransaction_budgetFromDifferentMonth_throwsNotFound() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setSpent(50.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                // Budget from April 2026
                Budget aprilBudget = new Budget();
                aprilBudget.setId("budget-april");
                aprilBudget.setCategory("Groceries");
                aprilBudget.setSpent(0.0);
                aprilBudget.setDate(Instant.parse("2026-04-01T00:00:00Z"));
                aprilBudget.setUser(user);

                // Transaction dated in March 2026
                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setCategory("Groceries");
                existing.setType(TransactionType.EXPENSE);
                existing.setBaseCurrency("USD");
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                when(budgetRepository.findByIdAndUser_Id("budget-april", "user-123"))
                                .thenReturn(Optional.of(aprilBudget));

                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                null, null, null, null, null, null, "budget-april", null, null, null);

                ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                                () -> transactionService.updateTransaction(authUser, "tx-1", request));
                assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        }

        @Test
        void updateTransaction_budgetNotOwnedByUser_throwsNotFound() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setType(TransactionType.EXPENSE);
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                // Foreign budget lookup returns empty for this user
                when(budgetRepository.findByIdAndUser_Id("other-user-budget", "user-123")).thenReturn(Optional.empty());

                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                null, null, null, null, null, null, "other-user-budget", null, null, null);

                ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                                () -> transactionService.updateTransaction(authUser, "tx-1", request));
                assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        }

        @Test
        void updateTransaction_existingFieldsUpdated_preservesBudgetAndAppliesDiff() {
                Budget budgetA = new Budget();
                budgetA.setId("budget-a");
                budgetA.setCategory("Groceries");
                budgetA.setSpent(50.0);
                budgetA.setDate(Instant.parse("2026-03-01T00:00:00Z"));
                budgetA.setUser(user);

                Transaction existing = new Transaction();
                existing.setId("tx-1");
                existing.setName("Walmart");
                existing.setAmount(50.0);
                existing.setDate(Instant.parse("2026-03-15T10:00:00Z"));
                existing.setCategory("Groceries");
                existing.setType(TransactionType.EXPENSE);
                existing.setBaseCurrency("USD");
                existing.setUser(user);
                existing.setBudget(budgetA);

                when(userRepository.findById("user-123")).thenReturn(Optional.of(user));
                when(transactionRepository.findByIdAndUser_Id("tx-1", "user-123")).thenReturn(Optional.of(existing));
                when(budgetRepository.findByIdAndUser_Id("budget-a", "user-123")).thenReturn(Optional.of(budgetA));
                when(transactionRepository.save(any(Transaction.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                // Amount increased from 50 to 75, name changed
                UpdateTransactionRequest request = new UpdateTransactionRequest(
                                "Super Walmart", null, null, null, 75.0, "Weekly groceries", null, null, null, null);

                TransactionDataResponse response = transactionService.updateTransaction(authUser, "tx-1", request);

                assertEquals("Super Walmart", existing.getName());
                assertEquals(75.0, existing.getAmount());
                assertEquals("Weekly groceries", existing.getDescription());
                assertEquals("budget-a", existing.getBudget().getId());
                assertEquals("Groceries", existing.getCategory());
                // 50.0 + (75.0 - 50.0) = +25 applied as an atomic database update.
                verify(budgetRepository).incrementSpent("budget-a", 25.0);
        }
}
