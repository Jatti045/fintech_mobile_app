package com.fintechapp.fintech_api.dto.transaction;

public record TransactionQueryParams(
        String page,
        String limit,
        String type,
        String category,
        String currentMonth,
        String currentYear,
        String startDate,
        String endDate,
        String budgetId,
        String searchQuery,
        String minAmount,
        String maxAmount) {
    public TransactionQueryParams(
            String page,
            String limit,
            String type,
            String category,
            String currentMonth,
            String currentYear,
            String startDate,
            String endDate,
            String budgetId,
            String searchQuery) {
        this(page, limit, type, category, currentMonth, currentYear, startDate, endDate, budgetId, searchQuery, null,
                null);
    }
}
