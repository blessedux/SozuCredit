import { getTurnkeyClient } from "./client"
import { getTurnkeyConfig, getStellarConfig } from "./config"
import { createActivityPoller } from "@turnkey/http"
import { Horizon } from "@stellar/stellar-sdk"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export interface StellarWallet {
  id: string
  userId: string
  turnkeyWalletId: string
  publicKey: string
  network: "testnet" | "mainnet"
  createdAt: string
  updatedAt: string
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

  const { data, error } = await supabase
    .from("stellar_wallets")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null
    }
    throw new Error(`Failed to get wallet: ${error.message}`)
  }

  if (!data) {
    return null
  }

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

  console.log("[storeStellarWallet] Inserting wallet:", {
    userId,
    turnkeyWalletId,
    publicKey: publicKey ? `${publicKey.substring(0, 10)}...` : null,
    publicKeyLength: publicKey?.length || 0,
    network: stellarConfig.network,
  })

  const { data, error } = await supabase
    .from("stellar_wallets")
    .insert({
      user_id: userId,
      turnkey_wallet_id: turnkeyWalletId,
      public_key: publicKey,
      network: stellarConfig.network,
    })
    .select()
    .single()

  if (error) {
    console.error("[storeStellarWallet] Insert error:", error)
    throw new Error(`Failed to store wallet: ${error.message}`)
  }

  if (!data) {
    console.error("[storeStellarWallet] No data returned from insert")
    throw new Error("Failed to store wallet: No data returned")
  }

  console.log("[storeStellarWallet] Wallet inserted successfully:", {
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
 * Get wallet balance from Stellar network
 */
export async function getWalletBalance(publicKey: string): Promise<number> {
  const stellarConfig = getStellarConfig()

  try {
    // Create Stellar server instance
    const server = new Horizon.Server(
      stellarConfig.horizonUrl,
      { allowHttp: stellarConfig.network === "testnet" }
    )

    // Load account from Stellar network
    const account = await server.loadAccount(publicKey)

    // Get XLM balance (native Stellar asset)
    const xlmBalance = account.balances.find(
      (balance: any) => balance.asset_type === "native"
    )

    if (!xlmBalance) {
      return 0
    }

    return parseFloat(xlmBalance.balance)
  } catch (error: any) {
    // If account doesn't exist or has no balance, return 0
    if (error?.response?.status === 404) {
      return 0
    }
    console.error("[getWalletBalance] Error fetching balance:", error)
    throw new Error(`Failed to get wallet balance: ${error.message}`)
  }
}

