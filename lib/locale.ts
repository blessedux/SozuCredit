/**
 * Shared app locale helpers for Sozu Wallet.
 *
 * Supported UI languages today: `en` | `es`.
 * Portuguese (`pt`) is reserved — see GitHub #32.
 */

export type AppLanguage = "en" | "es"

export const APP_LANGUAGE_STORAGE_KEY = "sozu_app_language:v2"
/** Legacy key some surfaces still read during migration. */
export const APP_LANGUAGE_STORAGE_KEY_LEGACY = "sozu_app_language:v1"

export const SUPPORTED_APP_LANGUAGES: readonly AppLanguage[] = ["en", "es"] as const

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === "en" || value === "es"
}

/**
 * Map a BCP-47 tag to a supported UI language.
 * `pt*` intentionally falls back to `en` until Portuguese ships (#32).
 */
export function mapBrowserTagToAppLanguage(tag: string): AppLanguage | null {
  const normalized = tag.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.startsWith("es")) return "es"
  if (normalized.startsWith("en")) return "en"
  if (normalized.startsWith("pt")) return "en"
  return null
}

/** Detect preferred language from the browser; default English when unknown. */
export function detectBrowserLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return "en"
  try {
    const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean)
    for (const tag of candidates) {
      const mapped = mapBrowserTagToAppLanguage(tag)
      if (mapped) return mapped
    }
  } catch {
    // ignore
  }
  return "en"
}

/** Read persisted preference, else browser detection. SSR-safe. */
export function resolveAppLanguage(): AppLanguage {
  if (typeof window === "undefined") return "en"
  try {
    const stored =
      localStorage.getItem(APP_LANGUAGE_STORAGE_KEY) ??
      localStorage.getItem(APP_LANGUAGE_STORAGE_KEY_LEGACY)
    if (isAppLanguage(stored)) return stored
  } catch {
    // private browsing / quota
  }
  return detectBrowserLanguage()
}

export function persistAppLanguage(lang: AppLanguage): void {
  try {
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, lang)
  } catch {
    // private browsing / quota
  }
}
