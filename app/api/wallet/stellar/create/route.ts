import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { storeStellarWallet, getStellarWallet, deleteStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { createStellarWalletServerSide } from "@/lib/stellar/wallet-server"
import { createUSDCTrustlineServerSide } from "@/lib/stellar/trustline-server"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    let userId: string | null = null

    if (user) {
      userId = user.id
      console.log("[Stellar Wallet API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers
      userId = request.headers.get("x-user-id")
      console.log("[Stellar Wallet API] Dev mode, userId from header:", userId)

      if (!userId) {
        console.error("[Stellar Wallet API] No userId provided")
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: corsHeaders(request as any) }
        )
      }
    }

    // Check if wallet already exists (use service client if no authenticated user)
    const existingWallet = await getStellarWallet(userId, !user)
    if (existingWallet) {
      // Check if wallet has a valid publicKey
      if (existingWallet.publicKey && existingWallet.publicKey.trim().length > 0) {
        console.log("[Stellar Wallet API] Wallet already exists for user, returning existing wallet:", existingWallet.publicKey.substring(0, 10) + "...")
        return NextResponse.json(
          {
            walletId: existingWallet.turnkeyWalletId || existingWallet.publicKey, // Use public key as wallet ID if no Turnkey ID
            publicKey: existingWallet.publicKey,
            network: existingWallet.network,
          },
          { headers: corsHeaders(request as any) }
        )
      } else {
        // Wallet exists but has no publicKey - this shouldn't happen, but handle it
        console.warn("[Stellar Wallet API] Wallet exists but has no publicKey, this should not happen. Attempting to update...")
        // For now, just log an error - the wallet should not be in this state
        console.error("[Stellar Wallet API] Cannot fix wallet without publicKey automatically. Manual intervention required.")
        return NextResponse.json(
          {
            error: "Wallet exists but is in an invalid state. Please contact support.",
            walletId: existingWallet.turnkeyWalletId || existingWallet.publicKey,
            publicKey: null,
            network: existingWallet.network,
          },
          { status: 500, headers: corsHeaders(request as any) }
        )
      }
    }

    // Create new wallet using Stellar SDK (no Turnkey)
    console.log("[Stellar Wallet API] Creating Stellar wallet for user:", userId)
    const wallet = await createStellarWalletServerSide(userId)
    console.log("[Stellar Wallet API] Wallet created with Stellar SDK:", {
      walletId: wallet.walletId,
      publicKey: wallet.publicKey,
      publicKeyLength: wallet.publicKey?.length || 0,
    })
    
    // Wallet is already stored in createStellarWalletServerSide, but get it to return
    const storedWallet = await getStellarWallet(userId, !user)
    if (!storedWallet) {
      throw new Error("Failed to retrieve stored wallet")
    }

    console.log("[Stellar Wallet API] Wallet stored in database:", {
      id: storedWallet.id,
      turnkeyWalletId: storedWallet.turnkeyWalletId || "null (Stellar SDK wallet)",
      publicKey: storedWallet.publicKey,
      publicKeyLength: storedWallet.publicKey?.length || 0,
      network: storedWallet.network,
    })

    // Validate that the stored wallet has a publicKey
    if (!storedWallet.publicKey) {
      console.error("[Stellar Wallet API] Stored wallet missing publicKey!", storedWallet)
      throw new Error("Stored wallet is missing publicKey. Database constraint may have failed.")
    }

    // Attempt to create USDC trustline (non-blocking)
    // This will only succeed if the account has been funded with XLM
    // Note: Trustline creation now requires client-side signing, so we just check if it exists
    let trustlineResult = null
    try {
      console.log("[Stellar Wallet API] Checking USDC trustline status...")
      trustlineResult = await createUSDCTrustlineServerSide(userId, storedWallet.publicKey)
      if (trustlineResult.success) {
        console.log("[Stellar Wallet API] ✅ USDC trustline already exists")
      } else if (trustlineResult.unsignedXdr) {
        console.log("[Stellar Wallet API] ⚠️ USDC trustline needs client-side signing (account funded)")
        // Trustline can be created via /api/wallet/stellar/trustline endpoint with client-side signing
      } else {
        console.log("[Stellar Wallet API] ⚠️ USDC trustline creation skipped:", trustlineResult.error)
        // This is expected if account hasn't been funded yet
        // Trustline can be created later when account is funded
      }
    } catch (trustlineError) {
      // Don't fail wallet creation if trustline creation fails
      console.warn("[Stellar Wallet API] ⚠️ Error checking USDC trustline (non-blocking):", trustlineError)
      // Trustline can be created later via a separate API call
    }

    return NextResponse.json(
      {
        walletId: storedWallet.turnkeyWalletId || storedWallet.publicKey, // Use public key as wallet ID if no Turnkey ID
        publicKey: storedWallet.publicKey,
        network: storedWallet.network,
        trustlineCreated: trustlineResult?.success || false,
        trustlineError: trustlineResult?.error || null,
        needsClientSigning: !!trustlineResult?.unsignedXdr, // Indicate if client-side signing is needed
      },
      { headers: corsHeaders(request as any) }
    )
  } catch (error) {
    console.error("[Stellar Wallet API] Error creating wallet:", error)

    const isDevelopment = process.env.NODE_ENV === "development"

    return NextResponse.json(
      {
        error: "Failed to create wallet",
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}

