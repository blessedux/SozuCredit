import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/**
 * POST /api/wallet/resolve-address-to-tag
 * Resolve a Stellar address to a Sozu tag (reverse lookup)
 */
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json()

    if (!address || !/^G[A-Z0-9]{55}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid Stellar address" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Find wallet by public key
    const { data: wallet, error: walletError } = await serviceClient
      .from("stellar_wallets")
      .select("user_id, public_key")
      .eq("public_key", address)
      .maybeSingle()

    if (walletError) {
      console.error("[Resolve Address to Tag] Error finding wallet:", walletError)
      return NextResponse.json(
        { error: "Failed to resolve address" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    if (!wallet) {
      return NextResponse.json(
        { tag: null },
        { status: 200, headers: corsHeaders(request) }
      )
    }

    // Get profile for this user
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("username")
      .eq("id", wallet.user_id)
      .maybeSingle()

    if (profileError) {
      console.error("[Resolve Address to Tag] Error finding profile:", profileError)
      return NextResponse.json(
        { error: "Failed to resolve address" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    if (!profile || !profile.username) {
      return NextResponse.json(
        { tag: null },
        { status: 200, headers: corsHeaders(request) }
      )
    }

    return NextResponse.json(
      { tag: profile.username },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Resolve Address to Tag] Unexpected error:", error)
    return NextResponse.json(
      { error: "Failed to resolve address" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
