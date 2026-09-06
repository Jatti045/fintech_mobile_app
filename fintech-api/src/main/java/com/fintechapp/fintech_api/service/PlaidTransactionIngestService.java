package com.fintechapp.fintech_api.service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.fintechapp.fintech_api.model.Budget;
import com.fintechapp.fintech_api.model.Transaction;
import com.fintechapp.fintech_api.model.TransactionType;
import com.fintechapp.fintech_api.model.User;
import com.fintechapp.fintech_api.repository.BudgetRepository;
import com.fintechapp.fintech_api.repository.TransactionRepository;

/**
 * Maps raw Plaid transaction payloads onto the app's transaction/budget model.
 *
 * <p>Each inbound transaction is keyed by {@code transaction_id} and written
 * with a single SQL upsert: a new id inserts a row, and an id that already
 * exists locally (e.g. a transaction re-served in Plaid's {@code modified}
 * array) updates the existing row in place. Removed records delete the matching
 * local transaction and restore budget spent aggregates.</p>
 *
 * <p>After a disconnect + reconnect Plaid re-serves the same underlying bank
 * transactions under <b>new</b> {@code transaction_id}s, so they are inserted
 * as-is — the same purchase may appear once per bank connection.</p>
 *
 * <p>The auto-category rule: a transaction's sanitized personal-finance
 * category is looked up against the user's existing monthly budgets (case
 * insensitive). When no budget matches, a new one is created for that month
 * with a default {@code limit = 0} (a zero-budget category), and the
 * transaction is linked to it.</p>
 */
@Service
public class PlaidTransactionIngestService {

    /** A normalized transaction carried from a Plaid /transactions/sync page. */
    public record PlaidTransaction(
            String transactionId,
            String name,
            Instant date,
            String category,
            double amount,
            boolean transfer,
            String isoCurrencyCode,
            String unofficialCurrencyCode,
            String plaidAccountId,
            String plaidItemId,
            String plaidPfcDetailed) {
    }

    private static final String DEFAULT_BASE_CURRENCY = "USD";

    private static final Logger logger = LoggerFactory.getLogger(PlaidTransactionIngestService.class);

    private final TransactionRepository transactionRepository;
    private final BudgetRepository budgetRepository;
    private final PlaidCategoryFormatter categoryFormatter;
    private final JdbcTemplate jdbcTemplate;
    private final CurrencyConversionService currencyConversionService;

    public PlaidTransactionIngestService(
            TransactionRepository transactionRepository,
            BudgetRepository budgetRepository,
            PlaidCategoryFormatter categoryFormatter,
            JdbcTemplate jdbcTemplate,
            CurrencyConversionService currencyConversionService) {
        this.transactionRepository = transactionRepository;
        this.budgetRepository = budgetRepository;
        this.categoryFormatter = categoryFormatter;
        this.jdbcTemplate = jdbcTemplate;
        this.currencyConversionService = currencyConversionService;
    }

    /**
     * Creates or updates a transaction for {@code plaidTx}, resolving (and
     * auto-creating if necessary) the user's zero-budget category for the
     * transaction's month.
     *
     * <p>The write is a single SQL upsert keyed on {@code plaid_transaction_id}:
     * a new id inserts a row; a known id (e.g. Plaid's {@code modified} array)
     * updates the existing row in place and reconciles the budget spent
     * aggregate by the amount difference.</p>
     */
    @Transactional
    public void upsertTransaction(User user, PlaidTransaction plaidTx) {
        if (plaidTx == null || !StringUtils.hasText(plaidTx.transactionId())) {
            return;
        }
        insert(user, plaidTx);
        // The two legs of an internal transfer may arrive in different syncs.
        // Re-run the proof-based pairing so a late-arriving counterpart marks
        // this transaction (and its already-stored mate) as a transfer.
        if (StringUtils.hasText(plaidTx.plaidItemId())) {
            reconcileInternalTransfers(user.getId(), plaidTx.plaidItemId());
        }
    }

    /**
     * Applies a whole {@code /transactions/sync} {@code added} batch.
     */
    @Transactional
    public void upsertAddedBatch(User user, List<PlaidTransaction> added) {
        if (added == null || added.isEmpty()) {
            return;
        }
        for (PlaidTransaction plaidTx : added) {
            upsertTransaction(user, plaidTx);
        }
    }

    /**
     * Removes transactions identified by their Plaid ids and restores the
     * affected budget spent aggregates.
     */
    @Transactional
    public void removeByPlaidIds(List<String> plaidTransactionIds, String userId) {
        if (plaidTransactionIds == null || plaidTransactionIds.isEmpty()) {
            return;
        }
        List<Transaction> transactions =
                transactionRepository.findByPlaidTransactionIdInAndUser_Id(plaidTransactionIds, userId);
        Set<String> affectedItems = new LinkedHashSet<>();
        for (Transaction tx : transactions) {
            if (StringUtils.hasText(tx.getPlaidItemId())) {
                affectedItems.add(tx.getPlaidItemId());
            }
        }
        for (Transaction tx : transactions) {
            removeTransaction(tx);
        }
        // A removed leg can leave its counterpart without a proven pair; re-run
        // the pairing so the remaining leg is re-evaluated.
        for (String itemId : affectedItems) {
            reconcileInternalTransfers(userId, itemId);
        }
    }

    /**
     * Proof-based internal-transfer classification for one user + Plaid item.
     *
     * <p>A transaction is marked {@code is_transfer = true} only when there is
     * a counterpart that proves the money moved between two of the user's own
     * accounts under the same Plaid item (same institution): for the same UTC
     * calendar day and the identical absolute amount there must be exactly one
     * {@code INCOME} and one {@code EXPENSE} transaction on two different
     * plaid accounts. Any group with more than two rows, same-direction rows,
     * or rows on the same account is ambiguous and is left as income/expense
     * (false-negative-biased — an unproven transfer is never silently removed
     * from the financial picture).</p>
     *
     * <p>Both legs must also carry a structured transfer-candidate signal
     * (Plaid category/descriptor) — this is a <b>required gate, never proof of
     * ownership</b>. A same-day, equal-amount coincidence between two unrelated
     * transactions on different accounts (e.g. a $500 bill from checking and a
     * $500 external deposit into savings) must not silently erase real income
     * or expenses. Ownership is proven only by the pairing conditions above;
     * the candidate gate simply prevents unrelated transactions from pairing.</p>
     *
     * <p>Plaid provides no explicit transfer-pair reference in the
     * /transactions/sync payload, so the corresponding leg is identified by
     * exact amount + same-day pairing restricted to transactions that carry
     * persisted account ownership data ({@code plaid_account_id} +
     * {@code plaid_item_id}). Transactions without that ownership data are
     * never re-classified.</p>
     */
    @Transactional
    public void reconcileInternalTransfers(String userId, String plaidItemId) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(plaidItemId)) {
            return;
        }
        List<Transaction> candidates =
                transactionRepository.findTransferCandidates(userId, plaidItemId);
        if (candidates.size() < 2) {
            return;
        }

        // Group by (UTC day, amount in cents) so pairing is exact on both.
        Map<String, List<Transaction>> byDayAmount = new HashMap<>();
        for (Transaction t : candidates) {
            String key = dayKey(t.getDate()) + "|" + amountCents(t.getAmount());
            byDayAmount.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
        }

        Set<String> provenTransferIds = new HashSet<>();
        for (List<Transaction> group : byDayAmount.values()) {
            // Only an unambiguous two-row group with opposite directions on
            // different accounts is proof of an internal transfer.
            if (group.size() != 2) {
                continue;
            }
            Transaction a = group.get(0);
            Transaction b = group.get(1);
            if (a.getType() == b.getType()) {
                continue;
            }
            if (a.getPlaidAccountId() == null || b.getPlaidAccountId() == null
                    || a.getPlaidAccountId().equals(b.getPlaidAccountId())) {
                continue;
            }
            // Candidate gate: both legs must look like a transfer to Plaid
            // (category/descriptor). Prevents unrelated same-amount coincidences
            // on two accounts from being silently excluded as "transfers".
            if (!isTransferCandidate(a) || !isTransferCandidate(b)) {
                continue;
            }
            provenTransferIds.add(a.getId());
            provenTransferIds.add(b.getId());
        }

        for (Transaction t : candidates) {
            boolean shouldBeTransfer = provenTransferIds.contains(t.getId());
            if (shouldBeTransfer == t.isTransfer()) {
                continue;
            }
            if (shouldBeTransfer) {
                markAsTransfer(t);
            } else {
                unmarkTransfer(t);
            }
        }
    }

    /**
     * Structured transfer-candidate signal from Plaid data (category or the
     * generic card-payment descriptors). Used only as a required gate alongside
     * the ownership pairing — it is never proof of ownership on its own.
     *
     * <p>Payroll and refunds are hard exclusions: a deposit categorized as
     * {@code TRANSFER_PAYROLL} (or a refund under a transfer umbrella) must
     * never become the income leg of an internal-transfer pair, and an
     * opposite-legged same-day equal-amount coincidence must not hide real
     * payroll or refund activity.</p>
     */
    private static boolean isTransferCandidate(Transaction t) {
        // Plaid's coarse primary/detailed category (e.g. "TRANSFER_IN",
        // "LOAN_PAYMENTS") is NOT proof of an internal transfer — it also
        // covers Cash App/Venmo P2P, external loan payments, and credit-card
        // payments. The detailed code is the only structured signal that
        // distinguishes a same-user account transfer
        // (TRANSFER_*_ACCOUNT_TRANSFER) from P2P / external movements
        // (TRANSFER_*_THIRD_PARTY_P2P). This gate is required, never proof
        // of ownership on its own.
        String detailed = t.getPlaidPfcDetailed();
        if (StringUtils.hasText(detailed)) {
            String d = detailed.toUpperCase(Locale.ROOT);
            // Payroll and refunds are never transfer legs (paired or not).
            if (d.contains("PAYROLL") || d.contains("REFUND") || d.contains("DEPOSIT")) {
                return false;
            }
            // Only same-user internal account transfers may pair.
            if (d.contains("TRANSFER") && d.contains("ACCOUNT_TRANSFER")) {
                return true;
            }
        }
        // Legacy fallback (no detailed code): card-payment descriptors are
        // the classic proof signal for credit-card payments when the PFC is
        // not available — but only the explicit descriptors, not the broad
        // "Transfer"/"Credit Card" category text.
        String name = t.getName();
        if (StringUtils.hasText(name)) {
            String n = name.toUpperCase(Locale.ROOT);
            if (n.contains("PAYMENT THANK YOU")
                    || n.contains("PAIEMENT T MERCI")
                    || n.contains("PAYMENT THANK YOU-MOBILE")) {
                return true;
            }
        }
        return false;
    }

    /** Flips an expense/income into a transfer and reverses any budget contribution. */
    private void markAsTransfer(Transaction tx) {
        if (tx.getType() == TransactionType.EXPENSE && tx.getBudget() != null) {
            // Atomic, zero-floored decrement — safe against concurrent writers.
            budgetRepository.decrementSpentClamped(tx.getBudget().getId(), tx.getAmount());
        }
        tx.setBudget(null);
        tx.setTransfer(true);
        transactionRepository.save(tx);
    }

    /** Flips a transfer back into normal activity, applying the existing budget rules. */
    private void unmarkTransfer(Transaction tx) {
        if (tx.getType() == TransactionType.EXPENSE) {
            Budget budget = resolveOrCreateBudget(tx.getUser(), tx.getCategory(), tx.getDate());
            tx.setBudget(budget);
            // Atomic database-side increment — safe against concurrent writers.
            budgetRepository.incrementSpent(budget.getId(), tx.getAmount());
        }
        tx.setTransfer(false);
        transactionRepository.save(tx);
    }

    /** UTC calendar day key (epoch day) used for same-day leg pairing. */
    private static String dayKey(Instant instant) {
        if (instant == null) {
            return "0";
        }
        return String.valueOf(LocalDate.ofInstant(instant, ZoneOffset.UTC).toEpochDay());
    }

    /** Amount in integer cents for exact, drift-free comparison. */
    private static long amountCents(double amount) {
        return Math.round(amount * 100);
    }

    /**
     * Updates an existing local transaction with the incoming Plaid payload.
     *
     * <p>Transfers never contribute to budget spent aggregates: when a row
     * becomes a transfer its previous budget contribution is restored, and when
     * a row stops being a transfer the full amount is added to the resolved
     * budget (the old transfer row had no contribution).</p>
     */
    private void applyUpdate(Transaction tx, User user, PlaidTransaction plaidTx) {
        String category = categoryFormatter.toReadableCategory(plaidTx.category());
        Instant txDate = plaidTx.date() != null ? plaidTx.date() : Instant.EPOCH;
        double originalAmount = Math.abs(plaidTx.amount());
        TransactionType type = plaidTx.amount() >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        String originalCurrency = resolveCurrency(plaidTx.isoCurrencyCode(), plaidTx.unofficialCurrencyCode(), user);
        String baseCurrency = aggregationCurrency(user);
        double absoluteAmount = currencyConversionService.convert(originalAmount, originalCurrency, baseCurrency);

        boolean incomingTransfer = plaidTx.transfer();
        boolean wasTransfer = tx.isTransfer();
        Budget oldBudget = tx.getBudget();
        double oldAmount = tx.getAmount();
        TransactionType oldType = tx.getType();

        tx.setName(displayName(plaidTx, category));
        tx.setCategory(category);
        tx.setDate(txDate);
        tx.setAmount(absoluteAmount);
        tx.setType(type);
        tx.setBaseCurrency(baseCurrency);
        tx.setOriginalCurrency(originalCurrency);
        tx.setOriginalAmount(originalAmount);
                tx.setPlaidTransactionId(plaidTx.transactionId());
        tx.setPlaidAccountId(plaidTx.plaidAccountId());
        tx.setPlaidItemId(plaidTx.plaidItemId());
        tx.setPlaidPfcDetailed(plaidTx.plaidPfcDetailed());
        tx.setTransfer(incomingTransfer);

        if (incomingTransfer) {
            // A transfer is movement of existing money — it must not count
            // toward any budget. Restore the contribution if the row previously
            // was a budgeted expense. Atomic, zero-floored decrement.
            if (!wasTransfer && oldBudget != null && oldType == TransactionType.EXPENSE) {
                budgetRepository.decrementSpentClamped(oldBudget.getId(), oldAmount);
            }
            tx.setBudget(null);
            transactionRepository.save(tx);
            return;
        }

        Budget budget = resolveOrCreateBudget(user, category, txDate);
        tx.setBudget(budget);
        transactionRepository.save(tx);

        if (wasTransfer) {
            // Previously a transfer with no budget contribution; the full
            // amount is now real activity. Atomic database-side increment.
            if (type == TransactionType.EXPENSE) {
                budgetRepository.incrementSpent(budget.getId(), absoluteAmount);
            }
            return;
        }
        reconcileBudgetOnUpdate(oldBudget, oldAmount, oldType, budget, absoluteAmount, type);
    }

    /**
     * Inserts a new transaction via native {@code INSERT ... ON CONFLICT DO
     * NOTHING}: the database unique index on {@code plaid_transaction_id} is
     * the arbiter between insert and update. A conflict means the row already
     * exists (e.g. a transaction re-served in Plaid's {@code modified} array or
     * a concurrent sync) — it is loaded and reconciled as an update instead.
     *
     * <p>Transfer transactions are stored without a budget link and never
     * increment budget spent.</p>
     */
    private void insert(User user, PlaidTransaction plaidTx) {
        String category = categoryFormatter.toReadableCategory(plaidTx.category());
        Instant txDate = plaidTx.date() != null ? plaidTx.date() : Instant.EPOCH;
        double originalAmount = Math.abs(plaidTx.amount());
        TransactionType type = plaidTx.amount() >= 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        String originalCurrency = resolveCurrency(plaidTx.isoCurrencyCode(), plaidTx.unofficialCurrencyCode(), user);
        String baseCurrency = aggregationCurrency(user);
        double absoluteAmount = currencyConversionService.convert(originalAmount, originalCurrency, baseCurrency);
        boolean transfer = plaidTx.transfer();
        Budget budget = transfer ? null : resolveOrCreateBudget(user, category, txDate);

        int inserted = jdbcTemplate.update("""
                INSERT INTO transactions (
                    id, name, transaction_date, category, type, amount,
                    base_currency, original_amount, original_currency,
                    plaid_transaction_id, plaid_account_id, plaid_item_id, is_transfer,
                    plaid_pfc_detailed, description, user_id, budget_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NOW(), NOW())
                ON CONFLICT DO NOTHING
                """,
                UUID.randomUUID().toString(),
                displayName(plaidTx, category),
                Timestamp.from(txDate),
                category,
                type.name(),
                absoluteAmount,
                baseCurrency,
                originalAmount,
                originalCurrency,
                                plaidTx.transactionId(),
                plaidTx.plaidAccountId(),
                plaidTx.plaidItemId(),
                transfer,
                plaidTx.plaidPfcDetailed(),
                user.getId(),
                budget != null ? budget.getId() : null);

        if (inserted == 0) {
            // The row already exists — reconcile it as an update (modified).
            transactionRepository
                    .findByPlaidTransactionIdAndUser_Id(plaidTx.transactionId(), user.getId())
                    .ifPresent(tx -> applyUpdate(tx, user, plaidTx));
            return;
        }

        if (!transfer && type == TransactionType.EXPENSE) {
            // Atomic database-side increment — safe against concurrent writers
            // (manual transaction creation or another sync page may touch the
            // same budget at the same time).
            budgetRepository.incrementSpent(budget.getId(), absoluteAmount);
        }
    }

    private String displayName(PlaidTransaction plaidTx, String formattedCategory) {
        return StringUtils.hasText(plaidTx.name()) ? plaidTx.name().trim() : formattedCategory;
    }

    /** Deletes one transaction and restores its budget spent contribution. */
    private void removeTransaction(Transaction tx) {
        if (tx.getType() == TransactionType.EXPENSE && tx.getBudget() != null) {
            // Atomic, zero-floored decrement — safe against concurrent writers.
            budgetRepository.decrementSpentClamped(tx.getBudget().getId(), tx.getAmount());
        }
        transactionRepository.delete(tx);
    }

    /** Resolves the month-scoped budget for a transaction's category. */
    private Budget resolveOrCreateBudget(User user, String category, Instant txDate) {
        LocalDate localDate = LocalDate.ofInstant(txDate, ZoneOffset.UTC);
        int year = localDate.getYear();
        int monthIndex = localDate.getMonthValue() - 1;
        return resolveOrCreateBudget(user, category, monthStart(year, monthIndex), nextMonthStart(year, monthIndex));
    }

    private Budget resolveOrCreateBudget(User user, String category, Instant monthStart, Instant nextMonthStart) {
        Optional<Budget> existing = budgetRepository
                .findByUser_IdAndCategoryIgnoreCaseAndDateGreaterThanEqualAndDateLessThan(
                        user.getId(), category, monthStart, nextMonthStart);
        if (existing.isPresent()) {
            return existing.get();
        }

        Budget created = new Budget();
        created.setUser(user);
        created.setCategory(category);
        created.setLimit(0); // auto-created "Category" starts with a default zero budget
        created.setDate(monthStart);
        created.setAutoCreated(true); // flag as unbudgeted until the user assigns a limit
        // Flush immediately so the native transaction INSERT below can reference
        // the budget_id foreign key within the same database transaction.
        return budgetRepository.saveAndFlush(created);
    }

    /** Mirrors the spending reconciliation in {@code TransactionService.updateTransaction}. */
    private void reconcileBudgetOnUpdate(
            Budget oldBudget,
            double oldAmount,
            TransactionType oldType,
            Budget newBudget,
            double newAmount,
            TransactionType newType) {
        boolean sameBudget = oldBudget != null && newBudget != null && oldBudget.getId().equals(newBudget.getId());

        if (newType == TransactionType.EXPENSE) {
            if (oldType == TransactionType.EXPENSE && !sameBudget) {
                // Atomic, zero-floored decrement.
                budgetRepository.decrementSpentClamped(oldBudget.getId(), oldAmount);
            }
            if (!sameBudget) {
                // Atomic database-side increment.
                budgetRepository.incrementSpent(newBudget.getId(), newAmount);
            } else {
                double diff = newAmount - oldAmount;
                if (diff != 0.0) {
                    // Atomic database-side adjustment of the same budget.
                    if (diff > 0) {
                        budgetRepository.incrementSpent(newBudget.getId(), diff);
                    } else {
                        budgetRepository.decrementSpentClamped(newBudget.getId(), -diff);
                    }
                }
            }
        } else if (oldType == TransactionType.EXPENSE) {
            // Atomic, zero-floored decrement.
            budgetRepository.decrementSpentClamped(oldBudget.getId(), oldAmount);
        }
    }

    private String resolveCurrency(String isoCurrencyCode, String unofficialCurrencyCode, User user) {
        String resolved = StringUtils.hasText(isoCurrencyCode)
                ? isoCurrencyCode
                : unofficialCurrencyCode;
        if (StringUtils.hasText(resolved)) {
            return resolved.trim().toUpperCase(Locale.ROOT);
        }
        if (StringUtils.hasText(user.getCurrency())) {
            return user.getCurrency().trim().toUpperCase(Locale.ROOT);
        }
        return DEFAULT_BASE_CURRENCY;
    }

    private String aggregationCurrency(User user) {
        return StringUtils.hasText(user.getCurrency())
                ? user.getCurrency().trim().toUpperCase(Locale.ROOT)
                : DEFAULT_BASE_CURRENCY;
    }

    private Instant monthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private Instant nextMonthStart(int year, int month) {
        return LocalDate.of(year, month + 1, 1).plusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }
}
