/**
 * MVP FX via Frankfurter (ECB). USDC is approximated as USD.
 */
export async function fetchFxRateToUsd(fromCurrency: string): Promise<{ rate: number; source: string }> {
  const from = fromCurrency.toUpperCase()
  if (from === "USD" || from === "USDC") {
    return { rate: 1, source: "identity" }
  }

  const url = `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/USD`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) {
    throw new Error(`FX upstream ${res.status}`)
  }
  const data = (await res.json()) as { rate?: number; message?: string }
  const r = data.rate
  if (typeof r !== "number") {
    throw new Error(data.message ?? "FX parse error")
  }
  return { rate: r, source: "frankfurter.dev" }
}
