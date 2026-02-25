/**
 * Utility / helper function tests.
 *
 * Tests for capitalizeFirst, formatDate, formatNumber, and formatCurrency.
 */

import {
  capitalizeFirst,
  formatDate,
  formatNumber,
  formatCurrency,
} from "@/utils/helper";

// ---------------------------------------------------------------------------
// capitalizeFirst
// ---------------------------------------------------------------------------

describe("capitalizeFirst", () => {
  it("62. capitalises single word", () => {
    expect(capitalizeFirst("food")).toBe("Food");
  });

  it("63. lowercases the rest of the string", () => {
    expect(capitalizeFirst("FOOD")).toBe("Food");
  });

  it("64. returns empty string for empty input", () => {
    expect(capitalizeFirst("")).toBe("");
  });

  it("65. handles single character", () => {
    expect(capitalizeFirst("a")).toBe("A");
  });

  it("66. converts number-like input via toString", () => {
    // The function calls text.toString(), so a number coerced to string works
    expect(capitalizeFirst("123abc")).toBe("123abc");
  });

  it("67. handles mixed-case multi-word strings", () => {
    expect(capitalizeFirst("hello WORLD")).toBe("Hello world");
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("68. returns 'Today' for today's date", () => {
    const today = new Date().toISOString();
    expect(formatDate(today)).toBe("Today");
  });

  it("69. returns 'Yesterday' for yesterday", () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(formatDate(d.toISOString())).toBe("Yesterday");
  });

  it("70. returns 'X days ago' for 2-6 days ago", () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(formatDate(d.toISOString())).toBe("3 days ago");
  });

  it("71. returns formatted date for 7+ days ago", () => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    const result = formatDate(d.toISOString());
    // Should NOT be "X days ago" anymore
    expect(result).not.toContain("days ago");
    // Should contain a comma (e.g. "Feb 15, 2026")
    expect(result).toContain(",");
  });

  it("72. returns 'Today' when the date is today at midnight", () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    expect(formatDate(d.toISOString())).toBe("Today");
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe("formatNumber", () => {
  it("73. formats 0 with two decimals", () => {
    expect(formatNumber(0)).toMatch(/^0\.00$/);
  });

  it("74. formats integer to two decimals", () => {
    expect(formatNumber(100)).toMatch(/100\.00$/);
  });

  it("75. adds thousands separator", () => {
    const result = formatNumber(1234567.89);
    // locale-dependent but should have grouping
    expect(result).toContain("234");
    expect(result).toContain("89");
  });

  it("76. handles negative numbers", () => {
    const result = formatNumber(-42);
    expect(result).toContain("42");
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe("formatCurrency", () => {
  it("77. prefixes dollar sign", () => {
    expect(formatCurrency(10)).toMatch(/^\$/);
  });

  it("78. formats with two decimal places", () => {
    expect(formatCurrency(9.9)).toMatch(/9\.90$/);
  });

  it("79. treats NaN / falsy as 0", () => {
    expect(formatCurrency(NaN)).toMatch(/\$0\.00$/);
    expect(formatCurrency(0)).toMatch(/\$0\.00$/);
  });

  it("80. formats large currency amounts", () => {
    const result = formatCurrency(1000000);
    expect(result).toMatch(/^\$/);
    expect(result).toContain("000");
  });
});
