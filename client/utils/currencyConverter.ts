/**
 * Currency conversion utility using the free exchangerate-api.
 * Caches rates for 1 hour to minimise network calls.
 */

import axios from "axios";

interface RatesCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let ratesCache: RatesCache | null = null;

/**
 * Fetch exchange rates for a given base currency.
 * Uses https://api.exchangerate-api.com/v4/latest/{base} (free, no key required).
 */
async function fetchRates(base: string): Promise<Record<string, number>> {
  // Return cached rates if still fresh and same base
  if (
    ratesCache &&
    ratesCache.base === base &&
    Date.now() - ratesCache.fetchedAt < CACHE_TTL_MS
  ) {
    return ratesCache.rates;
  }

  const url = `https://api.exchangerate-api.com/v4/latest/${base}`;
  const response = await axios.get(url);

  if (!response.data) {
    throw new Error(`Failed to fetch exchange rates: ${response.status}`);
  }

  const data = response.data;
  const rates: Record<string, number> = data.rates;

  ratesCache = { base, rates, fetchedAt: Date.now() };
  return rates;
}

/**
 * Convert an amount from one currency to another.
 *
 * @param amount   – the amount in the source currency
 * @param from     – ISO 4217 code of the source currency  (e.g. "EUR")
 * @param to       – ISO 4217 code of the target currency  (e.g. "USD")
 * @returns the converted amount rounded to 2 decimal places
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return amount;

  const rates = await fetchRates(from);
  const rate = rates[to];

  if (rate === undefined) {
    throw new Error(`Exchange rate not found for ${from} → ${to}`);
  }

  return Math.round(amount * rate * 100) / 100;
}

/**
 * Get the exchange rate between two currencies.
 */
export async function getExchangeRate(
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return 1;

  const rates = await fetchRates(from);
  const rate = rates[to];

  if (rate === undefined) {
    throw new Error(`Exchange rate not found for ${from} → ${to}`);
  }

  return rate;
}

/**
 * Invalidate the rates cache (useful after the user changes their default currency).
 */
export function clearRatesCache(): void {
  ratesCache = null;
}
