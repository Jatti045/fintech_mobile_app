package com.fintechapp.fintech_api.dto.transaction;

import java.time.Instant;
import java.util.List;

import com.fintechapp.fintech_api.model.TransactionType;

public record TransactionsResponse(
                boolean success,
                String message,
                Data data) {

        public record Data(
                        List<TransactionItem> transaction,
                        Pagination pagination,
                        Filters filters) {
        }

        public record TransactionItem(
                        String id,
                        String name,
                        Instant date,
                        String category,
                        TransactionType type,
                        boolean isTransfer,
                        double amount,
                        String baseCurrency,
                        Double originalAmount,
                        String originalCurrency,
                        String description,
                        BudgetInfo budget,
                        String budgetId) {
        }

        public record BudgetInfo(
                        String id,
                        String category,
                        double limit,
                        double spent) {
        }

        public record Pagination(
                        int currentPage,
                        int totalPages,
                        long totalCount,
                        boolean hasNextPage,
                        boolean hasPrevPage,
                        int limit) {
        }

        public record Filters(
                        String type,
                        String category,
                        String startDate,
                        String endDate,
                        String budgetId,
                        Double minAmount,
                        Double maxAmount) {
                public Filters(
                                String type,
                                String category,
                                String startDate,
                                String endDate,
                                String budgetId) {
                        this(type, category, startDate, endDate, budgetId, null, null);
                }
        }
}
