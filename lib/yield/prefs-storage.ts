/**
 * Yield Preferences Storage
 *
 * Persists user yield preferences in localStorage using the same versioned
 * key pattern as lib/treasury/prefs-storage.ts.
 *
 * Key: sozu_yield_prefs:v1
 */

import type { StrategyId } from "@/lib/defindex/strategy-catalog"

export interface YieldPrefs {
  strategy: StrategyId
  /** Automatically move new USDC inflows to the selected strategy. */
  autoEarn: boolean
}

const STORAGE_KEY = "sozu_yield_prefs:v1"

const DEFAULT_PREFS: YieldPrefs = {
  strategy: "fixed",
  autoEarn: false,
}

export function loadYieldPrefs(): YieldPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<YieldPrefs>
    return {
      strategy:
        parsed.strategy === "yieldblox" || parsed.strategy === "fixed"
          ? parsed.strategy
          : DEFAULT_PREFS.strategy,
      autoEarn: typeof parsed.autoEarn === "boolean" ? parsed.autoEarn : DEFAULT_PREFS.autoEarn,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function saveYieldPrefs(prefs: YieldPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage unavailable (SSR, incognito quota)
  }
}

export function updateYieldPrefs(patch: Partial<YieldPrefs>): YieldPrefs {
  const current = loadYieldPrefs()
  const updated = { ...current, ...patch }
  saveYieldPrefs(updated)
  return updated
}

export function clearYieldPrefs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
