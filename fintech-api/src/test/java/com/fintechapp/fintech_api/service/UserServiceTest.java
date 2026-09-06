package com.fintechapp.fintech_api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.dto.user.UpdateCurrencyRequest;
import com.fintechapp.fintech_api.dto.user.UserDataResponse;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.PasswordResetTokenRepository;
import com.fintechapp.fintech_api.repository.PlaidItemRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;
import com.fintechapp.fintech_api.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private BudgetRepository budgetRepository;

    @Mock
    private PlaidItemRepository plaidItemRepository;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private MonthlyIncomeService monthlyIncomeService;

    @Mock
    private IncomeCalculationService incomeCalculationService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private CloudinaryService cloudinaryService;

    @Mock
    private UploadValidationService uploadValidationService;

    @Mock
    private FinancialCacheInvalidator cacheInvalidator;

    private UserService userService;

    private final AuthenticatedUser authUser = new AuthenticatedUser("user-1", "test@example.com", 1234567890L);
    private User user;

    @BeforeEach
    void setUp() {
        userService = new UserService(
                userRepository,
                transactionRepository,
                budgetRepository,
                plaidItemRepository,
                passwordResetTokenRepository,
                monthlyIncomeService,
                incomeCalculationService,
                passwordEncoder,
                cloudinaryService,
                uploadValidationService,
                cacheInvalidator);

        user = new User();
        user.setId("user-1");
        user.setEmail("test@example.com");
        user.setUsername("testuser");
        user.setCurrency("USD");
    }

    @Test
    void updateCurrency_success_whenNoTransactions_updatesCurrencyAndEvictsCaches() {
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));
        when(transactionRepository.existsByUser_Id("user-1")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserDataResponse response = userService.updateCurrency(authUser, new UpdateCurrencyRequest("eur"));

        assertNotNull(response);
        assertEquals("EUR", response.data().currency());
        assertEquals("EUR", user.getCurrency());
        verify(userRepository).save(user);
        verify(cacheInvalidator).evictFinancialSummaryRegion("user-1");
        verify(cacheInvalidator).evictRecurringPayments("user-1");
    }

    @Test
    void updateCurrency_throwsBadRequest_whenTransactionsExist() {
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));
        when(transactionRepository.existsByUser_Id("user-1")).thenReturn(true);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> userService.updateCurrency(authUser, new UpdateCurrencyRequest("EUR")));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Cannot change currency when transactions already exist.", exception.getReason());
        verify(userRepository, never()).save(any());
        verify(cacheInvalidator, never()).evictFinancialSummaryRegion(any());
        verify(cacheInvalidator, never()).evictRecurringPayments(any());
    }

    @Test
    void updateCurrency_success_whenSameCurrencyEvenIfTransactionsExist() {
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));

        UserDataResponse response = userService.updateCurrency(authUser, new UpdateCurrencyRequest("USD"));

        assertNotNull(response);
        assertEquals("USD", response.data().currency());
        verify(transactionRepository, never()).existsByUser_Id(any());
        verify(userRepository, never()).save(any());
        verify(cacheInvalidator, never()).evictFinancialSummaryRegion(any());
    }

    @Test
    void updateCurrency_throwsBadRequest_whenCurrencyCodeInvalid() {
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> userService.updateCurrency(authUser, new UpdateCurrencyRequest("US")));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Invalid currency code", exception.getReason());
    }

    @Test
    void updateCurrency_throwsBadRequest_whenCurrencyBlank() {
        when(userRepository.findById("user-1")).thenReturn(Optional.of(user));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> userService.updateCurrency(authUser, new UpdateCurrencyRequest("   ")));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("Currency code is required.", exception.getReason());
    }
}
