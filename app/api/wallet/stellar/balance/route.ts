import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet, getWalletBalance } from "@/lib/turnkey/stellar-wallet"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    let userId: string | null = null

    if (user) {
      userId = user.id
      console.log("[Stellar Balance API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers
      userId = request.headers.get("x-user-id")
      console.log("[Stellar Balance API] Dev mode, userId from header:", userId)

      if (!userId) {
        console.error("[Stellar Balance API] No userId provided")
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: corsHeaders(request as any) }
        )
      }
    }

    // Get wallet from database (use service client if no authenticated user)
    const wallet = await getStellarWallet(userId, !user)

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found. Please create a wallet first." },
        { status: 404, headers: corsHeaders(request as any) }
      )
    }

    // Query balance from Stellar network
    const balance = await getWalletBalance(wallet.publicKey)

    return NextResponse.json(
      {
        balance,
        asset: "XLM", // Native Stellar asset
        publicKey: wallet.publicKey,
        network: wallet.network,
      },
      { headers: corsHeaders(request as any) }
    )
  } catch (error) {
    console.error("[Stellar Balance API] Error getting balance:", error)

    const isDevelopment = process.env.NODE_ENV === "development"

    return NextResponse.json(
      {
        error: "Failed to get wallet balance",
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}

