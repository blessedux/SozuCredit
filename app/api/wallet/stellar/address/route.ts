import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"

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
      console.log("[Stellar Address API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers
      userId = request.headers.get("x-user-id")
      console.log("[Stellar Address API] Dev mode, userId from header:", userId)

      if (!userId) {
        console.error("[Stellar Address API] No userId provided")
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

    console.log("[Stellar Address API] Wallet found:", {
      id: wallet.id,
      userId: wallet.userId,
      publicKey: wallet.publicKey ? `${wallet.publicKey.substring(0, 10)}...` : "NULL/EMPTY",
      network: wallet.network,
    })

    // Check if publicKey is missing or null
    if (!wallet.publicKey) {
      console.error("[Stellar Address API] Wallet exists but publicKey is missing!")
      return NextResponse.json(
        { 
          error: "Wallet exists but publicKey is missing. Please recreate the wallet.",
          network: wallet.network,
        },
        { status: 500, headers: corsHeaders(request as any) }
      )
    }

    return NextResponse.json(
      {
        publicKey: wallet.publicKey,
        network: wallet.network,
      },
      { headers: corsHeaders(request as any) }
    )
  } catch (error) {
    console.error("[Stellar Address API] Error getting address:", error)

    const isDevelopment = process.env.NODE_ENV === "development"

    return NextResponse.json(
      {
        error: "Failed to get wallet address",
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}

