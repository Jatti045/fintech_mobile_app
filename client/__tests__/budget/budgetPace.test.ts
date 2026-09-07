/**
 * Unit tests for the pure `budgetPace` calculation that powers the redesigned
 * BudgetTrendCard status ("On track" / "At risk" / "Over budget" / no limit),
 * percent-used, projection and daily-left values.
 */

/// <reference types="jest" />

import { budgetPace } from "@/utils/budget/budgetCalculations";

const base = {
  limit: 500,
  spent: 0,
  isCurrentMonth: true,
  todayDay: 15,
  totalDays: 30,
};

describe("budgetPace", () => {
  it("is idle for an empty/recently created budget (no limit, no spend)", () => {
    const p = budgetPace({ ...base, limit: 0, spent: 0 });
    expect(p.status).toBe("idle");
    expect(p.pctUsed).toBe(0);
    expect(p.remaining).toBe(0);
  });

  it("is on track when pace is under the even-burn line", () => {
    // 100 spent by day 15 projects 200 — well under the 500 limit.
    const p = budgetPace({ ...base, spent: 100 });
    expect(p.status).toBe("on_track");
    expect(p.pctUsed).toBeCloseTo(0.2);
    expect(p.projectedSpend).toBeCloseTo(200);
    expect(p.remaining).toBe(400);
    // 400 remaining over 16 days left (day 15..30 inclusive).
    expect(p.dailyLeft).toBeCloseTo(25);
  });

  it("is at risk when projected month-end spend exceeds the limit", () => {
    // 300 by day 15 projects 600 > 500.
    const p = budgetPace({ ...base, spent: 300 });
    expect(p.status).toBe("at_risk");
    expect(p.projectedSpend).toBeCloseTo(600);
    expect(p.overspent).toBe(false);
  });

  it("is at risk when already ≥80% used with most of the month remaining", () => {
    // 420/500 = 84% used by day 6 of 30.
    const p = budgetPace({ ...base, spent: 420, todayDay: 6 });
    expect(p.status).toBe("at_risk");
  });

  it("is over when spent exceeds the limit, even mid-month", () => {
    const p = budgetPace({ ...base, spent: 550 });
    expect(p.status).toBe("over");
    expect(p.overspent).toBe(true);
    expect(p.remaining).toBe(0);
  });

  it("is exactly on track at the budget boundary", () => {
    // 500 spent by day 30: fully used but not over; projection == limit.
    const p = budgetPace({ ...base, spent: 500, todayDay: 30 });
    expect(p.status).toBe("on_track");
    expect(p.pctUsed).toBe(1);
    expect(p.dailyLeft).toBeCloseTo(0);
  });

  it("handles few days elapsed (day 1) without dividing by zero", () => {
    const p = budgetPace({ ...base, spent: 10, todayDay: 1 });
    expect(p.projectedSpend).toBeCloseTo(300);
    expect(p.dailyLeft).toBeCloseTo(490 / 30);
    expect(p.status).toBe("on_track");
  });

  it("handles months near completion", () => {
    const p = budgetPace({ ...base, spent: 490, todayDay: 29 });
    // Only 2 days left: pace check dominates — 490/29*30 ≈ 507 > 500.
    expect(p.status).toBe("at_risk");
    expect(p.dailyLeft).toBeCloseTo(10 / 2);
  });

  it("treats a past month as complete: projection equals spent, dailyLeft is null", () => {
    const p = budgetPace({
      ...base,
      spent: 400,
      isCurrentMonth: false,
      totalDays: 30,
    });
    expect(p.projectedSpend).toBe(400);
    expect(p.dailyLeft).toBeNull();
    expect(p.status).toBe("on_track");
  });

  it("flags an overspent past month as over", () => {
    const p = budgetPace({
      ...base,
      spent: 600,
      isCurrentMonth: false,
      totalDays: 30,
    });
    expect(p.status).toBe("over");
  });

  it("clamps todayDay outside the month range", () => {
    const p = budgetPace({ ...base, spent: 100, todayDay: 99 });
    // Clamped to day 30 — the month is effectively complete.
    expect(p.dailyLeft).toBeCloseTo(400);
    expect(p.projectedSpend).toBeCloseTo(100);
  });
});
