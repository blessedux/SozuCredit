"use client"

import { ensureSmartWallet } from "@/lib/wallet/ensure-smart-wallet"
import { persistCanonicalWalletSession } from "@/lib/wallet/persist-wallet-session"

/**
 * Re-link or redeploy the passkey smart account (C…) after auth failures.
 * Updates session + Supabase via registerOzSmartAccount inside ensureSmartWallet.
 */
export async function relinkSmartWalletForPayments(
  userId: string,
  loginCredentialId?: string,
): Promise<{ contractId: string; walletType: "oz"; credentialId?: string }> {
  const result = await ensureSmartWallet(userId, loginCredentialId)
  persistCanonicalWalletSession(result.publicKey, result.walletType, result.credentialId)
  return {
    contractId: result.publicKey,
    walletType: result.walletType,
    credentialId: result.credentialId,
  }
}
