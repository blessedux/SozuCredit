import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { provisionSmartWalletForSigner } from "@/lib/stellar/smart-account-provision"
import {
  describeMissingSmartWalletEnv,
  isFactorySmartAccountConfigured,
} from "@/lib/stellar/soroban-env"

export type CanonicalWalletRow = {
  publicKey: string
  signerPublicKey: string | null
  walletType: "factory" | "oz" | "legacy"
  network: "testnet" | "mainnet"
  migrated: boolean
}

/**
 * Ensures stellar_wallets.public_key is a factory smart account (C…).
 * Legacy G rows are replaced via SMART_ACCOUNT_FACTORY_ID deploy.
 */
export async function ensureFactorySmartWalletForUser(
  userId: string,
  signerHint?: string | null,
): Promise<CanonicalWalletRow | { error: string }> {
  const existing = await getStellarWallet(userId, true)
  const pk = existing?.publicKey?.trim().toUpperCase() ?? ""

  if (pk.startsWith("C") && pk.length === 56) {
    const wt =
      existing?.walletType === "oz"
        ? "oz"
        : existing?.walletType === "factory"
          ? "factory"
          : "factory"
    return {
      publicKey: pk,
      signerPublicKey: existing?.signerPublicKey?.trim().toUpperCase() ?? null,
      walletType: wt,
      network: existing?.network ?? getStellarConfig().network,
      migrated: false,
    }
  }

  const signer =
    signerHint?.trim().toUpperCase() ||
    existing?.signerPublicKey?.trim().toUpperCase() ||
    (pk.startsWith("G") ? pk : null)

  if (!signer?.startsWith("G") || signer.length !== 56) {
    return {
      error:
        "Passkey signer (G…) required to deploy smart account. Sign in again with your passkey.",
    }
  }

  if (!isFactorySmartAccountConfigured()) {
    return {
      error:
        describeMissingSmartWalletEnv() ||
        "Smart account factory is not configured (SMART_ACCOUNT_FACTORY_ID, SOROBAN_RPC_URL, STELLAR_FUNDER_SECRET).",
    }
  }

  const provisioned = await provisionSmartWalletForSigner(signer)
  if ("error" in provisioned) {
    return { error: provisioned.error }
  }

  const contractId = provisioned.contractId.trim().toUpperCase()
  const stellarConfig = getStellarConfig()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return { error: "Server configuration error" }
  }

  const svc = createServiceClient(supabaseUrl, supabaseServiceKey)
  const row: Record<string, string | null> = {
    user_id: userId,
    public_key: contractId,
    signer_public_key: provisioned.signerPublicKey,
    wallet_type: "factory",
    turnkey_wallet_id: null,
    network: stellarConfig.network,
    updated_at: new Date().toISOString(),
  }

  let { error: upsertError } = await svc.from("stellar_wallets").upsert(row, {
    onConflict: "user_id",
  })

  if (upsertError?.message?.includes("signer_public_key")) {
    const { signer_public_key: _s, wallet_type: _w, ...without } = row
    const retry = await svc.from("stellar_wallets").upsert(without, {
      onConflict: "user_id",
    })
    upsertError = retry.error
  }

  if (upsertError) {
    return {
      error: `Smart account ${contractId} deployed but DB update failed: ${upsertError.message}`,
    }
  }

  console.log("[migrate-legacy-wallet] ✅ G → C for user", userId.slice(0, 8), contractId.slice(0, 12))

  return {
    publicKey: contractId,
    signerPublicKey: provisioned.signerPublicKey,
    walletType: "factory",
    network: stellarConfig.network,
    migrated: true,
  }
}
