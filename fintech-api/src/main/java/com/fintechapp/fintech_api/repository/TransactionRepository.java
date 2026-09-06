package com.fintechapp.fintech_api.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import org.springframework.stereotype.Repository;

@Repository
public interface TransactionRepository
                extends JpaRepository<Transaction, String>, JpaSpecificationExecutor<Transaction> {

        Optional<Transaction> findByIdAndUser_Id(String id, String userId);

        List<Transaction> findByUser_IdOrderByDateDesc(String userId);

        List<Transaction> findByUser_IdAndTypeOrderByDateDesc(String userId, TransactionType type);

        List<Transaction> findByBudget_IdOrderByDateDesc(String budgetId);

        List<Transaction> findByUser_IdAndDateBetweenOrderByDateDesc(String userId, Instant from, Instant to);

        Optional<Transaction> findByPlaidTransactionIdAndUser_Id(String plaidTransactionId, String userId);

        List<Transaction> findByPlaidTransactionIdInAndUser_Id(List<String> plaidTransactionIds, String userId);

        /**
         * All transactions for a user + Plaid item that carry account ownership
         * data (non-null {@code plaid_account_id}). Only these can be paired into
         * proof-based internal transfers — same user, same item (institution),
         * different accounts.
         */
        @Query("SELECT t FROM Transaction t "
                        + "WHERE t.user.id = :userId AND t.plaidItemId = :plaidItemId "
                        + "AND t.plaidAccountId IS NOT NULL")
        List<Transaction> findTransferCandidates(
                        @Param("userId") String userId,
                        @Param("plaidItemId") String plaidItemId);

        long countByBudget_IdAndUser_Id(String budgetId, String userId);

        long deleteByUser_Id(String userId);

        /**
         * Sum of non-transfer transaction amounts of the given type within a date
         * window (used for actual income and month spending). Transfers between the
         * user's own accounts are excluded — they are movement of existing money,
         * not income or an expense.
         */
        @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t "
                        + "WHERE t.user.id = :userId AND t.type = :type AND t.date >= :from AND t.date < :to "
                        + "AND t.transfer = false")
        double sumAmountByUserAndTypeAndDateBetween(
                        @Param("userId") String userId,
                        @Param("type") TransactionType type,
                        @Param("from") Instant from,
                        @Param("to") Instant to);

        /**
         * Per-category expense totals for one user + month window, excluding
         * internal transfers. Used by {@link BudgetSuggestionService} to derive
         * conservative suggested limits from completed-month spending. Categories
         * with no expense activity in the window simply have no row.
         */
        @Query("SELECT LOWER(t.category) AS category, COALESCE(SUM(t.amount), 0) AS total "
                        + "FROM Transaction t "
                        + "WHERE t.user.id = :userId AND t.type = :type AND t.date >= :from AND t.date < :to "
                        + "AND t.transfer = false "
                        + "GROUP BY LOWER(t.category)")
        List<CategoryTotal> sumAmountByUserAndTypeGroupedByCategory(
                        @Param("userId") String userId,
                        @Param("type") TransactionType type,
                        @Param("from") Instant from,
                        @Param("to") Instant to);

        /**
         * CI projection returned by {@link #sumAmountByUserAndTypeGroupedByCategory}.
         */
        interface CategoryTotal {
                String getCategory();

                Double getTotal();
        }

        /**
         * Bounded, indexed history window for recurring-payment detection
         * ({@code idx_transactions_user_date}). Expenses only: recurring bills are
         * money out; income and internal transfers are structurally excluded so
         * neither can ever surface as an upcoming bill. Ordered ascending so the
         * detector sees chronology without re-sorting semantics.
         */
        List<Transaction> findByUser_IdAndTypeAndDateGreaterThanEqualOrderByDateAsc(
                        String userId,
                        TransactionType type,
                        Instant from);

        boolean existsByUser_Id(String userId);
}
