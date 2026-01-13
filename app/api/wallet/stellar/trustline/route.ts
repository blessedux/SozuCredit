import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { createUSDCTrustlineServerSide, submitTrustlineTransaction } from "@/lib/stellar/trustline-server"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

/**
 * POST /api/wallet/stellar/trustline
 * Create USDC trustline for user's Stellar wallet
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    let userId: string | null = null

    if (user) {
      userId = user.id
      console.log("[Trustline API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers
      userId = request.headers.get("x-user-id")
      console.log("[Trustline API] Dev mode, userId from header:", userId)

      if (!userId) {
        console.error("[Trustline API] No userId provided")
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: corsHeaders(request as any) }
        )
      }
    }

    // Get user's Stellar wallet
    const wallet = await getStellarWallet(userId, !user)
    if (!wallet || !wallet.publicKey) {
      return NextResponse.json(
        { error: "Stellar wallet not found" },
        { status: 404, headers: corsHeaders(request as any) }
      )
    }

    console.log("[Trustline API] Creating USDC trustline for user:", userId, "publicKey:", wallet.publicKey.substring(0, 10) + "...")

    // Get request body to check if client sent a signed transaction
    let signedTransactionXdr: string | undefined
    try {
      const body = await request.json().catch(() => ({}))
      signedTransactionXdr = body.signedTransactionXdr
    } catch {
      // No body or invalid JSON, continue without signed transaction
    }

    // Create USDC trustline (with or without signed transaction)
    const result = await createUSDCTrustlineServerSide(
      userId,
      wallet.publicKey,
      signedTransactionXdr
    )

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: "USDC trustline created successfully",
          transactionHash: result.transactionHash,
        },
        { headers: corsHeaders(request as any) }
      )
    } else if (result.unsignedXdr) {
      // Return unsigned transaction XDR for client-side signing
      return NextResponse.json(
        {
          success: false,
          needsSigning: true,
          unsignedXdr: result.unsignedXdr,
          message: "Transaction built, requires client-side signing",
        },
        { headers: corsHeaders(request as any) }
      )
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to create USDC trustline",
        },
        { status: 400, headers: corsHeaders(request as any) }
      )
    }
  } catch (error) {
    console.error("[Trustline API] Error creating trustline:", error)

    const isDevelopment = process.env.NODE_ENV === "development"

    return NextResponse.json(
      {
        error: "Failed to create USDC trustline",
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}
