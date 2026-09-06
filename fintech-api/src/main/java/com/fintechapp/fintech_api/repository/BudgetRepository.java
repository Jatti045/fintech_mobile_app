package com.fintechapp.fintech_api.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.fintechapp.fintech_api.model.Budget;
import org.springframework.stereotype.Repository;

@Repository
public interface BudgetRepository extends JpaRepository<Budget, String> {

        /**
         * Atomically adds {@code amount} to the budget's persisted {@code spent}
         * aggregate. The increment is evaluated by the database in a single
         * statement, so concurrent writers can never lose each other's update
         * (a read-modify-write in memory would). Returns the number of rows
         * updated (0 when the budget no longer exists).
         */
        @Modifying(flushAutomatically = true)
        @Query("UPDATE Budget b SET b.spent = b.spent + :amount WHERE b.id = :budgetId")
        int incrementSpent(@Param("budgetId") String budgetId, @Param("amount") double amount);

        /**
         * Atomically subtracts {@code amount} from the budget's persisted
         * {@code spent} aggregate without clamping (mirrors the historical
         * read-modify-write behavior of manual transaction mutations, which did
         * not floor at zero).
         */
        @Modifying(flushAutomatically = true)
        @Query("UPDATE Budget b SET b.spent = b.spent - :amount WHERE b.id = :budgetId")
        int decrementSpent(@Param("budgetId") String budgetId, @Param("amount") double amount);

        /**
         * Atomically subtracts {@code amount} from the budget's persisted
         * {@code spent} aggregate, flooring the result at zero. This mirrors the
         * historical {@code Math.max(0, spent - amount)} clamping used by Plaid
         * ingestion paths so a duplicate removal cannot drive {@code spent}
         * negative.
         */
        @Modifying(flushAutomatically = true)
        @Query("UPDATE Budget b SET b.spent = CASE WHEN b.spent < :amount THEN 0 ELSE b.spent - :amount END "
                        + "WHERE b.id = :budgetId")
        int decrementSpentClamped(@Param("budgetId") String budgetId, @Param("amount") double amount);

        List<Budget> findByUser_IdOrderByDateDesc(String userId);

        List<Budget> findByUser_IdAndDateGreaterThanEqualAndDateLessThanOrderByDateDesc(
                        String userId,
                        Instant from,
                        Instant to);

        Optional<Budget> findByIdAndUser_Id(String id, String userId);

        /**
         * Case-insensitive lookup of a user's budget for the given category within
         * a single month window. Used by Plaid ingestion to match "category" to an
         * existing budget regardless of source casing.
         */
        Optional<Budget> findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        String userId,
                        String category,
                        Instant from,
                        Instant to);

        boolean existsByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        String userId,
                        String category,
                        Instant from,
                        Instant to);

        boolean existsByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThanAndIdNot(
                        String userId,
                        String category,
                        Instant from,
                        Instant to,
                        String excludedId);

        long deleteByUser_Id(String userId);
}
