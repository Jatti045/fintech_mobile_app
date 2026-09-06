package com.fintechapp.fintech_api.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;
import jakarta.validation.Valid;

import com.fintechapp.fintech_api.dto.transaction.CreateTransactionRequest;
import com.fintechapp.fintech_api.dto.transaction.DeleteTransactionResponse;
import com.fintechapp.fintech_api.dto.transaction.TransactionDataResponse;
import com.fintechapp.fintech_api.dto.transaction.TransactionQueryParams;
import com.fintechapp.fintech_api.dto.transaction.TransactionsResponse;
import com.fintechapp.fintech_api.dto.transaction.UpdateTransactionRequest;
import com.fintechapp.fintech_api.dto.auth.AuthenticatedUser;
import com.fintechapp.fintech_api.service.TransactionService;

@RestController
@RequestMapping({ "/api/transactions", "/api/transaction" })
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @GetMapping
    public TransactionsResponse getTransactions(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @RequestParam(required = false) String page,
            @RequestParam(required = false) String limit,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String currentMonth,
            @RequestParam(required = false) String currentYear,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String budgetId,
            @RequestParam(required = false) String searchQuery,
            @RequestParam(required = false) String minAmount,
            @RequestParam(required = false) String maxAmount) {
        return transactionService.getTransactions(
                authenticatedUser,
                new TransactionQueryParams(
                        page,
                        limit,
                        type,
                        category,
                        currentMonth,
                        currentYear,
                        startDate,
                        endDate,
                        budgetId,
                        searchQuery,
                        minAmount,
                        maxAmount));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionDataResponse createTransaction(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @Valid @RequestBody CreateTransactionRequest request) {
        return transactionService.createTransaction(authenticatedUser, request);
    }

    @DeleteMapping("/{transactionId}")
    public DeleteTransactionResponse deleteTransaction(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable String transactionId) {
        return transactionService.deleteTransaction(authenticatedUser, transactionId);
    }

    @PatchMapping("/{transactionId}")
    @PutMapping("/{transactionId}")
    public TransactionDataResponse updateTransaction(
            @AuthenticationPrincipal AuthenticatedUser authenticatedUser,
            @PathVariable String transactionId,
            @Valid @RequestBody UpdateTransactionRequest request) {
        return transactionService.updateTransaction(authenticatedUser, transactionId, request);
    }
}
