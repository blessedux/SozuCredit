/**
 * Client-safe corridor metadata: which fiat corridors exist and which
 * provider serves each. Server-side provider construction lives in the API
 * routes (lib/ramp/config.ts) — this file must stay importable from client
 * components, mirroring the asset-registry-core/asset-registry split.
 */
export interface RampCorridor {
  providerId: "etherfuse"
  /** ISO 3166-1 alpha-2 */
  country: "BR"
  fiatCurrency: "BRL"
  fiatSymbol: string
  /** fractional digits of the fiat minor unit (BRL centavos = 2) */
  fiatDecimals: number
  supportsOnramp: boolean
  supportsOfframp: boolean
}

export const RAMP_CORRIDORS: readonly RampCorridor[] = [
  {
    providerId: "etherfuse",
    country: "BR",
    fiatCurrency: "BRL",
    fiatSymbol: "R$",
    fiatDecimals: 2,
    supportsOnramp: true,
    supportsOfframp: true,
  },
]

export function getCorridor(country: string): RampCorridor | null {
  return RAMP_CORRIDORS.find((c) => c.country === country) ?? null
}
