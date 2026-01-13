/**
 * Client-Side Wallet Creation
 * 
 * Creates Stellar wallets client-side using keys derived from passkeys.
 * This enables non-custodial wallet creation without server-side key generation.
 */

"use client"

import { Keypair, Horizon, Networks, Asset, Operation, TransactionBuilder, BASE_FEE } from "@stellar/stellar-sdk"
import { getStellarConfig } from "../turnkey/config"
import { retrieveKeypair, deriveAndStoreKey } from "../storage/browser-keys"
import { getCurrentCredentialId } from "../storage/key-utils"

/**
 * USDC issuers for Stellar network
 */
const USDC_ISSUERS = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", // Stellar testnet USDC issuer
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // Circle mainnet USDC issuer
}

/**
 * Get wallet balance for a specific asset from Stellar network (client-side safe)
 * This version doesn't use Supabase, so it can be used in client components
 */
export async function getWalletBalanceClientSide(
  publicKey: string,
  assetCode: string = "native",
  assetIssuer?: string
): Promise<number> {
  const { getStellarConfig } = await import("../turnkey/config")
  const stellarConfig = getStellarConfig()
  const { Horizon } = await import("@stellar/stellar-sdk")

  try {
    // Create Stellar server instance
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: stellarConfig.network === "testnet" }
    )

    // Load account from Stellar network
    const account = await server.loadAccount(publicKey)

    // Log all balances for debugging (especially for USDC)
    if (assetCode === "USDC") {
      console.log(`[getWalletBalanceClientSide] 🔍 Checking USDC balance for ${publicKey.substring(0, 10)}...`)
      console.log(`[getWalletBalanceClientSide] Network: ${stellarConfig.network}`)
      console.log(`[getWalletBalanceClientSide] Looking for issuer: ${assetIssuer ? assetIssuer.substring(0, 20) + "..." : "ANY"}`)
      console.log(`[getWalletBalanceClientSide] All account balances:`, account.balances.map((b: any) => ({
        asset_type: b.asset_type,
        asset_code: b.asset_code,
        asset_issuer: b.asset_issuer ? b.asset_issuer.substring(0, 20) + "..." : undefined,
        balance: b.balance,
      })))
    }

    // Find the balance for the requested asset
    let balance
    
    if (assetCode === "native" || assetCode === "XLM") {
      // Get XLM balance (native Stellar asset)
      balance = account.balances.find(
        (bal: any) => bal.asset_type === "native"
      )
    } else {
      // Get balance for specific asset (e.g., USDC)
      if (assetIssuer) {
        // Try exact match with issuer first
        balance = account.balances.find(
          (bal: any) => 
            bal.asset_type !== "native" &&
            bal.asset_code === assetCode &&
            bal.asset_issuer === assetIssuer
        )
        
        if (!balance && assetCode === "USDC") {
          console.warn(`[getWalletBalanceClientSide] ⚠️ No USDC balance found with issuer ${assetIssuer.substring(0, 20)}...`)
          console.warn(`[getWalletBalanceClientSide] Available non-native assets:`, account.balances
            .filter((b: any) => b.asset_type !== "native")
            .map((b: any) => `${b.asset_code}:${b.asset_issuer ? b.asset_issuer.substring(0, 20) + "..." : "N/A"}`))
        }
      } else {
        // Try without issuer (match any asset with this code)
        balance = account.balances.find(
          (bal: any) => 
            bal.asset_type !== "native" &&
            bal.asset_code === assetCode
        )
        
        if (balance && assetCode === "USDC") {
          const issuer = (balance as any).asset_issuer
          console.log(`[getWalletBalanceClientSide] ✅ Found USDC without issuer check:`, balance.balance, `(issuer: ${issuer ? issuer.substring(0, 20) + "..." : "N/A"})`)
        }
      }
    }

    if (!balance) {
      if (assetCode === "USDC") {
        console.warn(`[getWalletBalanceClientSide] ❌ No ${assetCode} balance found${assetIssuer ? ` with issuer ${assetIssuer.substring(0, 20)}...` : ''}`)
      }
      return 0
    }

    const balanceValue = parseFloat(balance.balance)
    if (assetCode === "USDC") {
      const issuer = (balance as any).asset_issuer
      console.log(`[getWalletBalanceClientSide] ✅ Found ${assetCode} balance:`, balanceValue, assetIssuer ? `(issuer: ${assetIssuer.substring(0, 20)}...)` : `(issuer: ${issuer ? issuer.substring(0, 20) + "..." : "N/A"})`)
    }
    return balanceValue
  } catch (error: any) {
    // If account doesn't exist or has no balance, return 0
    if (error?.response?.status === 404) {
      console.warn(`[getWalletBalanceClientSide] Account not found (404) for ${publicKey.substring(0, 10)}...`)
      return 0
    }
    console.error(`[getWalletBalanceClientSide] Error fetching ${assetCode} balance:`, error)
    throw new Error(`Failed to get wallet balance: ${error.message}`)
  }
}

/**
 * Get USDC balance from Stellar wallet (client-side safe)
 * Uses testnet USDC issuer for testnet, mainnet issuer for mainnet
 */
export async function getUSDCBalanceClientSide(publicKey: string): Promise<number> {
  const { getStellarConfig } = await import("../turnkey/config")
  const stellarConfig = getStellarConfig()
  const usdcIssuer = USDC_ISSUERS[stellarConfig.network]
  
  console.log("[getUSDCBalanceClientSide] Fetching USDC balance:", {
    publicKey: publicKey.substring(0, 10) + "...",
    network: stellarConfig.network,
    issuer: usdcIssuer,
  })
  
  try {
    // Try with specific issuer first
    const usdcBalance = await getWalletBalanceClientSide(publicKey, "USDC", usdcIssuer)
    console.log("[getUSDCBalanceClientSide] ✅ USDC balance found:", usdcBalance, "with issuer:", usdcIssuer)
    return usdcBalance
  } catch (error) {
    console.warn("[getUSDCBalanceClientSide] Could not find USDC balance with issuer, trying without issuer:", error)
    // Fallback: try without issuer (in case there's a different USDC asset)
    try {
      const usdcBalance = await getWalletBalanceClientSide(publicKey, "USDC")
      console.log("[getUSDCBalanceClientSide] ✅ USDC balance found (without issuer):", usdcBalance)
      return usdcBalance
    } catch (fallbackError) {
      console.warn("[getUSDCBalanceClientSide] Could not find USDC balance, returning 0:", fallbackError)
      return 0
    }
  }
}

/**
 * Create a Stellar wallet client-side from a passkey credential ID
 * 
 * @param credentialId - WebAuthn credential ID
 * @param userId - User ID (optional but recommended)
 * @param createTrustline - Whether to create USDC trustline automatically (default: true)
 * @returns Wallet information including public key
 */
export async function createWalletClientSide(
  credentialId: string,
  userId?: string,
  createTrustline: boolean = true
): Promise<{
  publicKey: string
  network: "testnet" | "mainnet"
  trustlineCreated?: boolean
  trustlineError?: string
}> {
  console.log("[Client Wallet] Creating wallet client-side:", {
    credentialId: credentialId.substring(0, 20) + "...",
    userId: userId || "not provided",
  })

  // Derive keypair from credential ID
  const { keypair, publicKey } = await deriveAndStoreKey(credentialId, userId)
  const stellarConfig = getStellarConfig()

  console.log("[Client Wallet] ✅ Keypair derived:", {
    publicKey: publicKey.substring(0, 10) + "...",
    network: stellarConfig.network,
  })

  // Check if account exists on Stellar network
  const server = new Horizon.Server(
    stellarConfig.horizonUrl,
    { allowHttp: stellarConfig.network === "testnet" }
  )

  let accountExists = false
  try {
    await server.loadAccount(publicKey)
    accountExists = true
    console.log("[Client Wallet] Account already exists on Stellar network")
  } catch (error: any) {
    if (error?.response?.status === 404) {
      console.log("[Client Wallet] Account does not exist yet - user needs to fund it first")
      accountExists = false
    } else {
      throw error
    }
  }

  // Create USDC trustline if requested and account exists
  let trustlineCreated = false
  let trustlineError: string | undefined

  if (createTrustline && accountExists) {
    try {
      console.log("[Client Wallet] Creating USDC trustline...")
      const trustlineResult = await createUSDCTrustlineClientSide(
        keypair,
        publicKey,
        stellarConfig.network
      )
      trustlineCreated = trustlineResult.success
      trustlineError = trustlineResult.error
      
      if (trustlineCreated) {
        console.log("[Client Wallet] ✅ USDC trustline created successfully")
      } else {
        console.warn("[Client Wallet] ⚠️ USDC trustline creation failed:", trustlineError)
      }
    } catch (error) {
      trustlineError = error instanceof Error ? error.message : String(error)
      console.warn("[Client Wallet] ⚠️ Error creating USDC trustline:", trustlineError)
    }
  } else if (createTrustline && !accountExists) {
    console.log("[Client Wallet] Skipping trustline creation - account not funded yet")
    trustlineError = "Account not funded - fund account first, then create trustline"
  }

  return {
    publicKey,
    network: stellarConfig.network,
    trustlineCreated,
    trustlineError,
  }
}

/**
 * Create USDC trustline for a Stellar wallet (client-side)
 * 
 * @param keypair - Stellar keypair to sign with
 * @param publicKey - Stellar public key
 * @param network - Network (testnet or mainnet)
 * @returns Success status and optional transaction hash or error
 */
export async function createUSDCTrustlineClientSide(
  keypair: Keypair,
  publicKey: string,
  network: "testnet" | "mainnet"
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  console.log("[Client Wallet] Creating USDC trustline client-side:", {
    publicKey: publicKey.substring(0, 10) + "...",
    network,
  })

  try {
    const stellarConfig = getStellarConfig()
    const usdcIssuer = USDC_ISSUERS[network]

    if (!usdcIssuer) {
      throw new Error(`USDC issuer not configured for network: ${network}`)
    }

    // Create USDC asset
    const usdcAsset = new Asset("USDC", usdcIssuer)

    // Create Stellar server instance
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: network === "testnet" }
    )

    // Load account to get sequence number
    let account
    try {
      account = await server.loadAccount(publicKey)
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return {
          success: false,
          error: "Account not found. Please fund the account first.",
        }
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
      console.log("[Client Wallet] ✅ USDC trustline already exists")
      return { success: true }
    }

    // Build change trust operation
    const networkPassphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

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

    console.log("[Client Wallet] Transaction built, signing client-side...")

    // Sign transaction client-side
    transaction.sign(keypair)

    console.log("[Client Wallet] Transaction signed, submitting to network...")

    // Submit transaction to network
    const response = await server.submitTransaction(transaction)

    console.log("[Client Wallet] ✅ USDC trustline created successfully")
    console.log("[Client Wallet] Transaction hash:", response.hash)

    return {
      success: true,
      transactionHash: response.hash,
    }
  } catch (error) {
    console.error("[Client Wallet] Error creating USDC trustline:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Get or create wallet for current user
 * Uses credential ID from sessionStorage or derives from passkey
 * 
 * @param userId - User ID (optional)
 * @param createTrustline - Whether to create USDC trustline (default: true)
 * @returns Wallet information
 */
export async function getOrCreateWalletClientSide(
  userId?: string,
  createTrustline: boolean = true
): Promise<{
  publicKey: string
  network: "testnet" | "mainnet"
  trustlineCreated?: boolean
  trustlineError?: string
}> {
  // Try to get credential ID
  const credentialId = await getCurrentCredentialId()

  if (!credentialId) {
    throw new Error(
      "No credential ID found. Please authenticate with a passkey first."
    )
  }

  // Check if we already have a keypair stored
  const { retrieveKeypair } = await import("../storage/browser-keys")
  const existingKeypair = await retrieveKeypair(credentialId)

  if (existingKeypair) {
    const publicKey = existingKeypair.publicKey()
    const stellarConfig = getStellarConfig()

    console.log("[Client Wallet] Using existing keypair:", {
      publicKey: publicKey.substring(0, 10) + "...",
    })

    // Check if trustline exists and create if needed
    let trustlineCreated = false
    let trustlineError: string | undefined

    if (createTrustline) {
      try {
        const trustlineResult = await createUSDCTrustlineClientSide(
          existingKeypair,
          publicKey,
          stellarConfig.network
        )
        trustlineCreated = trustlineResult.success
        trustlineError = trustlineResult.error
      } catch (error) {
        trustlineError = error instanceof Error ? error.message : String(error)
      }
    }

    return {
      publicKey,
      network: stellarConfig.network,
      trustlineCreated,
      trustlineError,
    }
  }

  // Create new wallet
  return createWalletClientSide(credentialId, userId, createTrustline)
}
