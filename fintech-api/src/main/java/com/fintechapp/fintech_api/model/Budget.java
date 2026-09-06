package com.fintechapp.fintech_api.model;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.UpdateTimestamp;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Index;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "budgets", indexes = {
        @Index(name = "idx_budgets_user_date", columnList = "user_id,date"),
        @Index(name = "idx_budgets_user_category", columnList = "user_id,category")
}, uniqueConstraints = {
        /*
         * Database-enforced invariant: at most one budget per (user, category,
         * month). `date` always holds the first day of the month at 00:00 UTC,
         * so this tuple is the app's identity of "user + category + month".
         *
         * Without it, two concurrent Plaid syncs for DIFFERENT items of the
         * same user (the per-item sync lock does not serialize those) can both
         * pass the check-then-insert lookup in
         * PlaidTransactionIngestService.resolveOrCreateBudget and insert two
         * budgets for the same category and month.
         *
         * Mirrored for existing databases by the V18 migration and
         * DatabaseSchemaAutoPatch (this project does not run Flyway at boot).
         */
        @UniqueConstraint(name = "uq_budgets_user_category_month",
                columnNames = {"user_id", "category", "date"})
})
/*
 * Dynamic updates are a correctness requirement here, not an optimization:
 * budget.spent is mutated ONLY through atomic database-side updates
 * (BudgetRepository.incrementSpent/decrementSpent*), never in memory. When
 * other code mutates a budget (e.g. BudgetService updating limit/category)
 * and the entity flushes, @DynamicUpdate ensures the UPDATE statement
 * contains only the dirty columns — a stale in-memory spent value can never
 * be written back over a concurrent atomic increment/decrement.
 */
@org.hibernate.annotations.DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
public class Budget {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(nullable = false)
    private Instant date;

    @Column(nullable = false)
    private String category;

    @Column(name = "budget_limit", nullable = false)
    private double limit;

    @Column(nullable = false)
    private double spent = 0;

    /**
     * True when this category was auto-created by Plaid transaction ingestion
     * with a {@code $0} limit. Users should review these and assign a limit
     * (setting a limit clears the flag).
     */
    @Column(name = "is_auto_created", nullable = false)
    private boolean autoCreated = false;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @OneToMany(mappedBy = "budget")
    private Set<Transaction> transactions = new HashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
