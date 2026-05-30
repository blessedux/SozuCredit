import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  isValidSozuTag,
  normalizeSozuTag,
} from "@/lib/payment/sozu-tag-lookup"
import {
  isValidStellarReceiveAddress,
  normalizeStellarAddressInput,
} from "@/lib/payment/stellar-address"

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
    const { recipient: rawRecipient } = await request.json()

    if (!rawRecipient || typeof rawRecipient !== "string") {
      return NextResponse.json(
        { error: "Recipient is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const trimmed = rawRecipient.trim()
    const stellarDirect = normalizeStellarAddressInput(trimmed)

    // Stellar address (classic G or Soroban C) — return as-is
    if (isValidStellarReceiveAddress(stellarDirect)) {
      return NextResponse.json(
        {
          walletAddress: stellarDirect,
          addressType: stellarDirect.startsWith("C") ? "contract" : "classic",
        },
        { headers: corsHeaders(request) }
      )
    }

    const sozuTagLookup = normalizeSozuTag(trimmed)

    if (!sozuTagLookup) {
      return NextResponse.json(
        { error: "Recipient is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    if (!isValidSozuTag(sozuTagLookup)) {
      return NextResponse.json(
        { error: "Recipient not found. Please check the Sozu tag or wallet address." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    console.log("[Resolve Recipient] Looking up profile for Sozu tag:", sozuTagLookup)

    // Case-insensitive match — tags may be stored with different casing than typed.
    const { data: profiles, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, username")
      .ilike("username", sozuTagLookup)
      .not("username", "is", null)
      .limit(10)

    if (profileError) {
      console.error("[Resolve Recipient] Error finding profile:", profileError)
      return NextResponse.json(
        { error: "Recipient not found. Please check the Sozu tag or wallet address." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const profile =
      profiles?.find((p) => p.username === sozuTagLookup) ??
      profiles?.find((p) => p.username?.toLowerCase() === sozuTagLookup.toLowerCase()) ??
      profiles?.[0] ??
      null

    if (!profile) {
      console.log("[Resolve Recipient] Profile not found for username:", sozuTagLookup)
      return NextResponse.json(
        { error: "Recipient not found. Please check the Sozu tag or wallet address." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    console.log("[Resolve Recipient] Profile found:", {
      profileId: profile.id,
      username: profile.username,
    })

    const { data: wallets, error: walletError } = await serviceClient
      .from("stellar_wallets")
      .select("public_key, user_id, network, updated_at")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(1)

    if (walletError) {
      console.error("[Resolve Recipient] Error finding wallet:", walletError)
      return NextResponse.json(
        { error: "Failed to lookup recipient wallet. Please try again." },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const wallet = wallets?.[0] ?? null

    if (!wallet?.public_key) {
      console.log("[Resolve Recipient] No wallet found for user_id:", profile.id)
      return NextResponse.json(
        { error: "Recipient wallet not found. They may not have created a wallet yet." },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const pk = wallet.public_key.trim().toUpperCase()
    if (!isValidStellarReceiveAddress(pk)) {
      console.error("[Resolve Recipient] Invalid wallet public_key format:", {
        length: wallet.public_key?.length,
        prefix: wallet.public_key?.[0],
      })
      return NextResponse.json(
        { error: "Invalid wallet address format. Please contact support." },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    console.log("[Resolve Recipient] Returning wallet for tag:", profile.username)

    return NextResponse.json(
      {
        walletAddress: pk,
        tag: profile.username,
        network: wallet.network,
        addressType: pk.startsWith("C") ? "contract" : "classic",
      },
      { headers: corsHeaders(request) }
    )
  } catch (error: unknown) {
    console.error("[Resolve Recipient] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve recipient" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
