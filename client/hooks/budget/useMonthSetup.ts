import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useApplyBudgetSuggestionsMutation,
  useGetBudgetSuggestionsQuery,
} from "@/store/api/apiSlice";
import { useThemedAlert } from "@/utils/themedAlert";
import { hapticSuccess } from "@/utils/haptics";
import type { IBudgetSuggestion } from "@/types/budget/types";

/**
 * An editable, selectable suggestion row — the user may edit the limit and
 * toggle whether the category is applied.
 */
export interface EditableSuggestion extends IBudgetSuggestion {
  /** Raw text input value (validated/parsed on apply). */
  limitInput: string;
  selected: boolean;
}

export interface UseMonthSetupOptions {
  month: number;
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencyCode: string;
}

/**
 * Cohesive orchestrator for the Smart Month Setup flow.
 *
 * Owns fetching suggestions (only while the modal is open), the editable/
 * selectable copy of each row, and the single atomic apply action. The server
 * never trusts the client for ownership or uniqueness — this hook simply
 * submits the user's confirmed choices and reports failures.
 *
 * State resets on every open so a dismissed session never leaks into the next
 * one, and so fresh data (post-apply) is re-suggested authoritatively.
 */
export const useMonthSetup = ({
  month,
  year,
  open,
  onOpenChange,
  currencyCode,
}: UseMonthSetupOptions) => {
  const { showAlert } = useThemedAlert();
  const [edits, setEdits] = useState<EditableSuggestion[]>([]);
  const [applying, setApplying] = useState(false);
  const currentKey = `${year}-${month}`;
  const lastInitializedKeyRef = useRef<string | null>(null);

  const query = useGetBudgetSuggestionsQuery(
    { currentMonth: month, currentYear: year },
    { skip: !open },
  );

  // Populate the editable rows when the modal opens AND authoritative data has
  // arrived for the active month/year. Resets between sessions and when month/year
  // changes so stale edits never leak across months or sessions.
  useEffect(() => {
    if (!open) {
      lastInitializedKeyRef.current = null;
      setEdits([]);
      return;
    }

    // Reset when month or year changes while modal remains open
    if (
      lastInitializedKeyRef.current !== null &&
      lastInitializedKeyRef.current !== currentKey
    ) {
      lastInitializedKeyRef.current = null;
      setEdits([]);
    }

    const isCurrentMonthData = Boolean(
      query.data && query.data.month === month && query.data.year === year,
    );
    if (isCurrentMonthData && lastInitializedKeyRef.current !== currentKey) {
      const data = query.data?.suggestions;
      if (!data) return;
      lastInitializedKeyRef.current = currentKey;
      setEdits(
        data.map((s) => ({
          ...s,
          limitInput: String(s.suggestedLimit),
          selected: true,
        })),
      );
    }
  }, [open, currentKey, month, year, query.data]);

  const [applyMutation] = useApplyBudgetSuggestionsMutation();

  const isCurrentMonthData = Boolean(
    query.data && query.data.month === month && query.data.year === year,
  );
  const suggestions = isCurrentMonthData
    ? (query.data?.suggestions ?? null)
    : null;
  const error =
    query.error && typeof query.error === "object" && "error" in query.error
      ? String((query.error as any).error)
      : null;
  const isLoading =
    (query.isFetching || (open && !isCurrentMonthData && !error)) &&
    edits.length === 0;
  const isEmpty =
    !isLoading &&
    !error &&
    isCurrentMonthData &&
    suggestions !== null &&
    suggestions.length === 0;

  const setLimit = useCallback((category: string, value: string) => {
    setEdits((prev) =>
      prev.map((e) =>
        e.category === category ? { ...e, limitInput: value } : e,
      ),
    );
  }, []);

  const toggleSelected = useCallback((category: string) => {
    setEdits((prev) =>
      prev.map((e) =>
        e.category === category ? { ...e, selected: !e.selected } : e,
      ),
    );
  }, []);

  const setAllSelected = useCallback((selected: boolean) => {
    setEdits((prev) => prev.map((e) => ({ ...e, selected })));
  }, []);

  const selectedEdits = useMemo(() => edits.filter((e) => e.selected), [edits]);
  const selectedCount = selectedEdits.length;
  const allSelected = edits.length > 0 && selectedCount === edits.length;

  /** Applies only selected rows with a positive, valid limit. */
  const apply = useCallback(async () => {
    if (applying) return;
    const items = selectedEdits
      .map((e) => {
        const numeric = Number(e.limitInput.replace(/[^0-9.]/g, ""));
        return {
          category: e.category,
          limit: Number.isFinite(numeric) ? numeric : 0,
        };
      })
      .filter((i) => i.limit > 0 && i.category.trim().length > 0);

    if (items.length === 0) {
      showAlert({
        title: "Nothing to apply",
        message: "Select at least one budget with a limit greater than zero.",
      });
      return;
    }

    setApplying(true);
    try {
      const result: any = await applyMutation({ month, year, items });
      if (!result.error && result.data?.success) {
        hapticSuccess();
        onOpenChange(false);
        return;
      }
      showAlert({
        title: "Could not apply budgets",
        message:
          result.data?.message ??
          result.error?.error ??
          "Something went wrong. Please try again.",
      });
    } catch (err: any) {
      showAlert({
        title: "Error",
        message: err?.message || "Failed to apply budgets",
      });
    } finally {
      setApplying(false);
    }
  }, [
    applying,
    selectedEdits,
    applyMutation,
    month,
    year,
    onOpenChange,
    showAlert,
  ]);

  return {
    suggestions,
    edits,
    isLoading,
    error,
    isEmpty,
    applying,
    selectedCount,
    allSelected,
    currencyCode,
    refetch: query.refetch,
    setLimit,
    toggleSelected,
    setAllSelected,
    apply,
  };
};

export default useMonthSetup;
