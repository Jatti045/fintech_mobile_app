import AsyncStorage from "@react-native-async-storage/async-storage";

// Helper: try to read stored user id from AsyncStorage
async function getStoredUserId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem("userData");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id ?? null;
  } catch (e) {
    console.warn("getStoredUserId: failed to read userData", e);
    return null;
  }
}

// Key format is transactions:<userId>:<year>-<monthIndex>
// Note: monthIndex is JavaScript month index (0-11) to match Date.getMonth().
const txKey = (userId: string, year: number, month: number) =>
  `transactions:${userId}:${year}-${month}`;
const budgetKey = (userId: string, year: number, month: number) =>
  `budgets:${userId}:${year}-${month}`;

// Cache wrapper to allow future TTL/staleness checks.
type CacheWrapper = { ts: number; data: any };

function wrap(data: any): string {
  return JSON.stringify({ ts: Date.now(), data });
}

function unwrap(raw: string | null): any | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      return parsed.data;
    }
    // Backwards compatibility: raw was previously stored as the array/object
    return parsed;
  } catch (e) {
    console.warn("unwrap: failed to parse cached value", e);
    return null;
  }
}

export async function getTransactionsCache(
  year: number,
  month: number,
  userId?: string
) {
  try {
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return null;
    const raw = await AsyncStorage.getItem(txKey(uid, year, month));
    return unwrap(raw);
  } catch (e) {
    console.warn("getTransactionsCache: error reading cache", e);
    return null;
  }
}

export async function setTransactionsCache(
  year: number,
  month: number,
  arr: any[],
  userId?: string
) {
  try {
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return;
    await AsyncStorage.setItem(txKey(uid, year, month), wrap(arr));
  } catch (e) {
    console.warn("setTransactionsCache: failed to write cache", e);
  }
}

export async function appendTransactionToCache(tx: any, userId?: string) {
  try {
    const d = tx?.date ? new Date(tx.date) : new Date();
    const month = tx?.month ?? d.getMonth();
    const year = tx?.year ?? d.getFullYear();
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return;
    const key = txKey(uid, year, month);
    const raw = await AsyncStorage.getItem(key);
    const arr = unwrap(raw) ?? [];
    arr.push(tx);
    await AsyncStorage.setItem(key, wrap(arr));
  } catch (e) {
    console.warn("appendTransactionToCache: failed", e);
  }
}

export async function removeTransactionFromCacheById(
  id: string,
  year?: number,
  month?: number,
  userId?: string
) {
  try {
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return;

    if (year !== undefined && month !== undefined) {
      const key = txKey(uid, year, month);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const arr = (unwrap(raw) ?? []).filter((t: any) => t.id !== id);
      await AsyncStorage.setItem(key, wrap(arr));
      return;
    }

    // Best-effort: try current and previous month
    const now = new Date();
    const candidates = [
      txKey(uid, now.getFullYear(), now.getMonth()),
      txKey(uid, now.getFullYear(), Math.max(0, now.getMonth() - 1)),
    ];
    for (const key of candidates) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const arr = (unwrap(raw) ?? []).filter((t: any) => t.id !== id);
        await AsyncStorage.setItem(key, wrap(arr));
      } catch (e) {
        console.warn(
          "removeTransactionFromCacheById: error processing key",
          key,
          e
        );
      }
    }
  } catch (e) {
    console.warn("removeTransactionFromCacheById: unexpected error", e);
  }
}

// Remove a transaction id from ALL cached months for the user (best-effort)
export async function removeTransactionFromCacheByIdAcrossAllMonths(
  id: string,
  userId?: string
) {
  try {
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return;
    const keys = await AsyncStorage.getAllKeys();
    const txKeys = keys.filter((k) => k.startsWith(`transactions:${uid}:`));
    for (const key of txKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const arr = (unwrap(raw) ?? []).filter((t: any) => t.id !== id);
        if (arr.length === 0) {
          await AsyncStorage.removeItem(key);
        } else {
          await AsyncStorage.setItem(key, wrap(arr));
        }
      } catch (e) {
        console.warn(
          "removeTransactionFromCacheByIdAcrossAllMonths: failed for key",
          key,
          e
        );
      }
    }
  } catch (e) {
    console.warn(
      "removeTransactionFromCacheByIdAcrossAllMonths: unexpected error",
      e
    );
  }
}

export async function getBudgetsCache(
  year: number,
  month: number,
  userId?: string
) {
  try {
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return null;
    const raw = await AsyncStorage.getItem(budgetKey(uid, year, month));
    return unwrap(raw);
  } catch (e) {
    console.warn("getBudgetsCache: error reading cache", e);
    return null;
  }
}

export async function setBudgetsCache(
  year: number,
  month: number,
  arr: any[],
  userId?: string
) {
  try {
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return;
    await AsyncStorage.setItem(budgetKey(uid, year, month), wrap(arr));
  } catch (e) {
    console.warn("setBudgetsCache: failed to write cache", e);
  }
}

export async function appendBudgetToCache(
  b: any,
  year?: number,
  month?: number,
  userId?: string
) {
  try {
    const monthIndex =
      month !== undefined && year !== undefined
        ? month
        : (b?.month ??
          (b?.createdAt
            ? new Date(b.createdAt).getMonth()
            : new Date().getMonth()));
    const yearIndex =
      month !== undefined && year !== undefined
        ? year
        : (b?.year ??
          (b?.createdAt
            ? new Date(b.createdAt).getFullYear()
            : new Date().getFullYear()));
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return;
    const key = budgetKey(uid, yearIndex, monthIndex);
    const raw = await AsyncStorage.getItem(key);
    const arr = unwrap(raw) ?? [];
    arr.push(b);
    await AsyncStorage.setItem(key, wrap(arr));
  } catch (e) {
    console.warn("appendBudgetToCache: failed", e);
  }
}

export async function removeBudgetFromCacheById(
  id: string,
  year?: number,
  month?: number,
  userId?: string
) {
  try {
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return;

    if (year !== undefined && month !== undefined) {
      const key = budgetKey(uid, year, month);
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return;
      const arr = (unwrap(raw) ?? []).filter((b: any) => b.id !== id);
      await AsyncStorage.setItem(key, wrap(arr));
      return;
    }

    const now = new Date();
    const candidates = [
      budgetKey(uid, now.getFullYear(), now.getMonth()),
      budgetKey(uid, now.getFullYear(), Math.max(0, now.getMonth() - 1)),
    ];
    for (const key of candidates) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const arr = (unwrap(raw) ?? []).filter((b: any) => b.id !== id);
        await AsyncStorage.setItem(key, wrap(arr));
      } catch (e) {
        console.warn("removeBudgetFromCacheById: error for key", key, e);
      }
    }
  } catch (e) {
    console.warn("removeBudgetFromCacheById: unexpected error", e);
  }
}

// Remove a budget id from ALL cached months for the user (best-effort)
export async function removeBudgetFromCacheByIdAcrossAllMonths(
  id: string,
  userId?: string
) {
  try {
    const uid = userId ?? (await getStoredUserId());
    if (!uid) return;
    const keys = await AsyncStorage.getAllKeys();
    const bKeys = keys.filter((k) => k.startsWith(`budgets:${uid}:`));
    for (const key of bKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const arr = (unwrap(raw) ?? []).filter((b: any) => b.id !== id);
        if (arr.length === 0) {
          await AsyncStorage.removeItem(key);
        } else {
          await AsyncStorage.setItem(key, wrap(arr));
        }
      } catch (e) {
        console.warn(
          "removeBudgetFromCacheByIdAcrossAllMonths: failed for key",
          key,
          e
        );
      }
    }
  } catch (e) {
    console.warn(
      "removeBudgetFromCacheByIdAcrossAllMonths: unexpected error",
      e
    );
  }
}
