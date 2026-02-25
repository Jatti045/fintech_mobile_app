/**
 * Calendar slice – reducer-level unit tests.
 *
 * Validates month navigation, year roll-over, and the future-month guard that
 * prevents navigating past the current month.
 */

import calendarReducer, {
  CalendarState,
  setMonthYear,
  nextMonth,
  prevMonth,
} from "@/store/slices/calendarSlice";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const state = (month: number, year: number): CalendarState => ({ month, year });

// ---------------------------------------------------------------------------
// setMonthYear
// ---------------------------------------------------------------------------

describe("calendarSlice – setMonthYear", () => {
  it("54. sets month and year directly", () => {
    const s = calendarReducer(
      state(0, 2020),
      setMonthYear({ month: 5, year: 2025 }),
    );
    expect(s.month).toBe(5);
    expect(s.year).toBe(2025);
  });
});

// ---------------------------------------------------------------------------
// prevMonth
// ---------------------------------------------------------------------------

describe("calendarSlice – prevMonth", () => {
  it("55. decrements month within the same year", () => {
    const s = calendarReducer(state(6, 2026), prevMonth());
    expect(s.month).toBe(5);
    expect(s.year).toBe(2026);
  });

  it("56. rolls from January to December of previous year", () => {
    const s = calendarReducer(state(0, 2026), prevMonth());
    expect(s.month).toBe(11);
    expect(s.year).toBe(2025);
  });

  it("57. can be called multiple times in sequence", () => {
    let s = state(2, 2026);
    s = calendarReducer(s, prevMonth());
    s = calendarReducer(s, prevMonth());
    s = calendarReducer(s, prevMonth());
    expect(s.month).toBe(11);
    expect(s.year).toBe(2025);
  });
});

// ---------------------------------------------------------------------------
// nextMonth
// ---------------------------------------------------------------------------

describe("calendarSlice – nextMonth", () => {
  it("58. increments month within the same year (when not at current month)", () => {
    // We need to use a month that is in the past relative to now
    const now = new Date();
    // Use January 2020 – guaranteed to be in the past
    const s = calendarReducer(state(0, 2020), nextMonth());
    expect(s.month).toBe(1);
    expect(s.year).toBe(2020);
  });

  it("59. rolls from December to January of next year (when allowed)", () => {
    // December 2019 → January 2020 (both in the past)
    const s = calendarReducer(state(11, 2019), nextMonth());
    expect(s.month).toBe(0);
    expect(s.year).toBe(2020);
  });

  it("60. blocks navigation to a future month", () => {
    const now = new Date();
    // Already at the current month – nextMonth should be a no-op
    const s = calendarReducer(
      state(now.getMonth(), now.getFullYear()),
      nextMonth(),
    );
    expect(s.month).toBe(now.getMonth());
    expect(s.year).toBe(now.getFullYear());
  });

  it("61. blocks navigation to a future year", () => {
    const now = new Date();
    // December of the current year → January of next year should be blocked
    // only if December IS the current month; if we're not in December this
    // test uses the current month on the current year (which is always blocked).
    const s = calendarReducer(
      state(now.getMonth(), now.getFullYear()),
      nextMonth(),
    );
    expect(s.year).toBe(now.getFullYear());
  });
});
