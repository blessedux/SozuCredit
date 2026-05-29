import type { ReferenceFiat } from "@/lib/treasury/types"
import { getFxSpotRate } from "@/lib/treasury/mock-rates"

export type SendAmountCurrency = "fiat" | "usdc"

export function fiatDecimals(fiat: ReferenceFiat): number {
  return fiat === "CLP" || fiat === "ARS" || fiat === "COP" ? 0 : 2
}

export function usdcFromInputAmount(
  amount: number,
  inputCurrency: SendAmountCurrency,
  referenceFiat: ReferenceFiat,
): number {
  if (inputCurrency === "usdc") return amount
  const spot = getFxSpotRate(referenceFiat)
  if (spot <= 0) return amount
  return amount / spot
}

export function fiatFromUsdcAmount(
  usdcAmount: number,
  referenceFiat: ReferenceFiat,
): number {
  return usdcAmount * getFxSpotRate(referenceFiat)
}

export function formatSendInputAmount(
  value: number,
  inputCurrency: SendAmountCurrency,
  referenceFiat: ReferenceFiat,
): string {
  if (inputCurrency === "usdc") {
    return value.toFixed(2)
  }
  const decimals = fiatDecimals(referenceFiat)
  return value.toFixed(decimals)
}

export function convertAmountForCurrencySwitch(
  amount: number,
  from: SendAmountCurrency,
  to: SendAmountCurrency,
  referenceFiat: ReferenceFiat,
): string {
  if (from === to) return formatSendInputAmount(amount, from, referenceFiat)
  const usdc =
    from === "usdc" ? amount : usdcFromInputAmount(amount, "fiat", referenceFiat)
  const next =
    to === "usdc" ? usdc : fiatFromUsdcAmount(usdc, referenceFiat)
  return formatSendInputAmount(next, to, referenceFiat)
}

export function defaultSendAmountCurrency(_referenceFiat: ReferenceFiat): SendAmountCurrency {
  return "fiat"
}
