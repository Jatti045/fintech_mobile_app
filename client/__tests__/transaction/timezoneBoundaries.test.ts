import { monthOfDate } from "@/store/api/apiSlice";
import { buildDailySpendTotals } from "@/utils/transaction/helpers";
import { buildMonthSpendSeries, daysInMonth } from "@/utils/budget/budgetCalculations";
import { toUtcDateString } from "@/hooks/transaction/useTransactionFilters";

describe("Timezone and Month Boundary Handling", () => {
  describe("monthOfDate", () => {
    it("assigns 23:59:59 on the last day of month to the current month in UTC", () => {
      const result = monthOfDate("2026-03-31T23:59:59.999Z");
      expect(result).toEqual({ year: 2026, month: 2 });
    });

    it("assigns 00:00:00 on the first day of next month to the new month in UTC", () => {
      const result = monthOfDate("2026-04-01T00:00:00.000Z");
      expect(result).toEqual({ year: 2026, month: 3 });
    });

    it("handles positive timezone offset strings by resolving to UTC", () => {
      // 2026-04-01 02:00 at +05:00 is 2026-03-31 21:00 UTC -> March (month 2)
      const result = monthOfDate("2026-04-01T02:00:00+05:00");
      expect(result).toEqual({ year: 2026, month: 2 });
    });

    it("handles negative timezone offset strings by resolving to UTC", () => {
      // 2026-03-31 22:00 at -05:00 is 2026-04-01 03:00 UTC -> April (month 3)
      const result = monthOfDate("2026-03-31T22:00:00-05:00");
      expect(result).toEqual({ year: 2026, month: 3 });
    });

    it("returns null for null, undefined, or invalid date strings", () => {
      expect(monthOfDate(null)).toBeNull();
      expect(monthOfDate(undefined)).toBeNull();
      expect(monthOfDate("not-a-date")).toBeNull();
    });
  });

  describe("buildDailySpendTotals", () => {
    const transactions = [
      {
        id: "tx-1",
        date: "2026-03-31T23:59:59Z",
        amount: 50.0,
        type: "EXPENSE",
      },
      {
        id: "tx-2",
        date: "2026-04-01T00:00:00Z",
        amount: 25.0,
        type: "EXPENSE",
      },
      {
        id: "tx-3",
        date: "2026-03-31T23:30:00Z",
        amount: 100.0,
        type: "EXPENSE",
        isTransfer: true, // Should be excluded
      },
      {
        id: "tx-4",
        date: "2026-03-31T12:00:00Z",
        amount: 75.0,
        type: "INCOME", // Should be excluded
      },
    ];

    it("groups March transactions into day 31 and excludes April transactions", () => {
      const marchSeries = buildDailySpendTotals(transactions, 2, 2026);
      expect(marchSeries).toHaveLength(31);
      const day31 = marchSeries.find((p: { day: number; total: number }) => p.day === 31);
      expect(day31?.total).toBe(50.0);
    });

    it("groups April transactions into day 1 and excludes March transactions", () => {
      const aprilSeries = buildDailySpendTotals(transactions, 3, 2026);
      expect(aprilSeries).toHaveLength(30);
      const day1 = aprilSeries.find((p: { day: number; total: number }) => p.day === 1);
      expect(day1?.total).toBe(25.0);
    });
  });

  describe("buildMonthSpendSeries", () => {
    it("accumulates daily spend into cumulative points without leaking across month boundaries", () => {
      const txs = [
        {
          date: "2026-03-31T23:59:59Z",
          amount: 40.0,
          category: "Groceries",
        },
        {
          date: "2026-04-01T00:00:01Z",
          amount: 60.0,
          category: "Groceries",
        },
      ];

      const marchPoints = buildMonthSpendSeries(txs, {
        category: "Groceries",
        month: 2,
        year: 2026,
      });
      expect(marchPoints).toHaveLength(31);
      expect(marchPoints[30].cumulative).toBe(40.0);

      const aprilPoints = buildMonthSpendSeries(txs, {
        category: "Groceries",
        month: 3,
        year: 2026,
      });
      expect(aprilPoints).toHaveLength(30);
      expect(aprilPoints[0].cumulative).toBe(60.0);
    });
  });

  describe("daysInMonth", () => {
    it("calculates correct days in leap year vs non-leap year", () => {
      expect(daysInMonth(1, 2024)).toBe(29); // Feb 2024 leap
      expect(daysInMonth(1, 2026)).toBe(28); // Feb 2026 non-leap
      expect(daysInMonth(2, 2026)).toBe(31); // Mar 2026
      expect(daysInMonth(3, 2026)).toBe(30); // Apr 2026
    });
  });

  describe("toUtcDateString", () => {
    it("formats dates using UTC weekday, month, day, year regardless of local timezone", () => {
      expect(toUtcDateString("2026-03-31T23:59:59Z")).toBe("Tue Mar 31 2026");
      expect(toUtcDateString("2026-04-01T00:00:00Z")).toBe("Wed Apr 01 2026");
      expect(toUtcDateString("2026-01-01T00:00:00Z")).toBe("Thu Jan 01 2026");
      expect(toUtcDateString("invalid")).toBe("Unknown Date");
    });
  });
});
