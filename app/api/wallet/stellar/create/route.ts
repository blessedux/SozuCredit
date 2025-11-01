import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { createStellarWallet, storeStellarWallet, getStellarWallet, deleteStellarWallet } from "@/lib/turnkey/stellar-wallet"

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
            walletId: existingWallet.turnkeyWalletId,
            publicKey: existingWallet.publicKey,
            network: existingWallet.network,
          },
          { headers: corsHeaders(request as any) }
        )
      } else {
        // Wallet exists but has no publicKey - this shouldn't happen, but handle it
        console.warn("[Stellar Wallet API] Wallet exists but has no publicKey, this should not happen. Attempting to update...")
        // Try to get the wallet from Turnkey and update it
        // For now, just log an error - the wallet should not be in this state
        console.error("[Stellar Wallet API] Cannot fix wallet without publicKey automatically. Manual intervention required.")
        return NextResponse.json(
          {
            error: "Wallet exists but is in an invalid state. Please contact support.",
            walletId: existingWallet.turnkeyWalletId,
            publicKey: null,
            network: existingWallet.network,
          },
          { status: 500, headers: corsHeaders(request as any) }
        )
      }
    }

    // Create new wallet
    console.log("[Stellar Wallet API] Creating Stellar wallet for user:", userId)
    const wallet = await createStellarWallet(userId)
    console.log("[Stellar Wallet API] Wallet created with Turnkey:", {
      turnkeyWalletId: wallet.turnkeyWalletId,
      publicKey: wallet.publicKey,
      publicKeyLength: wallet.publicKey?.length || 0,
    })
    
    // Use service client if no authenticated user (for dev mode with x-user-id)
    const storedWallet = await storeStellarWallet(
      userId,
      wallet.turnkeyWalletId,
      wallet.publicKey,
      !user // Use service client if no authenticated user
    )

    console.log("[Stellar Wallet API] Wallet stored in database:", {
      id: storedWallet.id,
      turnkeyWalletId: storedWallet.turnkeyWalletId,
      publicKey: storedWallet.publicKey,
      publicKeyLength: storedWallet.publicKey?.length || 0,
      network: storedWallet.network,
    })

    // Validate that the stored wallet has a publicKey
    if (!storedWallet.publicKey) {
      console.error("[Stellar Wallet API] Stored wallet missing publicKey!", storedWallet)
      throw new Error("Stored wallet is missing publicKey. Database constraint may have failed.")
    }

    return NextResponse.json(
      {
        walletId: storedWallet.turnkeyWalletId,
        publicKey: storedWallet.publicKey,
        network: storedWallet.network,
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

