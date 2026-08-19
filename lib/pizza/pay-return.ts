import { pizzaHopFlag } from "@/lib/stellar/pizza-token"

export function getSozuPayOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SOZUPAY_URL?.replace(/\/$/, "") ||
    "https://pay.sozu.capital"
  )
}

export function isAllowedPayReturnTo(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (!url.pathname.startsWith("/pay/")) return false
    const host = url.hostname
    if (host === "pay.sozu.capital") return url.protocol === "https:"
    if (host === "localhost" || host === "127.0.0.1") {
      return url.protocol === "http:" || url.protocol === "https:"
    }
    return false
  } catch {
    return false
  }
}

export function appendPizzaHopParams(
  returnTo: string,
  guestAddress: string,
  pizzaBalance: number | null,
): string {
  const url = new URL(returnTo)
  url.searchParams.set("guest", guestAddress.trim().toUpperCase())
  url.searchParams.set("pizza", pizzaHopFlag(pizzaBalance))
  if (url.searchParams.get("hopped") !== "1") {
    url.searchParams.set("hopped", "1")
  }
  return url.toString()
}

export type PizzaAuthContinuation =
  | { kind: "none" }
  | { kind: "hop"; returnTo: string }
  | { kind: "intent"; intentId: string; returnTo: string | null }

export function resolvePizzaAuthSearch(search: {
  get: (key: string) => string | null
}): PizzaAuthContinuation {
  const intentId = search.get("intent")?.trim() ?? ""
  const returnToRaw = search.get("return_to")?.trim() ?? ""
  const returnTo = returnToRaw && isAllowedPayReturnTo(returnToRaw) ? returnToRaw : null

  if (intentId && /^[a-zA-Z0-9_-]{8,128}$/.test(intentId)) {
    return { kind: "intent", intentId, returnTo }
  }
  if (returnTo) return { kind: "hop", returnTo }
  return { kind: "none" }
}
