import { isAllowedPayReturnTo } from "./pay-return"

/** Backup if the PWA opens /home and drops /auth?return_to=. */
const KEY = "sozu_pizza_hop_return_v1"

type HopStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function defaultStore(): HopStore | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function stashPizzaHopReturn(returnTo: string, store: HopStore | null = defaultStore()): void {
  if (!store || !isAllowedPayReturnTo(returnTo)) return
  try {
    store.setItem(KEY, returnTo.trim())
  } catch {
    /* private browsing */
  }
}

export function peekPizzaHopReturn(store: HopStore | null = defaultStore()): string | null {
  if (!store) return null
  try {
    const raw = store.getItem(KEY)?.trim() ?? ""
    return raw && isAllowedPayReturnTo(raw) ? raw : null
  } catch {
    return null
  }
}

export function clearPizzaHopReturn(store: HopStore | null = defaultStore()): void {
  if (!store) return
  try {
    store.removeItem(KEY)
  } catch {
    /* private browsing */
  }
}
