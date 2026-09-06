import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import transactionAPI from "@/api/transaction";
import budgetAPI from "@/api/budget";
import financialSummaryAPI from "@/api/financialSummary";
import recurringAPI from "@/api/recurring";
import insightAPI from "@/api/insight";
import { PAGINATION_LIMIT } from "@/constants/appConfig";
import type {
  ITransaction,
  ITransactionPagination,
  ITransactionResponse,
} from "@/types/transaction/types";
import type {
  IBudget,
  IBudgetData,
  IBudgetSuggestions,
  IApplySuggestionsResult,
} from "@/types/budget/types";
import type { IFinancialSummary } from "@/types/financialSummary/types";
import type { IRecurringPaymentsResponseData } from "@/types/recurring/types";
import type { IMonthlyInsight } from "@/types/insight/types";
import type { IApiResponse } from "@/types/api/types";

/**
 * The single owner for month-scoped server-state fetching.
 *
 * All transactions / budgets / financial-summary reads and writes go through
 * this slice. Cache entries are keyed per month + filter set (page is
 * deliberately excluded and handled by `merge`), which makes cross-month
 * race conditions structurally impossible: two months can never clobber each
 * other's entry, replacing the previous hand-rolled `latestRequestId` guards.
 */

export interface MonthArgs {
  currentMonth: number;
  currentYear: number;
}

export interface GetTransactionsArgs extends MonthArgs {
  searchQuery?: string;
  startDate?: string | null;
  endDate?: string | null;
  budgetId?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  page?: number;
  limit?: number;
}

export interface TransactionsEnvelope {
  transaction: ITransaction[];
  pagination?: ITransactionPagination;
}

/** A `{year, month}` pair identifying one month-scoped cache tag. */
export interface MonthKey {
  year: number;
  month: number;
}

/** Cache-tag id for a month (`"year-month"`), shared with cachePersistence. */
export const monthTagId = ({ year, month }: MonthKey) => `${year}-${month}`;

const argsMonth = (a: MonthArgs) => ({
  year: a.currentYear,
  month: a.currentMonth,
});

const monthTags = <
  T extends "Transactions" | "Budgets" | "Summary" | "Suggestions",
>(
  type: T,
  months: (MonthKey | undefined | null)[],
) => {
  const seen = new Set<string>();
  const tags: { type: T; id: string }[] = [];
  for (const m of months) {
    if (!m) continue;
    const id = monthTagId(m);
    if (seen.has(id)) continue;
    seen.add(id);
    tags.push({ type, id });
  }
  return tags;
};

/** Derive the month a transaction date falls in (UTC accounting domain). */
export const monthOfDate = (date?: string | Date | null): MonthKey | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
};

const toError = (e: any) => ({
  status: "CUSTOM_ERROR" as const,
  error: e?.message || "Request failed",
});

/**
 * Pagination metadata is taken verbatim from the backend (which computes it
 * from an authoritative COUNT query). It is never fabricated client-side, so
 * a cached entry can never claim `totalPages: 1` when more pages exist.
 */
/**
 * Page 1 replaces the accumulated list; page N appends with id-deduping.
 *
 * Deduping matters because a mutation invalidates the month tag and RTK Query
 * refetches every subscribed entry with its ORIGINAL args — including
 * already-appended higher pages. Without dedup those re-appends would create
 * duplicate rows.
 */
function mergeTransactions(
  current: TransactionsEnvelope,
  incoming: TransactionsEnvelope,
  {
    arg,
  }: {
    arg: GetTransactionsArgs;
    baseQueryMeta: unknown;
    requestId: string;
    fulfilledTimeStamp: number;
  },
) {
  const existing = current.transaction ?? [];
  const incomingItems = incoming.transaction ?? [];
  const page = arg.page ?? 1;
  if (page <= 1) {
    current.transaction = incomingItems;
  } else {
    const seen = new Set<string>();
    for (const t of existing) if (t.id) seen.add(t.id);
    const additions = incomingItems.filter((t) => !t.id || !seen.has(t.id));
    current.transaction = [...existing, ...additions];
  }

  // Always store backend-authoritative pagination metadata verbatim; it is
  // never fabricated client-side, so cached months can't claim false
  // `totalPages` / `hasNextPage`.
  if (incoming.pagination) current.pagination = incoming.pagination;
}

export const api = createApi({
  reducerPath: "api",
  // All endpoints use `queryFn` and call the typed API layer directly (which
  // owns axios/auth/error normalization); the base query itself is never hit.
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    "Transactions",
    "Budgets",
    "Summary",
    "Suggestions",
    "Recurring",
    "Insights",
  ],
  /**
   * Cold-start revalidation strategy: hydrated cache entries are seeded via
   * `upsertQueryData` in `cachePersistence.ts` and then explicitly
   * `invalidateTags`d for the seeded month, so the first subscription renders
   * the seed instantly AND refetches authoritative data (legacy SWR cadence).
   * A blanket `refetchOnMountOrArgChange: true` was rejected: it made every
   * tag invalidation fire its refetch twice.
   */
  endpoints: (build) => ({
    getTransactions: build.query<TransactionsEnvelope, GetTransactionsArgs>({
      queryFn: async (args) => {
        try {
          const response = await transactionAPI.fetchAll({
            searchQuery: args.searchQuery ?? "",
            currentMonth: args.currentMonth,
            currentYear: args.currentYear,
            startDate: args.startDate ?? null,
            endDate: args.endDate ?? null,
            budgetId: args.budgetId ?? null,
            minAmount: args.minAmount ?? null,
            maxAmount: args.maxAmount ?? null,
            page: args.page ?? 1,
            limit: args.limit == null ? PAGINATION_LIMIT : args.limit,
          });
          const rawTransactions = response.data?.transaction ?? [];
          const normalized = rawTransactions.map((t: any) => ({
            ...t,
            budgetId: t.budgetId ?? t.budget?.id ?? null,
          }));
          return {
            data: {
              transaction: normalized,
              pagination: response.data?.pagination,
            },
          };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const a = queryArgs as GetTransactionsArgs;
        const canonicalLimit = a.limit == null ? PAGINATION_LIMIT : a.limit;
        return `${endpointName}(${JSON.stringify([
          a.currentYear,
          a.currentMonth,
          (a.searchQuery ?? "").trim(),
          a.budgetId ?? null,
          a.minAmount ?? null,
          a.maxAmount ?? null,
          a.startDate ?? null,
          a.endDate ?? null,
          canonicalLimit,
        ])})`;
      },
      merge: mergeTransactions,
      // Parity with the old thunk semantics: searches/filters always hit the
      // network (only unfiltered month views are allowed to serve cache),
      // and moving between pages must force a fetch since the cache key
      // deliberately excludes `page`.
      forceRefetch: ({ currentArg, previousArg }) => {
        if (previousArg?.page !== currentArg?.page) return true;
        const hasActiveFilters =
          Boolean((currentArg?.searchQuery ?? "").trim()) ||
          Boolean(currentArg?.budgetId) ||
          currentArg?.minAmount != null ||
          currentArg?.maxAmount != null;
        return hasActiveFilters;
      },
      providesTags: (_result, _error, arg) => [
        { type: "Transactions", id: monthTagId(argsMonth(arg)) },
      ],
    }),

    getBudgets: build.query<IBudget[], MonthArgs>({
      queryFn: async (args) => {
        try {
          const response = await budgetAPI.fetchAll(args);
          return { data: response?.data ?? [] };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: "Budgets", id: monthTagId(argsMonth(arg)) },
      ],
    }),

    /**
     * Smart Month Setup — suggested limits for a month. Read-only; cached per
     * month under its own tag. Re-suggesting a month whose budgets changed
     * (via apply or a budget mutation) refreshes this entry because those
     * mutations invalidate the month's `Suggestions` tag.
     */
    getBudgetSuggestions: build.query<IBudgetSuggestions, MonthArgs>({
      queryFn: async (args) => {
        try {
          const response = await budgetAPI.fetchSuggestions(args);
          if (!response?.data) {
            return {
              data: {
                year: args.currentYear,
                month: args.currentMonth,
                suggestions: [],
              },
            };
          }
          return { data: response.data };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: "Suggestions", id: monthTagId(argsMonth(arg)) },
      ],
    }),

    /**
     * Upcoming Bills — recurring-payment predictions derived from history.
     * Keyed per local calendar day (`today`) so a cached prediction set can
     * never outlive midnight; invalidated by every transaction mutation via
     * the shared `Recurring` tag (a new charge extends or confirms a series).
     */
    getRecurringPayments: build.query<
      IRecurringPaymentsResponseData,
      { today: string }
    >({
      queryFn: async ({ today }) => {
        try {
          const response = await recurringAPI.fetchUpcoming(today);
          return {
            data: response?.data ?? { recurringPayments: [] },
          };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      providesTags: () => [{ type: "Recurring", id: "all" }],
    }),

    /**
     * Smart Month Setup — apply the user-confirmed batch atomically. The
     * server never overwrites a manually configured limit. Invalidates the
     * month's budgets/summary (so the Budget tab and Home refresh) and its
     * suggestions (so a re-opened setup is authoritative).
     */
    applyBudgetSuggestions: build.mutation<
      IApiResponse<IApplySuggestionsResult>,
      {
        month: number;
        year: number;
        items: { category: string; limit: number }[];
      }
    >({
      queryFn: async (payload) => {
        try {
          const response = await budgetAPI.applySuggestions(payload);
          return { data: response };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      invalidatesTags: (_r, _e, arg) => [
        {
          type: "Budgets",
          id: monthTagId({ year: arg.year, month: arg.month }),
        },
        {
          type: "Summary",
          id: monthTagId({ year: arg.year, month: arg.month }),
        },
        {
          type: "Suggestions",
          id: monthTagId({ year: arg.year, month: arg.month }),
        },
      ],
    }),

    getFinancialSummary: build.query<IFinancialSummary, MonthArgs>({
      queryFn: async (args) => {
        try {
          const response = await financialSummaryAPI.fetchSummary(args);
          return { data: response?.data };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: "Summary", id: monthTagId(argsMonth(arg)) },
      ],
    }),

    /**
     * "Explain my month" — AI-generated explanation for a month, produced by
     * the backend from Budgee's deterministic financial services. Fetched
     * lazily (only when the user taps the action) and cached per month so
     * repeated taps and month switches reuse the same explanation.
     */
    getMonthlyInsight: build.query<IMonthlyInsight, MonthArgs>({
      queryFn: async (args) => {
        try {
          const response = await insightAPI.fetchMonthlyInsight(args);
          return { data: response?.data };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: "Insights", id: monthTagId(argsMonth(arg)) },
      ],
    }),

    createTransaction: build.mutation<
      ITransactionResponse<ITransaction>,
      Partial<ITransaction>
    >({
      queryFn: async (transaction) => {
        try {
          const response = await transactionAPI.create(
            transaction as ITransaction,
          );
          if (response?.data?.transaction) {
            const t = response.data.transaction as any;
            t.budgetId = t.budgetId ?? t.budget?.id ?? null;
          }
          return { data: response };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      /**
       * NOTE: transaction mutations deliberately do NOT invalidate the
       * `Transactions` tag. An invalidation-driven refetch reuses the entry's
       * ORIGINAL args, which after load-more is a higher page whose
       * merge-append can resurrect rows the server already deleted ("ghosts")
       * and can even dedupe-race a concurrent page-1 refresh. Instead,
       * `useTransactionSearch` resets to page 1 the moment a mutation starts;
       * the args change + `refetchOnMountOrArgChange` produce one clean,
       * authoritative page-1 REPLACE — the legacy post-mutation behavior.
       */
      invalidatesTags: (_r, _e, tx) => {
        const fromArgs =
          tx.month != null && tx.year != null
            ? [{ year: tx.year, month: tx.month }]
            : [];
        return [
          ...monthTags("Budgets", [...fromArgs, monthOfDate(tx.date)]),
          ...monthTags("Summary", [...fromArgs, monthOfDate(tx.date)]),
          { type: "Recurring", id: "all" },
        ];
      },
    }),

    updateTransaction: build.mutation<
      ITransactionResponse<ITransaction>,
      {
        id: string;
        updates: Partial<ITransaction>;
        /** Months whose cached lists may be affected (old and/or new month). */
        invalidateMonths?: MonthKey[];
      }
    >({
      queryFn: async ({ id, updates }) => {
        try {
          const response = await transactionAPI.update(id, updates);
          if (response?.data?.transaction) {
            const t = response.data.transaction as any;
            t.budgetId = t.budgetId ?? t.budget?.id ?? null;
          }
          return { data: response };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      invalidatesTags: (_r, _e, arg) => {
        const months = [...(arg.invalidateMonths ?? [])];
        const dateMonth = monthOfDate(arg.updates.date);
        if (dateMonth) months.push(dateMonth);
        // See createTransaction — Transactions refresh is handled by the
        // page-1 reset, not tag invalidation (ghost-row prevention).
        return [
          ...monthTags("Budgets", months),
          ...monthTags("Summary", months),
          { type: "Recurring", id: "all" },
        ];
      },
    }),

    deleteTransaction: build.mutation<
      ITransactionResponse<null>,
      { id: string; invalidateMonths: MonthKey[] }
    >({
      queryFn: async ({ id }) => {
        try {
          const response = await transactionAPI.delete(id);
          return { data: response };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      invalidatesTags: (_r, _e, arg) => {
        // See createTransaction — Transactions refresh is handled by the
        // page-1 reset, not tag invalidation (ghost-row prevention).
        return [
          ...monthTags("Budgets", arg.invalidateMonths ?? []),
          ...monthTags("Summary", arg.invalidateMonths ?? []),
          { type: "Recurring", id: "all" },
        ];
      },
    }),

    createBudget: build.mutation<IApiResponse<IBudget>, IBudgetData>({
      queryFn: async (budgetData) => {
        try {
          const response = await budgetAPI.create(budgetData);
          return { data: response };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      invalidatesTags: (_r, _e, b) => [
        ...monthTags("Budgets", [{ year: b.year, month: b.month }]),
        ...monthTags("Suggestions", [{ year: b.year, month: b.month }]),
      ],
    }),

    updateBudget: build.mutation<
      IApiResponse<IBudget>,
      {
        id: string;
        updates: Partial<IBudget>;
        invalidateMonths?: MonthKey[];
      }
    >({
      queryFn: async ({ id, updates }) => {
        try {
          const response = await budgetAPI.update(id, updates as any);
          return { data: response };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      invalidatesTags: (_r, _e, arg) => [
        ...monthTags("Budgets", arg.invalidateMonths ?? []),
        ...monthTags("Suggestions", arg.invalidateMonths ?? []),
      ],
    }),

    deleteBudget: build.mutation<
      IApiResponse<null>,
      { id: string; invalidateMonths: MonthKey[] }
    >({
      queryFn: async ({ id }) => {
        try {
          const response = await budgetAPI.delete(id);
          return { data: response };
        } catch (e: any) {
          return { error: toError(e) };
        }
      },
      invalidatesTags: (_r, _e, arg) => [
        ...monthTags("Budgets", arg.invalidateMonths ?? []),
        ...monthTags("Suggestions", arg.invalidateMonths ?? []),
      ],
    }),
  }),
});

export const {
  useGetTransactionsQuery,
  useGetBudgetsQuery,
  useGetFinancialSummaryQuery,
  useGetMonthlyInsightQuery,
  useLazyGetMonthlyInsightQuery,
  useGetBudgetSuggestionsQuery,
  useApplyBudgetSuggestionsMutation,
  useGetRecurringPaymentsQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useCreateBudgetMutation,
  useUpdateBudgetMutation,
  useDeleteBudgetMutation,
} = api;

/** Default (unfiltered, page-1) query args for the selected calendar month. */
export const defaultTransactionArgs = (
  month: number,
  year: number,
  limit: number = PAGINATION_LIMIT,
): GetTransactionsArgs => ({
  currentMonth: month,
  currentYear: year,
  searchQuery: "",
  page: 1,
  limit,
});

export default api;
