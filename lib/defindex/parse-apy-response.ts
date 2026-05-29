/** Parse `/api/wallet/defindex/apy` JSON — accepts success and fallback payloads. */
export function parseApyFromApiResponse(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null
  const body = payload as Record<string, unknown>
  const apy = body.apy

  if (apy && typeof apy === "object") {
    const nested = apy as Record<string, unknown>
    if (typeof nested.precise === "number" && Number.isFinite(nested.precise) && nested.precise > 0) {
      return nested.precise
    }
    const primary = Number(nested.primary)
    if (Number.isFinite(primary) && primary > 0) return primary

    const periods = nested.periods
    if (periods && typeof periods === "object") {
      const yearly = Number((periods as Record<string, unknown>).yearly)
      if (Number.isFinite(yearly) && yearly > 0) return yearly
    }
  }

  const direct = Number(apy)
  if (Number.isFinite(direct) && direct > 0) return direct

  return null
}
