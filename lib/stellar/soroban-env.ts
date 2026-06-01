import "server-only"

import { isOzSmartAccountConfigured } from "@/lib/stellar/smartAccounts/ozConfig"

export function resolveSorobanRpcUrl(): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    "https://soroban-testnet.stellar.org"
  )
}

export function isFactorySmartAccountConfigured(): boolean {
  return Boolean(
    process.env.SMART_ACCOUNT_FACTORY_ID?.trim() &&
      resolveSorobanRpcUrl() &&
      process.env.STELLAR_FUNDER_SECRET?.trim(),
  )
}

export function isSmartWalletProvisioningConfigured(): boolean {
  return isFactorySmartAccountConfigured() || isOzSmartAccountConfigured()
}

export function describeMissingSmartWalletEnv(): string {
  const missing: string[] = []
  if (!resolveSorobanRpcUrl()) missing.push("SOROBAN_RPC_URL")
  if (!process.env.STELLAR_FUNDER_SECRET?.trim()) missing.push("STELLAR_FUNDER_SECRET")
  if (!isFactorySmartAccountConfigured() && !isOzSmartAccountConfigured()) {
    missing.push(
      "SMART_ACCOUNT_FACTORY_ID (factory) or OZ_SMART_ACCOUNT_WASM_HASH_TESTNET + OZ_WEBAUTHN_VERIFIER_CONTRACT_ID_TESTNET + OZ_THRESHOLD_POLICY_CONTRACT_ID_TESTNET (passkey)",
    )
  }
  return missing.length
    ? `Missing in .env.local: ${missing.join(", ")}`
    : ""
}
