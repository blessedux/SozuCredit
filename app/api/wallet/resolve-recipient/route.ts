import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const corsHeaders = (request: NextRequest) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
})

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  try {
    const { recipient } = await request.json()
    const userId = request.headers.get("x-user-id")

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Check if recipient is a Stellar address (starts with G and is 56 chars)
    const isStellarAddress = /^G[A-Z0-9]{55}$/.test(recipient)
    
    if (isStellarAddress) {
      return NextResponse.json(
        { walletAddress: recipient },
        { headers: corsHeaders(request) }
      )
    }

    // Otherwise, treat as Sozu tag and look up wallet
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Find profile by username (Sozu tag)
    // Username should be case-sensitive and exact match
    console.log("[Resolve Recipient] Looking up profile for Sozu tag:", recipient)
    
    // Try exact match first (case-sensitive)
    let { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, username")
      .eq("username", recipient.trim())
      .maybeSingle()
    
    // If not found, try case-insensitive match (for debugging)
    if (!profile && !profileError) {
      console.log("[Resolve Recipient] Exact match not found, trying case-insensitive...")
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, username")
        .ilike("username", recipient.trim())
        .limit(5)
      
      if (profiles && profiles.length > 0) {
        console.log("[Resolve Recipient] Found profiles with case-insensitive match:", profiles.map(p => ({ id: p.id, username: p.username })))
        // Use exact match if available, otherwise use first result
        profile = profiles.find(p => p.username === recipient.trim()) || profiles[0]
        console.log("[Resolve Recipient] Using profile:", { id: profile.id, username: profile.username })
      }
    }

    if (profileError) {
      console.error("[Resolve Recipient] Error finding profile:", profileError)
      return NextResponse.json(
        { error: "Recipient not found. Please check the Sozu tag or wallet address." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    if (!profile) {
      console.log("[Resolve Recipient] Profile not found for username:", recipient)
      return NextResponse.json(
        { error: "Recipient not found. Please check the Sozu tag or wallet address." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    console.log("[Resolve Recipient] ✅ Profile found:", {
      profileId: profile.id,
      username: profile.username
    })

    // Get wallet address for this user
    // IMPORTANT: Always get the most recent wallet (by updated_at DESC, then created_at DESC)
    // This ensures we get the actual current wallet, not an old one from previous integrations
    console.log("[Resolve Recipient] Looking up wallet for user_id:", profile.id)
    
    // First, check if there are multiple wallets (shouldn't happen due to unique constraint, but let's verify)
    const { data: allWallets, error: checkError } = await serviceClient
      .from("stellar_wallets")
      .select("id, public_key, user_id, created_at, updated_at, network, turnkey_wallet_id")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
    
    if (checkError) {
      console.error("[Resolve Recipient] Error checking wallets:", checkError)
      return NextResponse.json(
        { error: "Failed to lookup recipient wallet. Please try again." },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    // Always log all wallets found for debugging
    if (allWallets && allWallets.length > 0) {
      console.log(`[Resolve Recipient] Found ${allWallets.length} wallet(s) for user_id: ${profile.id}, username: ${recipient}`)
      // Sort by updated_at DESC, then created_at DESC (client-side since Supabase doesn't support multiple orderings)
      allWallets.sort((a, b) => {
        const updatedDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        if (updatedDiff !== 0) return updatedDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      allWallets.forEach((w, i) => {
        console.log(`[Resolve Recipient]   Wallet ${i + 1}/${allWallets.length}:`, {
          id: w.id,
          publicKey: w.public_key ? w.public_key.substring(0, 10) + "..." + w.public_key.substring(w.public_key.length - 10) : "NULL",
          fullPublicKey: w.public_key, // Log full key for debugging
          createdAt: w.created_at,
          updatedAt: w.updated_at,
          network: w.network,
          turnkeyWalletId: w.turnkey_wallet_id ? w.turnkey_wallet_id.substring(0, 20) + "..." : null
        })
      })
      
      if (allWallets.length > 1) {
        console.warn("[Resolve Recipient] ⚠️ Multiple wallets found - will check which ones exist on network")
      }
    } else {
      console.log("[Resolve Recipient] No wallets found for user_id:", profile.id, "username:", recipient)
      return NextResponse.json(
        { error: "Recipient wallet not found. They may not have created a wallet yet." },
        { status: 404, headers: corsHeaders(request) }
      )
    }
    
    // Get all wallets and find one that exists on the network
    // Priority: 1) Wallets that exist on network, 2) Most recent by updated_at
    let wallet: any = null
    
    if (allWallets && allWallets.length > 0) {
      // Sort all wallets by updated_at DESC, then created_at DESC
      allWallets.sort((a, b) => {
        const updatedDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        if (updatedDiff !== 0) return updatedDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      
      console.log("[Resolve Recipient] Checking which wallets exist on the network...")
      console.log("[Resolve Recipient] Total wallets to check:", allWallets.length)
      allWallets.forEach((w, i) => {
        console.log(`[Resolve Recipient] Wallet ${i + 1}:`, {
          publicKey: w.public_key.substring(0, 10) + "..." + w.public_key.substring(w.public_key.length - 10),
          fullPublicKey: w.public_key, // Log full key for debugging
          updatedAt: w.updated_at,
          createdAt: w.created_at,
          network: w.network
        })
      })
      
      const { Horizon } = await import("@stellar/stellar-sdk")
      const { getStellarConfig } = await import("@/lib/turnkey/config")
      const stellarConfig = getStellarConfig()
      const server = new Horizon.Server(
        stellarConfig.horizonUrl,
        { allowHttp: stellarConfig.network === "testnet" }
      )
      
      // Try to find a wallet that exists on the network
      // Priority: 1) Wallets with USDC trustline/balance (active wallets), 2) Any wallet that exists
      let walletsWithUSDC: any[] = []
      
      for (let i = 0; i < allWallets.length; i++) {
        const w = allWallets[i]
        console.log(`[Resolve Recipient] Checking wallet ${i + 1}/${allWallets.length} on network:`, {
          publicKey: w.public_key.substring(0, 10) + "..." + w.public_key.substring(w.public_key.length - 10),
          fullPublicKey: w.public_key, // Log full key for debugging
          network: stellarConfig.network,
          horizonUrl: stellarConfig.horizonUrl
        })
        
        try {
          const account = await server.loadAccount(w.public_key)
          const hasUSDC = account.balances.some((b: any) => b.asset_code === "USDC")
          const usdcBalance = account.balances.find((b: any) => b.asset_code === "USDC")
          
          console.log("[Resolve Recipient] ✅ Found wallet that exists on network:", {
            publicKey: w.public_key.substring(0, 10) + "..." + w.public_key.substring(w.public_key.length - 10),
            fullPublicKey: w.public_key, // Log full key for debugging
            sequence: account.sequenceNumber(),
            balances: account.balances.length,
            hasXLM: account.balances.some((b: any) => b.asset_type === "native"),
            hasUSDC: hasUSDC,
            usdcBalance: usdcBalance ? usdcBalance.balance : "0"
          })
          
          const walletData = {
            public_key: w.public_key,
            user_id: w.user_id,
            created_at: w.created_at,
            updated_at: w.updated_at,
            network: w.network
          }
          
          // If wallet has USDC trustline/balance, prioritize it
          if (hasUSDC) {
            console.log("[Resolve Recipient] ⭐ Wallet has USDC trustline - prioritizing this wallet")
            walletsWithUSDC.push(walletData)
          } else if (!wallet) {
            // Store first wallet that exists (as fallback if none have USDC)
            wallet = walletData
          }
        } catch (error: any) {
          const isNotFound = error?.response?.status === 404 || 
                            error?.message?.includes("404") || 
                            error?.message?.includes("Not Found")
          if (isNotFound) {
            console.log("[Resolve Recipient] ❌ Wallet doesn't exist on network:", {
              publicKey: w.public_key.substring(0, 10) + "..." + w.public_key.substring(w.public_key.length - 10),
              fullPublicKey: w.public_key, // Log full key for debugging
              error: error.message
            })
            continue // Try next wallet
          } else {
            // Network error - assume it exists and use it (but don't prioritize if no USDC)
            console.warn("[Resolve Recipient] ⚠️ Network error checking wallet, assuming it exists:", {
              publicKey: w.public_key.substring(0, 10) + "..." + w.public_key.substring(w.public_key.length - 10),
              fullPublicKey: w.public_key, // Log full key for debugging
              error: error.message
            })
            if (!wallet) {
              wallet = {
                public_key: w.public_key,
                user_id: w.user_id,
                created_at: w.created_at,
                updated_at: w.updated_at,
                network: w.network
              }
            }
          }
        }
      }
      
      // If we found wallets with USDC, use the most recent one (by updated_at)
      if (walletsWithUSDC.length > 0) {
        console.log(`[Resolve Recipient] ✅ Found ${walletsWithUSDC.length} wallet(s) with USDC trustline - using the most recent one`)
        // Sort by updated_at DESC to get the most recent
        walletsWithUSDC.sort((a, b) => {
          const updatedDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          if (updatedDiff !== 0) return updatedDiff
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        wallet = walletsWithUSDC[0]
        console.log("[Resolve Recipient] ✅ Selected wallet with USDC:", {
          publicKey: wallet.public_key.substring(0, 10) + "..." + wallet.public_key.substring(wallet.public_key.length - 10),
          fullPublicKey: wallet.public_key, // Log full key for debugging
          updatedAt: wallet.updated_at
        })
      } else if (wallet) {
        console.log("[Resolve Recipient] ⚠️ No wallets with USDC found, using first wallet that exists on network")
      }
      
      // If no wallet exists on network, return an error instead of returning a non-existent wallet
      if (!wallet && allWallets.length > 0) {
        const mostRecent = allWallets[0]
        // Get stellar config for logging
        const { getStellarConfig } = await import("@/lib/turnkey/config")
        const stellarConfigForLog = getStellarConfig()
        
        console.error("[Resolve Recipient] ❌ No wallets exist on network for this user:", {
          username: recipient,
          profileId: profile.id,
          totalWallets: allWallets.length,
          mostRecentWallet: {
            publicKey: mostRecent.public_key.substring(0, 10) + "..." + mostRecent.public_key.substring(mostRecent.public_key.length - 10),
            fullPublicKey: mostRecent.public_key, // Log full key for debugging
            updatedAt: mostRecent.updated_at,
            createdAt: mostRecent.created_at,
            network: mostRecent.network
          },
          network: stellarConfigForLog.network,
          horizonUrl: stellarConfigForLog.horizonUrl
        })
        console.error("[Resolve Recipient] All wallets checked:")
        allWallets.forEach((w, i) => {
          console.error(`[Resolve Recipient]   Wallet ${i + 1}: ${w.public_key} (updated: ${w.updated_at})`)
        })
        
        // Return an error with details about which wallets were checked
        return NextResponse.json(
          { 
            error: "The recipient's wallet doesn't exist on the Stellar network. They need to create and fund their wallet first.",
            details: {
              username: recipient,
              totalWalletsInDatabase: allWallets.length,
              walletsChecked: allWallets.map(w => ({
                publicKey: w.public_key,
                network: w.network,
                updatedAt: w.updated_at,
                createdAt: w.created_at
              })),
              network: stellarConfigForLog.network,
              suggestion: "Please ask the recipient to create and fund their wallet with at least 1 XLM before sending payments."
            }
          },
          { status: 404, headers: corsHeaders(request) }
        )
      }
    } else {
      // Fallback: query directly if allWallets wasn't populated
      const { data: walletData, error: walletError } = await serviceClient
        .from("stellar_wallets")
        .select("public_key, user_id, created_at, updated_at, network")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (walletError) {
        console.error("[Resolve Recipient] Error finding wallet:", walletError)
        return NextResponse.json(
          { error: "Recipient wallet not found. They may not have created a wallet yet." },
          { status: 404, headers: corsHeaders(request) }
        )
      }
      
      if (!walletData) {
        console.log("[Resolve Recipient] No wallet found for user_id:", profile.id)
        return NextResponse.json(
          { error: "Recipient wallet not found. They may not have created a wallet yet." },
          { status: 404, headers: corsHeaders(request) }
        )
      }
      
      wallet = walletData
    }

    if (!wallet) {
      console.log("[Resolve Recipient] No wallet found for user_id:", profile.id)
      return NextResponse.json(
        { error: "Recipient wallet not found. They may not have created a wallet yet." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    // Validate wallet data
    if (!wallet.public_key || wallet.public_key.length !== 56 || !wallet.public_key.startsWith("G")) {
      console.error("[Resolve Recipient] ❌ Invalid wallet public_key format:", {
        publicKey: wallet.public_key ? wallet.public_key.substring(0, 20) + "..." : "NULL",
        length: wallet.public_key?.length
      })
      return NextResponse.json(
        { error: "Invalid wallet address format. Please contact support." },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    console.log("[Resolve Recipient] ✅ Wallet found in database:", {
      publicKey: wallet.public_key.substring(0, 10) + "..." + wallet.public_key.substring(wallet.public_key.length - 10),
      fullPublicKey: wallet.public_key, // Log full key for debugging
      userId: wallet.user_id,
      network: wallet.network,
      createdAt: wallet.created_at,
      updatedAt: wallet.updated_at
    })

    // Verify the wallet belongs to the correct user
    if (wallet.user_id !== profile.id) {
      console.error("[Resolve Recipient] ❌ Wallet user_id mismatch!", {
        walletUserId: wallet.user_id,
        profileId: profile.id
      })
      return NextResponse.json(
        { error: "Wallet lookup error. Please try again." },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    // Final verification: confirm the selected wallet exists on the network
    // (We already checked during selection, but verify one more time for logging)
    try {
      const { Horizon } = await import("@stellar/stellar-sdk")
      const { getStellarConfig } = await import("@/lib/turnkey/config")
      const stellarConfig = getStellarConfig()
      const server = new Horizon.Server(
        stellarConfig.horizonUrl,
        { allowHttp: stellarConfig.network === "testnet" }
      )

      console.log("[Resolve Recipient] Final verification - wallet exists on Stellar network:", wallet.public_key.substring(0, 10) + "...")
      const account = await server.loadAccount(wallet.public_key)
      console.log("[Resolve Recipient] ✅ Wallet verified on network - account exists:", {
        sequence: account.sequenceNumber(),
        balances: account.balances.length,
        hasXLM: account.balances.some((b: any) => b.asset_type === "native"),
        hasUSDC: account.balances.some((b: any) => b.asset_code === "USDC")
      })
    } catch (networkError: any) {
      const isNotFound = networkError?.response?.status === 404 || 
                        networkError?.message?.includes("404") || 
                        networkError?.message?.includes("Not Found") ||
                        networkError?.constructor?.name === "NotFoundError"
      
      if (isNotFound) {
        console.error("[Resolve Recipient] ❌ Selected wallet doesn't exist on network!", {
          publicKey: wallet.public_key,
          username: recipient,
          profileId: profile.id
        })
        // This shouldn't happen since we checked during selection, but log it
        console.error("[Resolve Recipient] This means all wallets for this user don't exist on the network")
      } else {
        // Other error (network issue, etc.) - log but don't fail
        console.warn("[Resolve Recipient] ⚠️ Could not verify wallet on network (non-fatal):", networkError.message)
      }
    }

    // Return the full public key (this is the actual wallet address)
    console.log("[Resolve Recipient] ✅ Returning wallet address:", wallet.public_key.substring(0, 10) + "...")
    return NextResponse.json(
      { walletAddress: wallet.public_key },
      { headers: corsHeaders(request) }
    )
  } catch (error: any) {
    console.error("[Resolve Recipient] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to resolve recipient" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
