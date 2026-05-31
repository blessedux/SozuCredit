import {
  isClassicStellarAddress,
  isContractStellarAddress,
  isValidStellarReceiveAddress,
} from "@/lib/payment/stellar-address"

export type PaymentRail = "smart" | "legacy"

export const LEGACY_CLASSIC_PAYMENT_NOTICE =
  "Classic Stellar account (G…). Using legacy USDC payment. Smart accounts (C…) are the default."

export function paymentRailForAddress(address: string): PaymentRail | null {
  const t = address.trim().toUpperCase()
  if (!isValidStellarReceiveAddress(t)) return null
  if (isContractStellarAddress(t)) return "smart"
  if (isClassicStellarAddress(t)) return "legacy"
  return null
}

export function isSmartPaymentDestination(address: string): boolean {
  return paymentRailForAddress(address) === "smart"
}

export function isLegacyPaymentDestination(address: string): boolean {
  return paymentRailForAddress(address) === "legacy"
}

export function recipientResolveErrorMessage(apiError: string | undefined): string {
  if (!apiError) return "Could not resolve recipient. Please try again."
  if (apiError.includes("Recipient wallet not found")) {
    return "Recipient has a Sozu tag but no smart wallet on file yet. They may need to finish setup in SozuPay or Sozu Credit."
  }
  if (apiError.includes("Recipient not found") || apiError.toLowerCase().includes("not found")) {
    return "Sozu tag not found. Check spelling or paste a C… or G… address."
  }
  return apiError
}
