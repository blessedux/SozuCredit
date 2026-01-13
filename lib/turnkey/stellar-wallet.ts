import { getTurnkeyClient } from "./client"
import { getTurnkeyConfig, getStellarConfig } from "./config"
import { createActivityPoller } from "@turnkey/http"
import { Horizon, Asset, TransactionBuilder, Networks, Operation, BASE_FEE } from "@stellar/stellar-sdk"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export interface StellarWallet {
  id: string
  userId: string
  turnkeyWalletId?: string | null // Optional: null for wallets created with Stellar SDK
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

    // Note: USDC trustline will be created after wallet is funded
    // We'll create it in storeStellarWallet or via a separate API call
    // This is because trustlines require the account to exist and have XLM for fees

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
  
  // First, check if there are multiple wallets (shouldn't happen due to unique constraint, but let's verify)
  // Order by updated_at first (most recently updated), then created_at (most recently created)
  const { data: allWallets, error: checkError } = await supabase
    .from("stellar_wallets")
    .select("id, public_key, user_id, created_at, updated_at, network, turnkey_wallet_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  
  if (checkError) {
    console.error("[getStellarWallet] Error checking wallets:", checkError)
  } else if (allWallets && allWallets.length > 1) {
    console.warn("[getStellarWallet] ⚠️ Multiple wallets found for userId:", userId, "Count:", allWallets.length)
    // Sort by updated_at DESC, then created_at DESC (client-side since Supabase doesn't support multiple orderings)
    allWallets.sort((a, b) => {
      const updatedDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      if (updatedDiff !== 0) return updatedDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    allWallets.forEach((w, i) => {
      console.warn(`[getStellarWallet]   Wallet ${i + 1}:`, {
        id: w.id,
        publicKey: w.public_key ? w.public_key.substring(0, 10) + "..." + w.public_key.substring(w.public_key.length - 10) : "NULL",
        fullPublicKey: w.public_key, // Log full key for debugging
        createdAt: w.created_at,
        updatedAt: w.updated_at,
        network: w.network,
        turnkeyWalletId: w.turnkey_wallet_id ? w.turnkey_wallet_id.substring(0, 20) + "..." : null
      })
    })
  }
  
  // Get the most recent wallet (by updated_at DESC, then created_at DESC)
  // This ensures we always get the actual current wallet, not an old one
  // Note: We order by updated_at first since it reflects the most recent activity
  const { data, error } = await supabase
    .from("stellar_wallets")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle() // Use maybeSingle instead of single to avoid errors when no row found
  
  // If we got a result, but there are multiple wallets, verify we got the most recent one
  if (data && allWallets && allWallets.length > 1) {
    // Sort all wallets by updated_at DESC, then created_at DESC
    allWallets.sort((a, b) => {
      const updatedDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      if (updatedDiff !== 0) return updatedDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    const mostRecent = allWallets[0]
    if (mostRecent.id !== data.id) {
      console.warn("[getStellarWallet] ⚠️ Query returned wallet that's not the most recent! Using most recent instead.")
      // Use the most recent wallet instead
      const { data: correctWallet } = await supabase
        .from("stellar_wallets")
        .select("*")
        .eq("id", mostRecent.id)
        .single()
      if (correctWallet) {
        return {
          id: correctWallet.id,
          userId: correctWallet.user_id,
          turnkeyWalletId: correctWallet.turnkey_wallet_id || null,
          publicKey: correctWallet.public_key,
          network: correctWallet.network,
          createdAt: correctWallet.created_at,
          updatedAt: correctWallet.updated_at,
          previousUsdcBalance: correctWallet.previous_usdc_balance ? Number(correctWallet.previous_usdc_balance) : null,
        } as StellarWallet
      }
    }
  }

  if (error) {
    console.error("[getStellarWallet] Error querying wallet for userId:", userId, "Error:", error)
    // Don't throw - just return null if there's an error
      return null
  }

  if (!data) {
    console.log("[getStellarWallet] No wallet found for userId:", userId)
    return null
  }
  
  // Validate wallet data
  if (!data.public_key || data.public_key.length !== 56 || !data.public_key.startsWith("G")) {
    console.error("[getStellarWallet] ❌ Invalid wallet public_key format:", {
      publicKey: data.public_key ? data.public_key.substring(0, 20) + "..." : "NULL",
      length: data.public_key?.length
    })
    return null
  }

  console.log("[getStellarWallet] ✅ Wallet found for userId:", userId, {
    publicKey: data.public_key ? `${data.public_key.substring(0, 10)}...${data.public_key.substring(data.public_key.length - 10)}` : "NULL",
    fullPublicKey: data.public_key, // Log full key for debugging
    wallet_id: data.id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    network: data.network,
    turnkeyWalletId: data.turnkey_wallet_id ? `${data.turnkey_wallet_id.substring(0, 20)}...` : null
  })

  // Map database column names to TypeScript property names
  return {
    id: data.id,
    userId: data.user_id,
    turnkeyWalletId: data.turnkey_wallet_id || null, // Handle null values
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
  turnkeyWalletId: string | null,
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
  const upsertData: any = {
      user_id: userId,
      public_key: publicKey,
      network: stellarConfig.network,
      updated_at: new Date().toISOString(),
    }
  
  // Only include turnkey_wallet_id if it's not null
  if (turnkeyWalletId !== null) {
    upsertData.turnkey_wallet_id = turnkeyWalletId
  }

  const { data, error } = await supabase
    .from("stellar_wallets")
    .upsert(upsertData, {
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
    turnkeyWalletId: data.turnkey_wallet_id || "null",
    publicKey: data.public_key ? `${data.public_key.substring(0, 10)}...` : null,
    publicKeyLength: data.public_key?.length || 0,
    network: data.network,
  })

  // Map database column names to TypeScript property names
  return {
    id: data.id,
    userId: data.user_id,
    turnkeyWalletId: data.turnkey_wallet_id || null, // Handle null values
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

    // Log all balances for debugging (especially for USDC)
    if (assetCode === "USDC") {
      console.log(`[getWalletBalance] 🔍 Checking USDC balance for ${publicKey.substring(0, 10)}...`)
      console.log(`[getWalletBalance] Network: ${stellarConfig.network}`)
      console.log(`[getWalletBalance] Looking for issuer: ${assetIssuer ? assetIssuer.substring(0, 20) + "..." : "ANY"}`)
      console.log(`[getWalletBalance] All account balances:`, account.balances.map((b: any) => ({
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
          console.warn(`[getWalletBalance] ⚠️ No USDC balance found with issuer ${assetIssuer.substring(0, 20)}...`)
          console.warn(`[getWalletBalance] Available non-native assets:`, account.balances
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
          console.log(`[getWalletBalance] ✅ Found USDC without issuer check:`, balance.balance, `(issuer: ${issuer ? issuer.substring(0, 20) + "..." : "N/A"})`)
        }
      }
    }

    if (!balance) {
      if (assetCode === "USDC") {
        console.warn(`[getWalletBalance] ❌ No ${assetCode} balance found${assetIssuer ? ` with issuer ${assetIssuer.substring(0, 20)}...` : ''}`)
      }
      return 0
    }

    const balanceValue = parseFloat(balance.balance)
    if (assetCode === "USDC") {
      const issuer = (balance as any).asset_issuer
      console.log(`[getWalletBalance] ✅ Found ${assetCode} balance:`, balanceValue, assetIssuer ? `(issuer: ${assetIssuer.substring(0, 20)}...)` : `(issuer: ${issuer ? issuer.substring(0, 20) + "..." : "N/A"})`)
    }
    return balanceValue
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
  const usdcIssuer = USDC_ISSUERS[stellarConfig.network]
  
  console.log("[getUSDCBalance] Fetching USDC balance:", {
    publicKey: publicKey.substring(0, 10) + "...",
    network: stellarConfig.network,
    issuer: usdcIssuer,
  })
  
  try {
    // Try with specific issuer first
    const usdcBalance = await getWalletBalance(publicKey, "USDC", usdcIssuer)
    console.log("[getUSDCBalance] ✅ USDC balance found:", usdcBalance, "with issuer:", usdcIssuer)
    return usdcBalance
  } catch (error) {
    console.warn("[getUSDCBalance] Could not find USDC balance with issuer, trying without issuer:", error)
    // Fallback: try without issuer (in case there's a different USDC asset)
    try {
      const usdcBalance = await getWalletBalance(publicKey, "USDC")
      console.log("[getUSDCBalance] ✅ USDC balance found (without issuer):", usdcBalance)
      return usdcBalance
    } catch (fallbackError) {
      console.warn("[getUSDCBalance] Could not find USDC balance, returning 0:", fallbackError)
      return 0
    }
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
 * USDC issuers for Stellar network
 */
const USDC_ISSUERS = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", // Stellar testnet USDC issuer
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", // Circle mainnet USDC issuer
}

/**
 * Create USDC trustline for a Stellar wallet
 * This allows the wallet to receive and hold USDC
 */
export async function createUSDCTrustline(
  userId: string,
  publicKey: string
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  console.log("[createUSDCTrustline] Starting trustline creation for user:", userId, "publicKey:", publicKey.substring(0, 10) + "...")

  try {
    const stellarConfig = getStellarConfig()
    const turnkeyConfig = getTurnkeyConfig()
    
    if (!turnkeyConfig) {
      throw new Error("Turnkey configuration not found")
    }

    // Get user's wallet to access Turnkey wallet ID
    const wallet = await getStellarWallet(userId, true)
    if (!wallet || !wallet.turnkeyWalletId) {
      throw new Error("Stellar wallet not found or missing Turnkey wallet ID")
    }

    // Get USDC issuer for the network
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
        console.warn("[createUSDCTrustline] Account not found yet, account may need to be funded first")
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
      console.log("[createUSDCTrustline] ✅ USDC trustline already exists for publicKey:", publicKey.substring(0, 10) + "...")
      return { success: true }
    }

    // Build change trust operation
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

    console.log("[createUSDCTrustline] Transaction built, signing with Turnkey...")

    // Sign transaction using Turnkey
    const client = getTurnkeyClient()
    const transactionXdr = transaction.toXDR()
    const transactionBytes = Buffer.from(transactionXdr, "base64")

    const requestBody = {
      type: "ACTIVITY_TYPE_SIGN_TRANSACTION",
      timestampMs: Date.now().toString(),
      organizationId: turnkeyConfig.organizationId,
      parameters: {
        signWith: wallet.turnkeyWalletId,
        unsignedTransaction: transactionBytes.toString("base64"),
      },
    }

    let activity
    try {
      const initialResponse = await client.signTransaction({
        body: requestBody,
      } as any)
      
      activity = initialResponse.activity
      
      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        const signTransactionPoller = createActivityPoller({
          client,
          requestFn: client.signTransaction,
          refreshIntervalMs: 500,
        })
        
        activity = await signTransactionPoller({
          body: requestBody,
        } as any)
      }
    } catch (error: any) {
      console.error("[createUSDCTrustline] Error with body wrapper:", error.message)
      
      const initialResponse = await client.signTransaction(requestBody as any)
      activity = initialResponse.activity
      
      if (activity.status !== "ACTIVITY_STATUS_COMPLETED") {
        const signTransactionPoller = createActivityPoller({
          client,
          requestFn: client.signTransaction,
          refreshIntervalMs: 500,
        })
        
        activity = await signTransactionPoller(requestBody as any)
      }
    }

    if (!activity.result?.signTransactionResult?.signedTransaction) {
      throw new Error("Turnkey did not return a signed transaction")
    }

    const signedTransactionXdr = activity.result.signTransactionResult.signedTransaction
    const signedTransaction = TransactionBuilder.fromXDR(signedTransactionXdr, networkPassphrase)

    console.log("[createUSDCTrustline] Transaction signed, submitting to network...")

    // Submit transaction to network
    const response = await server.submitTransaction(signedTransaction)
    
    console.log("[createUSDCTrustline] ✅ USDC trustline created successfully")
    console.log("[createUSDCTrustline] Transaction hash:", response.hash)

    return {
      success: true,
      transactionHash: response.hash,
    }
  } catch (error) {
    console.error("[createUSDCTrustline] Error creating USDC trustline:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

