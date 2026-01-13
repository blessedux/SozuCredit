/**
 * Server-Side Stellar Wallet Creation
 * 
 * Creates Stellar wallets using Stellar SDK (no Turnkey dependency).
 * Generates keypairs server-side but only stores public keys in database.
 * Private keys are never stored server-side.
 */

import { Keypair } from "@stellar/stellar-sdk"
import { getStellarConfig } from "../turnkey/config"
import { storeStellarWallet, getStellarWallet } from "../turnkey/stellar-wallet"

/**
 * Create a Stellar wallet for a user using Stellar SDK
 * Generates a new keypair and stores only the public key in the database
 * 
 * @param userId - User ID
 * @returns Public key and wallet ID (public key used as identifier)
 */
export async function createStellarWalletServerSide(
  userId: string
): Promise<{ publicKey: string; walletId: string }> {
  console.log("[Server Wallet] Starting wallet creation for user:", userId)

  // Check if wallet already exists
  const existingWallet = await getStellarWallet(userId, true)
  if (existingWallet) {
    console.log("[Server Wallet] Wallet already exists for user, returning existing wallet")
    return {
      publicKey: existingWallet.publicKey,
      walletId: existingWallet.publicKey, // Use public key as wallet ID
    }
  }

  // Generate new keypair using Stellar SDK
  console.log("[Server Wallet] Generating new keypair using Stellar SDK...")
  const keypair = Keypair.random()
  const publicKey = keypair.publicKey()

  console.log("[Server Wallet] Keypair generated:", {
    publicKey: publicKey.substring(0, 10) + "...",
  })

  // Store wallet in database (only public key, no private key)
  // Use public key as wallet ID since we're not using Turnkey
  const walletId = publicKey
  const storedWallet = await storeStellarWallet(
    userId,
    walletId, // Use public key as turnkey_wallet_id for backward compatibility
    publicKey,
    true // Use service client
  )

  console.log("[Server Wallet] ✅ Wallet created and stored successfully:", {
    walletId: storedWallet.publicKey.substring(0, 10) + "...",
    publicKey: storedWallet.publicKey.substring(0, 10) + "...",
  })

  return {
    publicKey: storedWallet.publicKey,
    walletId: storedWallet.publicKey, // Use public key as identifier
  }
}
