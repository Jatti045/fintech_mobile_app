package com.fintechapp.fintech_api.model;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.annotations.UpdateTimestamp;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "plaid_items")
@Getter
@Setter
@NoArgsConstructor
public class PlaidItem {

    @Id
    @GeneratedValue
    @UuidGenerator
    @Column(nullable = false, updatable = false, length = 36)
    private String id;

    @Column(name = "item_id", nullable = false, unique = true, length = 128)
    private String itemId;

    @Column(name = "access_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEncrypted;

    @Column(name = "institution_name")
    private String institutionName;

    @Column(name = "cursor", columnDefinition = "TEXT")
    private String cursor;

    /**
     * Whether the connection currently needs the user to re-authenticate.
     * Defaults to {@link PlaidItemStatus#ACTIVE}; flipped to
     * {@link PlaidItemStatus#REQUIRES_REAUTH} when Plaid reports
     * {@code ITEM_LOGIN_REQUIRED}.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private PlaidItemStatus status = PlaidItemStatus.ACTIVE;

    /**
     * When {@code ITEM_LOGIN_REQUIRED / ERROR} was last received, so the team
     * can gauge how long a connection has been waiting for re-auth.
     */
    @Column(name = "reauth_requested_at")
    private Instant reauthRequestedAt;

    /**
     * Set when a transaction sync run threw an exception, cleared on the next
     * successful sync. Drives the non-dismissible "trouble syncing" warning in
     * the clients.
     */
    @Column(name = "sync_error", nullable = false)
    private boolean syncError;

    /** Last time a {@code /transactions/sync} page committed successfully. */
    @Column(name = "last_synced_at")
    private Instant lastSyncedAt;

    /**
     * Unique token identifying the execution instance currently holding the
     * distributed sync lease for this item.
     */
    @Column(name = "sync_lock_token", length = 64)
    private String syncLockToken;

    /**
     * Timestamp at which the current distributed sync lease expires.
     * Prevents permanent deadlocks if a syncing instance crashes mid-run.
     */
    @Column(name = "sync_lock_expires_at")
    private Instant syncLockExpiresAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
