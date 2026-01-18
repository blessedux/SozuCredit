/**
 * Cypherpunk Non-Custodial Wallet Creator
 * 
 * Phase 3: Real Stellar Account Creation with USDC Trustline
 * 
 * Features:
 * - Truly decentralized (no server dependencies)
 * - Real Stellar account creation (testnet friendbot, mainnet funding)
 * - Automatic USDC trustline creation
 * - User-friendly error handling
 * - Key recovery from passkey
 * - Stable and robust
 */

"use client"

import {
  Keypair,
  Horizon,
  Networks,
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  Account,
  Transaction,
  FeeBumpTransaction,
} from "@stellar/stellar-sdk"
import { getStellarConfig } from "../turnkey/config"
import { retrieveKeypair, deriveAndStoreKey } from "../storage/browser-keys"
import { signTransactionClientSide } from "./client-signing"
import { getCredentialIdFromSession, getPublicKeyFromSession } from "../storage/key-utils"

/**
 * Real USDC issuers for Stellar network
 * These are the actual Circle USDC issuers
 */
export const USDC_ISSUERS = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", // Stellar testnet USDC issuer
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // Circle mainnet USDC issuer
} as const

/**
 * Minimum XLM required for account + trustline
 */
export const MINIMUM_XLM_REQUIREMENTS = {
  account: 1, // Minimum XLM to create account
  trustline: 0.5, // Additional XLM for trustline reserve
  total: 1.5, // Total minimum XLM needed
} as const

/**
 * Account creation status
 */
export interface AccountCreationStatus {
  status: "checking" | "funding" | "creating" | "trustline" | "complete" | "error"
  message: string
  publicKey: string
  network: "testnet" | "mainnet"
  accountExists: boolean
  trustlineExists: boolean
  fundingRequired?: boolean
  fundingAddress?: string
  fundingAmount?: string
  transactionHash?: string
  error?: string
}

/**
 * Create a real Stellar account with USDC trustline
 * 
 * This is the cypherpunk way: fully decentralized, client-side, no server dependencies
 * 
 * @param credentialId - WebAuthn credential ID
 * @param userId - User ID (optional but recommended)
 * @param options - Additional options
 * @returns Account creation status with progress updates
 */
export async function createRealStellarAccount(
  credentialId: string,
  userId?: string,
  options: {
    onStatusUpdate?: (status: AccountCreationStatus) => void
    skipTrustline?: boolean
  } = {}
): Promise<AccountCreationStatus> {
  const { onStatusUpdate, skipTrustline = false } = options

  const updateStatus = (status: Partial<AccountCreationStatus>) => {
    const currentStatus: AccountCreationStatus = {
      status: "checking",
      message: "Initializing...",
      publicKey: "",
      network: "testnet",
      accountExists: false,
      trustlineExists: false,
      ...status,
    }
    onStatusUpdate?.(currentStatus)
    return currentStatus
  }

  try {
    // Step 1: Derive keypair from passkey
    updateStatus({
      status: "checking",
      message: "Deriving keys from passkey...",
    })

    const { keypair, publicKey } = await deriveAndStoreKey(credentialId, userId)
    const stellarConfig = getStellarConfig()
    const network = stellarConfig.network

    updateStatus({
      publicKey,
      network,
      message: `Keypair derived: ${publicKey.substring(0, 10)}...`,
    })

    // Step 2: Check if account exists
    const server = new Horizon.Server(stellarConfig.horizonUrl, {
      allowHttp: network === "testnet",
    })

    updateStatus({
      status: "checking",
      message: "Checking account status on Stellar network...",
    })

    let accountExists = false
    let account: Account | null = null

    try {
      account = await server.loadAccount(publicKey)
      accountExists = true
      updateStatus({
        accountExists: true,
        message: "Account already exists on Stellar network",
      })
    } catch (error: any) {
      if (error?.response?.status === 404) {
        accountExists = false
        updateStatus({
          accountExists: false,
          message: "Account does not exist yet - will create it",
        })
      } else {
        throw error
      }
    }

    // Step 3: Fund account if needed
    if (!accountExists) {
      if (network === "testnet") {
        // Use friendbot to fund testnet account
        updateStatus({
          status: "funding",
          message: "Funding account via Friendbot (testnet)...",
        })

        const friendbotUrl = `${stellarConfig.horizonUrl}/friendbot?addr=${publicKey}`
        const friendbotResponse = await fetch(friendbotUrl)

        if (!friendbotResponse.ok) {
          const errorData = await friendbotResponse.json().catch(() => ({}))
          throw new Error(
            `Friendbot funding failed: ${friendbotResponse.status} ${JSON.stringify(errorData)}`
          )
        }

        const friendbotData = await friendbotResponse.json()
        updateStatus({
          status: "creating",
          message: "Account funded! Waiting for account creation...",
          transactionHash: friendbotData.hash,
        })

        // Wait a moment for account to be created
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Reload account
        account = await server.loadAccount(publicKey)
        accountExists = true
      } else {
        // Mainnet: Provide funding instructions
        updateStatus({
          status: "funding",
          message: "Account needs funding (mainnet)",
          fundingRequired: true,
          fundingAddress: publicKey,
          fundingAmount: String(MINIMUM_XLM_REQUIREMENTS.total),
          error: "Please fund this account with at least 1.5 XLM to create account and USDC trustline",
        })
        return updateStatus({
          status: "error",
          message: "Account funding required for mainnet",
        })
      }
    }

    if (!account) {
      throw new Error("Account not found after funding")
    }

    // Step 4: Create USDC trustline
    if (!skipTrustline) {
      updateStatus({
        status: "trustline",
        message: "Creating USDC trustline...",
      })

      const trustlineResult = await createUSDCTrustlineReal(
        keypair,
        publicKey,
        account,
        network,
        credentialId,
        userId
      )

      if (trustlineResult.success) {
        updateStatus({
          status: "complete",
          message: "✅ Account created with USDC trustline!",
          trustlineExists: true,
          transactionHash: trustlineResult.transactionHash,
        })
      } else {
        updateStatus({
          status: "complete",
          message: "Account created, but USDC trustline failed",
          trustlineExists: false,
          error: trustlineResult.error,
        })
      }
    } else {
      updateStatus({
        status: "complete",
        message: "✅ Account created!",
        trustlineExists: false,
      })
    }

    return updateStatus({
      status: "complete",
      message: "✅ Wallet ready!",
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[Wallet Creator] Error:", error)

    return updateStatus({
      status: "error",
      message: `Error: ${errorMessage}`,
      error: errorMessage,
    })
  }
}

/**
 * Create USDC trustline using real USDC issuer
 * 
 * @param keypair - Stellar keypair
 * @param publicKey - Stellar public key
 * @param account - Stellar account object
 * @param network - Network (testnet or mainnet)
 * @param credentialId - Credential ID for client-side signing
 * @param userId - User ID for client-side signing
 * @returns Success status and transaction hash
 */
export async function createUSDCTrustlineReal(
  keypair: Keypair,
  publicKey: string,
  account: Account,
  network: "testnet" | "mainnet",
  credentialId?: string,
  userId?: string
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    const usdcIssuer = USDC_ISSUERS[network]

    if (!usdcIssuer) {
      throw new Error(`USDC issuer not configured for network: ${network}`)
    }

    // Check if trustline already exists
    const hasTrustline = (account as any).balances?.some(
      (bal: any) =>
        bal.asset_type === "credit_alphanum4" &&
        bal.asset_code === "USDC" &&
        bal.asset_issuer === usdcIssuer
    ) || false

    if (hasTrustline) {
      console.log("[Wallet Creator] ✅ USDC trustline already exists")
      return { success: true }
    }

    // Create USDC asset
    const usdcAsset = new Asset("USDC", usdcIssuer)

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

    // Sign transaction (client-side if credentialId provided, otherwise use keypair directly)
    let signedTransaction: Transaction | FeeBumpTransaction
    if (credentialId && userId) {
      const signedResult = await signTransactionClientSide(
        transaction,
        credentialId,
        publicKey,
        userId
      )
      // Use the signed transaction returned from signTransactionClientSide
      signedTransaction = signedResult.transaction
    } else {
      transaction.sign(keypair)
      signedTransaction = transaction
    }

    // Submit transaction
    const stellarConfig = getStellarConfig()
    const server = new Horizon.Server(stellarConfig.horizonUrl, {
      allowHttp: network === "testnet",
    })

    const response = await server.submitTransaction(signedTransaction)

    console.log("[Wallet Creator] ✅ USDC trustline created successfully")
    console.log("[Wallet Creator] Transaction hash:", response.hash)

    return {
      success: true,
      transactionHash: response.hash,
    }
  } catch (error: any) {
    console.error("[Wallet Creator] Error creating USDC trustline:", error)
    
    // Extract detailed error information from Horizon API
    let errorMessage = error instanceof Error ? error.message : String(error)
    let errorDetails = ""
    
    // Try to extract result codes from Horizon error response
    if (error?.response?.data) {
      const responseData = error.response.data
      
      // Extract result codes
      if (responseData.extras?.result_codes) {
        const resultCodes = responseData.extras.result_codes
        errorDetails = `\nOperation Result: ${resultCodes.operations?.join(", ") || "Unknown"}`
        errorDetails += `\nTransaction Result: ${resultCodes.transaction || "Unknown"}`
      }
      
      // Extract error message
      if (responseData.detail) {
        errorMessage = responseData.detail
      } else if (responseData.title) {
        errorMessage = responseData.title
      }
      
      // Log full error for debugging
      console.error("[Wallet Creator] Full Horizon error:", JSON.stringify(responseData, null, 2))
    }
    
    return {
      success: false,
      error: `${errorMessage}${errorDetails}`,
    }
  }
}

/**
 * Get or create wallet for current user (convenience function)
 * 
 * @param userId - User ID (optional)
 * @param options - Options for wallet creation
 * @returns Account creation status
 */
export async function getOrCreateRealWallet(
  userId?: string,
  options: {
    onStatusUpdate?: (status: AccountCreationStatus) => void
    skipTrustline?: boolean
  } = {}
): Promise<AccountCreationStatus> {
  // Get credential ID from session
  const credentialId = getCredentialIdFromSession()

  if (!credentialId) {
    throw new Error(
      "No credential ID found. Please authenticate with a passkey first."
    )
  }

  // Get userId from session if not provided
  const finalUserId = userId || (typeof window !== "undefined" ? sessionStorage.getItem("dev_username") : null) || undefined

  return createRealStellarAccount(credentialId, finalUserId || undefined, options)
}

/**
 * Check account status without creating
 * 
 * @param publicKey - Stellar public key
 * @returns Account status information
 */
export async function checkAccountStatus(
  publicKey: string
): Promise<{
  exists: boolean
  network: "testnet" | "mainnet"
  balances: Array<{ asset: string; balance: string }>
  hasUSDCTrustline: boolean
  usdcIssuer?: string
}> {
  const stellarConfig = getStellarConfig()
  const network = stellarConfig.network
  const server = new Horizon.Server(stellarConfig.horizonUrl, {
    allowHttp: network === "testnet",
  })

  try {
    const account = await server.loadAccount(publicKey)
    const usdcIssuer = USDC_ISSUERS[network]

    const balances = account.balances.map((bal: any) => ({
      asset: bal.asset_type === "native" ? "XLM" : `${bal.asset_code}:${bal.asset_issuer}`,
      balance: bal.balance,
    }))

    const hasUSDCTrustline = account.balances.some(
      (bal: any) =>
        (bal.asset_type === "credit_alphanum4" || bal.asset_type === "credit_alphanum12") &&
        bal.asset_code === "USDC" &&
        bal.asset_issuer === usdcIssuer
    )

    return {
      exists: true,
      network,
      balances,
      hasUSDCTrustline,
      usdcIssuer: hasUSDCTrustline ? usdcIssuer : undefined,
    }
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return {
        exists: false,
        network,
        balances: [],
        hasUSDCTrustline: false,
      }
    }
    throw error
  }
}
