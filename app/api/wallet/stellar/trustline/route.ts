import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet, createUSDCTrustline } from "@/lib/turnkey/stellar-wallet"

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

    // Create USDC trustline
    const result = await createUSDCTrustline(userId, wallet.publicKey)

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: "USDC trustline created successfully",
          transactionHash: result.transactionHash,
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

