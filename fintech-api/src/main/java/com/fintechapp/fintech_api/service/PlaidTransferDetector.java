package com.fintechapp.fintech_api.service;

import tools.jackson.databind.JsonNode;

/**
 * Decides whether a raw Plaid transaction is an internal transfer that must be
 * excluded from income and expense calculations.
 *
 * <p>
 * <b>The internal transfer invariant:</b> A transaction is an internal transfer
 * only when it moves existing money between two distinct accounts that both
 * belong
 * to the same user at the same financial institution (Plaid item). Every other
 * money
 * movement is either genuine income (money entering the user's net worth) or an
 * expense (money leaving the user's net worth).
 * </p>
 *
 * <p>
 * <b>Two-Phase Detection Architecture:</b>
 * </p>
 * <ul>
 * <li><b>Phase 1 (Ingest-time stateless evaluation):</b> At initial transaction
 * ingest,
 * {@link #isTransfer(JsonNode)} evaluates each raw Plaid transaction node in
 * isolation.
 * Because a single transaction node does not carry its paired opposite leg or
 * cross-account
 * ownership proof, it always returns {@code false}. This ensures no incoming
 * transaction
 * is prematurely suppressed before account ownership can be proven.</li>
 * <li><b>Phase 2 (Post-sync stateful reconciliation):</b> Following
 * synchronization,
 * {@code PlaidTransactionIngestService#reconcileInternalTransfers} executes a
 * proof-based
 * reconciliation over persisted transactions for the user and Plaid item. It
 * pairs
 * opposite-direction movements (income + expense) that share an exact
 * integer-cent amount,
 * occur on the same UTC calendar day, belong to different accounts under the
 * same Plaid item,
 * and exhibit verified transfer category codes.</li>
 * </ul>
 *
 * <p>
 * <b>Known Detection Limitation: Multi-Day Settlement Windows:</b>
 * </p>
 * <p>
 * Plaid's {@code /transactions/sync} payload does not provide an authoritative
 * cross-institution
 * or intra-bank transfer pair identifier. Transfers between accounts (such as
 * ACH or inter-account
 * sweeps) frequently settle across 1 to 3 business days, resulting in differing
 * posting dates.
 * Loosening the date matching window across multiple days was evaluated and
 * intentionally rejected
 * due to unacceptable false-positive risks:
 * <ul>
 * <li>Expanding the window across multiple days causes unrelated same-amount
 * transactions
 * (e.g., recurring subscriptions, bill payments, ATM withdrawals, or paycheck
 * splits)
 * to be erroneously matched as transfers.</li>
 * <li>Erronous transfer classification permanently erases real income and real
 * expenses from
 * the user's budget, cash flow, and monthly summary metrics.</li>
 * <li>In accounting systems, a false negative (showing both legs of a multi-day
 * transfer until
 * reconciled) is vastly preferable to a false positive (silently destroying
 * genuine financial records).</li>
 * </ul>
 * Therefore, multi-day settlement is retained as a documented known detection
 * limitation, and the
 * algorithm strictly enforces same-day proof-based pairing.
 * </p>
 */
public final class PlaidTransferDetector {

    private PlaidTransferDetector() {
    }

    /**
     * @param transactionNode the raw Plaid transaction object (unused — the
     *                        detector has no access to account ownership)
     * @return always {@code false}: the application cannot establish that a
     *         transaction moves money between two of the same user's accounts
     *         at the same financial institution from the data it persists, so
     *         every transaction is treated as income or expense.
     */
    public static boolean isTransfer(JsonNode transactionNode) {
        return false;
    }
}
