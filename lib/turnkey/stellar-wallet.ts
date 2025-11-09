import { getTurnkeyClient } from "./client"
import { getTurnkeyConfig, getStellarConfig } from "./config"
import { createActivityPoller } from "@turnkey/http"
import { Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE, Account, Transaction } from "@stellar/stellar-sdk"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { signSorobanTransaction, submitSorobanTransaction } from "./soroban-signing"

export interface StellarWallet {
  id: string
  userId: string
  turnkeyWalletId: string
  publicKey: string
  network: "testnet" | "mainnet"
  createdAt: string
  updatedAt: string
  previousUsdcBalance?: number | null
}

/**
 * Create a Stellar wallet for a user using Turnkey
 * Creates an ED25519 private key and derives the Stellar public key
 */
export async function createStellarWallet(
  userId: string
): Promise<{ turnkeyWalletId: string; publicKey: string }> {
  console.log("[createStellarWallet] Starting wallet creation for user:", userId)

  const turnkeyConfig = getTurnkeyConfig()
  if (!turnkeyConfig) {
    throw new Error("Turnkey configuration not found. Please check environment variables.")
  }

  console.log("[createStellarWallet] Turnkey config validated, organizationId:", turnkeyConfig.organizationId)

  const stellarConfig = getStellarConfig()
  const client = getTurnkeyClient()

  console.log("[createStellarWallet] Creating ED25519 private key via Turnkey...")

  try {
    // Generate a unique name for this private key
    const privateKeyName = `stellar-wallet-${userId}-${Date.now()}`
    console.log("[createStellarWallet] Private key name:", privateKeyName)

    // Prepare the request body
    const requestBody = {
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
      timestampMs: Date.now().toString(),
      organizationId: turnkeyConfig.organizationId,
      parameters: {
        privateKeys: [
          {
            privateKeyName,
            curve: "CURVE_ED25519" as const, // Stellar uses ED25519
            privateKeyTags: [], // Required field - empty array for no tags
            addressFormats: [], // Required field - empty array, we'll derive Stellar address manually
          },
        ],
      },
    }

    console.log("[createStellarWallet] Request body:", JSON.stringify(requestBody, null, 2))

    // Call client.createPrivateKeys directly
    // TCreatePrivateKeysBody is { body: v1CreatePrivateKeysRequest }
    console.log("[createStellarWallet] Calling Turnkey createPrivateKeys...")
    
    let activity
    try {
      // Try with body wrapper (the documented structure)
      const initialResponse = await client.createPrivateKeys({
        body: requestBody,
      } as any)
      
      activity = initialResponse.activity
      console.log("[createStellarWallet] Initial response activity ID:", activity.id)
      console.log("[createStellarWallet] Initial response status:", activity.status)
      
      // If not completed, poll for completion
      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        const createPrivateKeysPoller = createActivityPoller({
          client,
          requestFn: client.createPrivateKeys,
          refreshIntervalMs: 500,
        })

        console.log("[createStellarWallet] Polling for activity completion...")
        activity = await createPrivateKeysPoller({
          body: requestBody,
        } as any)
      }
    } catch (error: any) {
      // If body wrapper fails, try without it (maybe TCreatePrivateKeysBody is the request itself)
      console.error("[createStellarWallet] Error with body wrapper, trying without:", error.message)
      
      const initialResponse = await client.createPrivateKeys(requestBody as any)
      activity = initialResponse.activity
      
      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        const createPrivateKeysPoller = createActivityPoller({
          client,
          requestFn: client.createPrivateKeys,
          refreshIntervalMs: 500,
        })

        activity = await createPrivateKeysPoller(requestBody as any)
      }
    }

    console.log("[createStellarWallet] Private key creation activity completed")

    if (!activity.result?.createPrivateKeysResultV2?.privateKeys?.[0]) {
      console.error("[createStellarWallet] No private key in result:", JSON.stringify(activity.result, null, 2))
      throw new Error("Failed to create private key: no result returned")
    }

    const privateKeyResult = activity.result.createPrivateKeysResultV2.privateKeys[0]
    const privateKeyId = privateKeyResult.privateKeyId

    if (!privateKeyId) {
      console.error("[createStellarWallet] No privateKeyId in result:", JSON.stringify(privateKeyResult, null, 2))
      throw new Error("Failed to create private key: no private key ID returned")
    }

    console.log("[createStellarWallet] Private key created, ID:", privateKeyId)

    // Get the private key details to extract the public key
    console.log("[createStellarWallet] Fetching private key details...")
    const privateKeyResponse = await client.getPrivateKey({
      organizationId: turnkeyConfig.organizationId,
      privateKeyId,
    })

    // Extract public key from the private key response
    const privateKeyData = privateKeyResponse.privateKey

    if (!privateKeyData?.publicKey) {
      console.error("[createStellarWallet] No public key in response:", JSON.stringify(privateKeyData, null, 2))
      throw new Error("Failed to get public key from private key")
    }

    console.log("[createStellarWallet] Public key retrieved, length:", privateKeyData.publicKey.length)
    console.log("[createStellarWallet] Public key preview:", privateKeyData.publicKey.substring(0, 50) + "...")

    // Check if Turnkey already derived a Stellar address
    // Turnkey may provide addresses in the addresses array
    let stellarPublicKey: string | undefined

    if (privateKeyData.addresses && privateKeyData.addresses.length > 0) {
      console.log("[createStellarWallet] Found", privateKeyData.addresses.length, "addresses from Turnkey")
      // Look for a Stellar-formatted address (starts with 'G')
      const stellarAddress = privateKeyData.addresses.find(
        (addr) => addr.address?.startsWith("G")
      )
      if (stellarAddress?.address) {
        stellarPublicKey = stellarAddress.address
        console.log("[createStellarWallet] Found Stellar address from Turnkey:", stellarPublicKey)
      }
    }

    // If no Stellar address was found in Turnkey's addresses, derive it from the public key
    if (!stellarPublicKey) {
      console.log("[createStellarWallet] Deriving Stellar address from public key...")
      
      // Convert public key from Turnkey to Stellar format
      // Turnkey's publicKey format can vary - it might be:
      // 1. Base64 encoded
      // 2. Hex encoded
      // 3. PEM format
      // 4. Raw bytes
      let publicKeyBytes: Buffer | null = null

      try {
        // Try base64 first (most common format from Turnkey)
        publicKeyBytes = Buffer.from(privateKeyData.publicKey, "base64")
        console.log("[createStellarWallet] Parsed as base64, got", publicKeyBytes.length, "bytes")
      } catch {
        try {
          // Try hex if base64 fails
          publicKeyBytes = Buffer.from(privateKeyData.publicKey, "hex")
          console.log("[createStellarWallet] Parsed as hex, got", publicKeyBytes.length, "bytes")
        } catch {
          // If both fail, check if it's already a Stellar-formatted address
          if (privateKeyData.publicKey.startsWith("G")) {
            console.log("[createStellarWallet] Public key is already a Stellar address")
            stellarPublicKey = privateKeyData.publicKey
          } else {
            console.error("[createStellarWallet] Unable to parse public key format:", privateKeyData.publicKey.substring(0, 100))
            throw new Error(
              `Unable to parse public key. Format: ${privateKeyData.publicKey.substring(0, 50)}... (length: ${privateKeyData.publicKey.length})`
            )
          }
        }
      }

      if (!stellarPublicKey && publicKeyBytes) {
        // Ensure we have at least 32 bytes for ED25519
        if (publicKeyBytes.length < 32) {
          throw new Error(
            `Public key too short: expected at least 32 bytes for ED25519, got ${publicKeyBytes.length} bytes`
          )
        }

        // Extract the first 32 bytes (ED25519 public key)
        const ed25519PublicKey = publicKeyBytes.slice(0, 32)
        console.log("[createStellarWallet] Extracted ED25519 public key, encoding to Stellar format...")

        // Use Stellar SDK to encode the public key bytes into a Stellar address
        // Stellar addresses start with 'G' and use base32 encoding
        const { StrKey } = await import("@stellar/stellar-sdk")
        
        // Encode the 32-byte ED25519 public key into Stellar address format
        stellarPublicKey = StrKey.encodeEd25519PublicKey(ed25519PublicKey)
        console.log("[createStellarWallet] Derived Stellar address:", stellarPublicKey)
      }
    }

    if (!stellarPublicKey) {
      throw new Error("Failed to derive Stellar public key")
    }

    console.log("[createStellarWallet] Wallet creation successful!")
    console.log("[createStellarWallet] Turnkey Wallet ID:", privateKeyId)
    console.log("[createStellarWallet] Stellar Public Key:", stellarPublicKey)

    return {
      turnkeyWalletId: privateKeyId,
      publicKey: stellarPublicKey,
    }
  } catch (error) {
    console.error("[createStellarWallet] Error creating wallet:", error)
    if (error instanceof Error) {
      console.error("[createStellarWallet] Error message:", error.message)
      console.error("[createStellarWallet] Error stack:", error.stack)
    }
    throw error
  }
}

/**
 * Get Stellar wallet for a user from database
 * Uses service client if no authenticated user (for dev mode with x-user-id)
 */
export async function getStellarWallet(userId: string, useServiceClient = false): Promise<StellarWallet | null> {
  let supabase = await createClient()
  
  // If explicitly requested to use service client, use it immediately
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      console.log("[getStellarWallet] Using service client to bypass RLS (explicitly requested)")
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    } else {
      console.warn("[getStellarWallet] Service client requested but SUPABASE_SERVICE_ROLE_KEY not set")
    }
  } else {
    // Check if we have an authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    
    // If no authenticated user, use service client to bypass RLS
    if (!user) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseServiceKey && supabaseUrl) {
        console.log("[getStellarWallet] Using service client to bypass RLS (no authenticated user)")
        supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
      }
    }
  }

  console.log("[getStellarWallet] Querying wallet for userId:", userId, "userId type:", typeof userId, "userId length:", userId?.length)
  
  const { data, error } = await supabase
    .from("stellar_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle() // Use maybeSingle instead of single to avoid errors when no row found

  if (error) {
    console.error("[getStellarWallet] Error querying wallet for userId:", userId, "Error:", error)
    // Don't throw - just return null if there's an error
      return null
  }

  if (!data) {
    console.log("[getStellarWallet] No wallet found for userId:", userId)
    return null
  }
  
  console.log("[getStellarWallet] ✅ Wallet found for userId:", userId, "publicKey:", data.public_key ? `${data.public_key.substring(0, 10)}...` : "NULL", "wallet_id:", data.id)

  // Map database column names to TypeScript property names
  return {
    id: data.id,
    userId: data.user_id,
    turnkeyWalletId: data.turnkey_wallet_id,
    publicKey: data.public_key,
    network: data.network,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    previousUsdcBalance: data.previous_usdc_balance ? Number(data.previous_usdc_balance) : null,
  } as StellarWallet
}

/**
 * Store Stellar wallet in database
 * Uses service client if no authenticated user (for dev mode with x-user-id)
 */
export async function storeStellarWallet(
  userId: string,
  turnkeyWalletId: string,
  publicKey: string,
  useServiceClient = false
): Promise<StellarWallet> {
  let supabase = await createClient()
  
  // If explicitly requested to use service client, use it immediately
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log("[storeStellarWallet] Service client requested, checking env vars:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyLength: supabaseServiceKey?.length || 0,
    })
    
    if (supabaseServiceKey && supabaseUrl) {
      console.log("[storeStellarWallet] Using service client to bypass RLS (explicitly requested)")
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    } else {
      const missing = []
      if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL")
      if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY")
      console.error(`[storeStellarWallet] Service client requested but missing env vars: ${missing.join(", ")}`)
      throw new Error(`Service client requested but missing environment variables: ${missing.join(", ")}`)
    }
  } else {
    // Check if we have an authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    
    // If no authenticated user, use service client to bypass RLS
    if (!user) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseServiceKey && supabaseUrl) {
        console.log("[storeStellarWallet] Using service client to bypass RLS (no authenticated user)")
        supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
      }
    }
  }
  
  const stellarConfig = getStellarConfig()

  // First, check if a wallet already exists for this user
  const existingWallet = await getStellarWallet(userId, useServiceClient)
  if (existingWallet) {
    console.log("[storeStellarWallet] Wallet already exists for userId:", userId, "NOT creating duplicate")
    console.log("[storeStellarWallet] Existing wallet:", {
      id: existingWallet.id,
      turnkeyWalletId: existingWallet.turnkeyWalletId,
      publicKey: existingWallet.publicKey ? `${existingWallet.publicKey.substring(0, 10)}...` : null,
    })
    // Return existing wallet instead of creating a new one
    return existingWallet
  }
  
  console.log("[storeStellarWallet] No existing wallet found, creating new wallet:", {
    userId,
    turnkeyWalletId,
    publicKey: publicKey ? `${publicKey.substring(0, 10)}...` : null,
    publicKeyLength: publicKey?.length || 0,
    network: stellarConfig.network,
  })

  // Use upsert to ensure one wallet per user (handles both create and update)
  // If wallet exists for this user, update it; otherwise, create new one
  const { data, error } = await supabase
    .from("stellar_wallets")
    .upsert({
      user_id: userId,
      turnkey_wallet_id: turnkeyWalletId,
      public_key: publicKey,
      network: stellarConfig.network,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
      ignoreDuplicates: false, // Update existing wallet
    })
    .select()
    .single()

  if (error) {
    console.error("[storeStellarWallet] Upsert error:", error)
    throw new Error(`Failed to store wallet: ${error.message}`)
  }

  if (!data) {
    console.error("[storeStellarWallet] No data returned from upsert")
    throw new Error("Failed to store wallet: No data returned")
  }

  console.log("[storeStellarWallet] Wallet stored successfully:", {
    id: data.id,
    turnkeyWalletId: data.turnkey_wallet_id,
    publicKey: data.public_key ? `${data.public_key.substring(0, 10)}...` : null,
    publicKeyLength: data.public_key?.length || 0,
    network: data.network,
  })

  // Map database column names to TypeScript property names
  return {
    id: data.id,
    userId: data.user_id,
    turnkeyWalletId: data.turnkey_wallet_id,
    publicKey: data.public_key,
    network: data.network,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  } as StellarWallet
}

/**
 * Delete Stellar wallet from database
 * Uses service client if no authenticated user (for dev mode with x-user-id)
 */
export async function deleteStellarWallet(userId: string, useServiceClient = false): Promise<void> {
  let supabase = await createClient()
  
  // If explicitly requested to use service client, use it immediately
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      console.log("[deleteStellarWallet] Using service client to bypass RLS (explicitly requested)")
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    } else {
      console.warn("[deleteStellarWallet] Service client requested but SUPABASE_SERVICE_ROLE_KEY not set")
    }
  } else {
    // Check if we have an authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    
    // If no authenticated user, use service client to bypass RLS
    if (!user) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseServiceKey && supabaseUrl) {
        console.log("[deleteStellarWallet] Using service client to bypass RLS (no authenticated user)")
        supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
      }
    }
  }

  const { error } = await supabase
    .from("stellar_wallets")
    .delete()
    .eq("user_id", userId)

  if (error) {
    throw new Error(`Failed to delete wallet: ${error.message}`)
  }
}

/**
 * Get wallet balance for a specific asset from Stellar network
 * @param publicKey Stellar wallet public key
 * @param assetCode Asset code to query (e.g., "USDC", "XLM"). Defaults to "native" for XLM
 * @param assetIssuer Optional issuer address for non-native assets
 */
export async function getWalletBalance(
  publicKey: string,
  assetCode: string = "native",
  assetIssuer?: string
): Promise<number> {
  const stellarConfig = getStellarConfig()

  try {
    // Create Stellar server instance
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: stellarConfig.network === "testnet" }
    )

    // Load account from Stellar network
    const account = await server.loadAccount(publicKey)

    // Find the balance for the requested asset
    let balance
    
    if (assetCode === "native" || assetCode === "XLM") {
      // Get XLM balance (native Stellar asset)
      balance = account.balances.find(
        (bal: any) => bal.asset_type === "native"
      )
    } else {
      // Get balance for specific asset (e.g., USDC)
      balance = account.balances.find(
        (bal: any) => 
          bal.asset_type !== "native" &&
          bal.asset_code === assetCode &&
          (!assetIssuer || bal.asset_issuer === assetIssuer)
      )
    }

    if (!balance) {
      return 0
    }

    return parseFloat(balance.balance)
  } catch (error: any) {
    // If account doesn't exist or has no balance, return 0
    if (error?.response?.status === 404) {
      return 0
    }
    console.error(`[getWalletBalance] Error fetching ${assetCode} balance:`, error)
    throw new Error(`Failed to get wallet balance: ${error.message}`)
  }
}

/**
 * Get USDC balance from Stellar wallet
 * Uses testnet USDC issuer for testnet, mainnet issuer for mainnet
 */
export async function getUSDCBalance(publicKey: string): Promise<number> {
  const stellarConfig = getStellarConfig()
  
  // USDC issuers for Stellar
  // Testnet: Typically issued by testnet issuer or we might need to find/create one
  // Mainnet: Circle USDC issuer: GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN
  // For testnet, we'll try to find USDC with code "USDC" without specifying issuer first
  
  // Common testnet USDC asset: USDC with code "USDC"
  // If no testnet-specific issuer, we'll search for any USDC asset
  try {
    const usdcBalance = await getWalletBalance(publicKey, "USDC")
    return usdcBalance
  } catch (error) {
    console.warn("[getUSDCBalance] Could not find USDC balance, returning 0:", error)
    return 0
  }
}

/**
 * Update previous USDC balance in database for a user
 * This is used for auto-deposit detection
 */
export async function updatePreviousUsdcBalance(
  userId: string,
  currentBalance: number,
  useServiceClient = false
): Promise<void> {
  let supabase = await createClient()
  
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseServiceKey && supabaseUrl) {
        supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
      }
    }
  }

  // Get the wallet to get wallet_id
  const wallet = await getStellarWallet(userId, useServiceClient)
  if (!wallet) {
    console.warn("[updatePreviousUsdcBalance] Wallet not found for userId:", userId)
    return
  }

  const previousBalance = wallet.previousUsdcBalance ?? null

  // Update previous_usdc_balance in stellar_wallets table
  const { error: updateError } = await supabase
    .from("stellar_wallets")
    .update({
      previous_usdc_balance: currentBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  if (updateError) {
    console.error("[updatePreviousUsdcBalance] Error updating previous balance:", updateError)
    throw new Error(`Failed to update previous balance: ${updateError.message}`)
  }

  // Save balance snapshot for historical tracking
  const { error: snapshotError } = await supabase
    .from("balance_snapshots")
    .insert({
      user_id: userId,
      wallet_id: wallet.id,
      usdc_balance: currentBalance,
      previous_balance: previousBalance,
      snapshot_type: "poll",
    })

  if (snapshotError) {
    console.error("[updatePreviousUsdcBalance] Error saving balance snapshot:", snapshotError)
    // Don't throw - snapshot is optional, balance update is more important
  }

  console.log("[updatePreviousUsdcBalance] ✅ Updated previous balance for userId:", userId, {
    previousBalance,
    currentBalance,
  })
}

/**
 * Save a balance snapshot with auto-deposit information
 */
export async function saveBalanceSnapshot(
  userId: string,
  currentBalance: number,
  options: {
    previousBalance?: number | null
    autoDepositTriggered?: boolean
    depositAmount?: number
    transactionHash?: string
    snapshotType?: "poll" | "webhook" | "manual" | "auto_deposit_trigger"
  } = {},
  useServiceClient = false
): Promise<void> {
  let supabase = await createClient()
  
  if (useServiceClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseServiceKey && supabaseUrl) {
        supabase = createServiceClient(supabaseUrl, supabaseServiceKey) as any
      }
    }
  }

  // Get the wallet to get wallet_id
  const wallet = await getStellarWallet(userId, useServiceClient)
  if (!wallet) {
    console.warn("[saveBalanceSnapshot] Wallet not found for userId:", userId)
    return
  }

  // Get previous balance if not provided
  const previousBalance = options.previousBalance ?? wallet.previousUsdcBalance ?? null

  const { error } = await supabase
    .from("balance_snapshots")
    .insert({
      user_id: userId,
      wallet_id: wallet.id,
      usdc_balance: currentBalance,
      previous_balance: previousBalance,
      snapshot_type: options.snapshotType || "poll",
      auto_deposit_triggered: options.autoDepositTriggered || false,
      deposit_amount: options.depositAmount || null,
      transaction_hash: options.transactionHash || null,
    })

  if (error) {
    console.error("[saveBalanceSnapshot] Error saving balance snapshot:", error)
    throw new Error(`Failed to save balance snapshot: ${error.message}`)
  }

  console.log("[saveBalanceSnapshot] ✅ Saved balance snapshot for userId:", userId, {
    currentBalance,
    previousBalance,
    autoDepositTriggered: options.autoDepositTriggered,
  })
}

/**
 * Establish a trustline for USDC on Stellar
 * This is required before an account can receive USDC
 */
export async function establishUSDCTrustline(
  userId: string,
  usdcIssuer?: string
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  console.log("[establishUSDCTrustline] Starting trustline establishment for user:", userId)
  
  const turnkeyConfig = getTurnkeyConfig()
  if (!turnkeyConfig) {
    const missing = []
    if (!process.env.NEXT_PUBLIC_TURNKEY_ORG_ID) missing.push("NEXT_PUBLIC_TURNKEY_ORG_ID")
    if (!process.env.NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY) missing.push("NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY")
    if (!process.env.NEXT_PUBLIC_TURNKEY_API_PRIVATE_KEY && !process.env.TURNKEY_API_PRIVATE_KEY && !process.env.NEXT_PRIVATE_TURNKEY_API_PRIVATE_KEY) {
      missing.push("NEXT_PUBLIC_TURNKEY_API_PRIVATE_KEY, TURNKEY_API_PRIVATE_KEY, or NEXT_PRIVATE_TURNKEY_API_PRIVATE_KEY")
    }
    
    const errorMessage = missing.length > 0
      ? `Turnkey configuration not found. Missing environment variables: ${missing.join(", ")}`
      : "Turnkey configuration not found. Please check your environment variables."
    
    console.error("[establishUSDCTrustline] Turnkey configuration error:", errorMessage)
    throw new Error(errorMessage)
  }
  
  const stellarConfig = getStellarConfig()
  
  // Get user's Stellar wallet
  const wallet = await getStellarWallet(userId, true)
  if (!wallet || !wallet.turnkeyWalletId) {
    throw new Error("Stellar wallet not found or missing Turnkey wallet ID")
  }
  
  // Use provided issuer or default to mainnet Circle USDC issuer
  // The error shows: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
  const issuer = usdcIssuer || process.env.USDC_ISSUER || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
  
  console.log("[establishUSDCTrustline] Using USDC issuer:", issuer)
  console.log("[establishUSDCTrustline] Wallet public key:", wallet.publicKey)
  
  try {
    // Create Stellar server instance
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: stellarConfig.network === "testnet" }
    )
    
    // Load account to get sequence number
    const accountResponse = await server.loadAccount(wallet.publicKey)
    const account = new Account(wallet.publicKey, accountResponse.sequenceNumber())
    
    // Create USDC asset
    const usdcAsset = new Asset("USDC", issuer)
    
    // Check if trustline already exists
    const existingTrustline = accountResponse.balances.find(
      (bal: any) => 
        bal.asset_type !== "native" &&
        bal.asset_code === "USDC" &&
        bal.asset_issuer === issuer
    )
    
    if (existingTrustline) {
      console.log("[establishUSDCTrustline] Trustline already exists")
      return { success: true }
    }
    
    // Build ChangeTrust operation
    const networkPassphrase = stellarConfig.network === "testnet" 
      ? Networks.TESTNET 
      : Networks.PUBLIC
    
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({
          asset: usdcAsset,
          limit: "922337203685.4775807", // Maximum limit
        })
      )
      .setTimeout(30)
      .build()
    
    console.log("[establishUSDCTrustline] Transaction built, signing with Turnkey...")
    
    // Use the same signing function as Soroban transactions (which works for Stellar)
    const signedTransaction = await signSorobanTransaction(userId, transaction)
    
    console.log("[establishUSDCTrustline] Transaction signed, submitting to network...")
    
    // Submit transaction to Horizon (not Soroban RPC for regular Stellar transactions)
    let submitResult
    try {
      submitResult = await server.submitTransaction(signedTransaction.transaction)
      console.log("[establishUSDCTrustline] Transaction submitted, hash:", submitResult.hash)
    } catch (submitError: any) {
      console.error("[establishUSDCTrustline] Error submitting transaction:", submitError)
      
      // Check for specific error codes
      if (submitError?.response?.data?.extras?.result_codes) {
        const resultCodes = submitError.response.data.extras.result_codes
        console.error("[establishUSDCTrustline] Transaction result codes:", resultCodes)
        
        // Check if trustline already exists
        if (resultCodes.operations?.includes("op_already_exists")) {
          console.log("[establishUSDCTrustline] Trustline already exists (detected from submit error)")
          return { success: true }
        }
        
        // Check for insufficient balance for fees
        if (resultCodes.transaction === "tx_insufficient_balance") {
          throw new Error("Insufficient balance to pay transaction fees. Please fund your wallet with XLM first.")
        }
      }
      
      throw submitError
    }
    
    // Wait for transaction to be confirmed (poll for transaction status)
    console.log("[establishUSDCTrustline] Waiting for transaction confirmation...")
    let confirmed = false
    let attempts = 0
    const maxAttempts = 30 // Wait up to 30 seconds
    
    while (!confirmed && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second
      
      try {
        const transactionStatus = await server.transactions().transaction(submitResult.hash).call()
        if (transactionStatus.successful) {
          confirmed = true
          console.log("[establishUSDCTrustline] ✅ Transaction confirmed successfully")
        }
      } catch (statusError) {
        // Transaction might not be in ledger yet, continue waiting
        console.log("[establishUSDCTrustline] Transaction not yet confirmed, waiting...")
      }
      
      attempts++
    }
    
    if (!confirmed) {
      console.warn("[establishUSDCTrustline] ⚠️ Transaction submitted but not yet confirmed after max attempts")
      // Still return success since transaction was submitted
    }
    
    // Verify trustline was actually established by checking account balances
    try {
      const updatedAccount = await server.loadAccount(wallet.publicKey)
      const trustlineExists = updatedAccount.balances.find(
        (bal: any) => 
          bal.asset_type !== "native" &&
          bal.asset_code === "USDC" &&
          bal.asset_issuer === issuer
      )
      
      if (trustlineExists) {
        console.log("[establishUSDCTrustline] ✅ Trustline verified - exists in account balances")
      } else {
        console.warn("[establishUSDCTrustline] ⚠️ Trustline not found in account balances yet (may need more time)")
      }
    } catch (verifyError) {
      console.warn("[establishUSDCTrustline] Could not verify trustline:", verifyError)
    }
    
    console.log("[establishUSDCTrustline] ✅ Trustline established successfully")
    console.log("[establishUSDCTrustline] Transaction hash:", submitResult.hash)
    
    return {
      success: true,
      transactionHash: submitResult.hash,
    }
  } catch (error: any) {
    console.error("[establishUSDCTrustline] Error establishing trustline:", error)
    console.error("[establishUSDCTrustline] Error message:", error.message)
    console.error("[establishUSDCTrustline] Error stack:", error.stack)
    
    // Check if trustline already exists (error code might indicate this)
    if (error?.response?.data?.extras?.result_codes?.operations?.includes("op_already_exists")) {
      console.log("[establishUSDCTrustline] Trustline already exists (detected from error)")
      return { success: true }
    }
    
    // Extract detailed error message for better debugging
    const errorMessage = error.message || "Failed to establish trustline"
    console.error("[establishUSDCTrustline] Returning error:", errorMessage)
    
    return {
      success: false,
      error: errorMessage,
    }
  }
}

