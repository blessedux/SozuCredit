/**
 * Server-Side USDC Trustline Creation
 * 
 * Creates USDC trustlines without Turnkey dependency.
 * Supports both:
 * 1. Building unsigned transaction and returning XDR for client-side signing
 * 2. Accepting pre-signed transaction XDR from client and submitting it
 */

import { Horizon, Asset, TransactionBuilder, Networks, Operation, BASE_FEE } from "@stellar/stellar-sdk"
import { getStellarConfig } from "../turnkey/config"
import { getStellarWallet } from "../turnkey/stellar-wallet"

/**
 * USDC issuers for Stellar network
 */
const USDC_ISSUERS = {
  testnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // Circle testnet USDC
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // Circle mainnet USDC
}

/**
 * Create USDC trustline for a Stellar wallet (server-side, no Turnkey)
 * 
 * If signedTransactionXdr is provided, submits it directly.
 * Otherwise, builds and returns unsigned transaction XDR for client-side signing.
 * 
 * @param userId - User ID
 * @param publicKey - Stellar public key
 * @param signedTransactionXdr - Optional: Pre-signed transaction XDR from client
 * @returns Success status, transaction hash, or unsigned XDR
 */
export async function createUSDCTrustlineServerSide(
  userId: string,
  publicKey: string,
  signedTransactionXdr?: string
): Promise<{
  success: boolean
  transactionHash?: string
  unsignedXdr?: string
  error?: string
}> {
  console.log("[Server Trustline] Starting trustline creation for user:", userId, "publicKey:", publicKey.substring(0, 10) + "...")

  try {
    const stellarConfig = getStellarConfig()
    const usdcIssuer = USDC_ISSUERS[stellarConfig.network]

    if (!usdcIssuer) {
      throw new Error(`USDC issuer not configured for network: ${stellarConfig.network}`)
    }

    // Create USDC asset
    const usdcAsset = new Asset("USDC", usdcIssuer)

    // Create Stellar server instance
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: stellarConfig.network === "testnet" }
    )

    // Load account to get sequence number
    let account
    try {
      account = await server.loadAccount(publicKey)
    } catch (error: any) {
      if (error?.response?.status === 404) {
        console.warn("[Server Trustline] Account not found yet, account may need to be funded first")
        return { success: false, error: "Account not found. Please fund the account first." }
      }
      throw error
    }

    // Check if trustline already exists
    const hasTrustline = account.balances.some(
      (bal: any) =>
        bal.asset_type !== "native" &&
        bal.asset_code === "USDC" &&
        bal.asset_issuer === usdcIssuer
    )

    if (hasTrustline) {
      console.log("[Server Trustline] ✅ USDC trustline already exists for publicKey:", publicKey.substring(0, 10) + "...")
      return { success: true }
    }

    // If signed transaction is provided, submit it directly
    if (signedTransactionXdr) {
      console.log("[Server Trustline] Submitting pre-signed transaction...")
      const networkPassphrase = stellarConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
      const signedTransaction = TransactionBuilder.fromXDR(signedTransactionXdr, networkPassphrase)

      const response = await server.submitTransaction(signedTransaction)

      console.log("[Server Trustline] ✅ USDC trustline created successfully")
      console.log("[Server Trustline] Transaction hash:", response.hash)

      return {
        success: true,
        transactionHash: response.hash,
      }
    }

    // Build unsigned transaction and return XDR for client-side signing
    console.log("[Server Trustline] Building unsigned transaction...")
    const networkPassphrase = stellarConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({
          asset: usdcAsset,
          limit: "922337203685.4775807", // Maximum trustline limit
        })
      )
      .setTimeout(30)
      .build()

    const unsignedXdr = transaction.toXDR()

    console.log("[Server Trustline] Unsigned transaction built, returning XDR for client-side signing")

    return {
      success: false, // Not yet successful, needs client-side signing
      unsignedXdr,
    }
  } catch (error) {
    console.error("[Server Trustline] Error creating USDC trustline:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Submit a signed trustline transaction
 * 
 * @param signedTransactionXdr - Signed transaction XDR from client
 * @param network - Network (testnet or mainnet)
 * @returns Transaction hash
 */
export async function submitTrustlineTransaction(
  signedTransactionXdr: string,
  network: "testnet" | "mainnet"
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    const stellarConfig = getStellarConfig()
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: network === "testnet" }
    )

    const networkPassphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
    const signedTransaction = TransactionBuilder.fromXDR(signedTransactionXdr, networkPassphrase)

    const response = await server.submitTransaction(signedTransaction)

    return {
      success: true,
      transactionHash: response.hash,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
