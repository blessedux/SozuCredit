/**
 * Versioned localStorage read/write for treasury preferences.
 *
 * Key: sozu_treasury_prefs:v1
 * Always wrapped in try/catch — localStorage throws in incognito/private
 * browsing (Safari, Firefox), when quota exceeded, or when disabled.
 *
 * Phase 2: persist to Supabase wallet_preferences table for cross-device sync.
 */

import type { TreasuryPrefs } from "./types"
import { TREASURY_PREFS_DEFAULTS } from "./types"

const KEY = "sozu_treasury_prefs:v1"
const LEGACY_KEY = "sozu_treasury_prefs:v0"

export function loadTreasuryPrefs(): TreasuryPrefs {
  if (typeof window === "undefined") return { ...TREASURY_PREFS_DEFAULTS }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TreasuryPrefs>
      return {
        referenceFiat: parsed.referenceFiat ?? TREASURY_PREFS_DEFAULTS.referenceFiat,
        mode: parsed.mode ?? TREASURY_PREFS_DEFAULTS.mode,
        holdingDays: parsed.holdingDays ?? TREASURY_PREFS_DEFAULTS.holdingDays,
      }
    }
    // Migrate from legacy key (pre-v1) if present
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<TreasuryPrefs>
      const migrated: TreasuryPrefs = {
        referenceFiat: old.referenceFiat ?? TREASURY_PREFS_DEFAULTS.referenceFiat,
        mode: old.mode ?? TREASURY_PREFS_DEFAULTS.mode,
        holdingDays: old.holdingDays ?? TREASURY_PREFS_DEFAULTS.holdingDays,
      }
      saveTreasuryPrefs(migrated)
      localStorage.removeItem(LEGACY_KEY)
      return migrated
    }
  } catch {
    // storage unavailable — return defaults
  }
  return { ...TREASURY_PREFS_DEFAULTS }
}

export function saveTreasuryPrefs(prefs: TreasuryPrefs): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
    // Dispatch storage event so other tabs / wallet screen can react
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(prefs) }))
  } catch {
    // storage unavailable — silently fail
  }
}

export function clearTreasuryPrefs(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
