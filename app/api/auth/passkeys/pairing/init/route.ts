import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { MAX_PASSKEYS_PER_USER } from "@/lib/auth/passkey-limits"
import { createPairingCode, pairingTtlSeconds } from "@/lib/webauthn/device-pairing"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id")?.trim()
    if (!userId) {
      return NextResponse.json({ error: "Missing x-user-id" }, { status: 401, headers: corsHeaders(request) })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders(request) })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile?.username) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404, headers: corsHeaders(request) })
    }

    const { count, error: countError } = await serviceClient
      .from("passkeys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

    if (countError) {
      console.error("[Pairing init]", countError)
      return NextResponse.json({ error: "Failed to verify passkeys" }, { status: 500, headers: corsHeaders(request) })
    }

    if ((count ?? 0) >= MAX_PASSKEYS_PER_USER) {
      return NextResponse.json(
        { error: `This account already has ${MAX_PASSKEYS_PER_USER} passkeys.` },
        { status: 409, headers: corsHeaders(request) }
      )
    }

    const pairingCode = createPairingCode(userId, profile.username)

    return NextResponse.json(
      {
        pairingCode,
        expiresInSeconds: pairingTtlSeconds(),
        username: profile.username,
      },
      { headers: corsHeaders(request) }
    )
  } catch (e) {
    console.error("[Pairing init]", e)
    return NextResponse.json({ error: "Failed to create pairing code" }, { status: 500, headers: corsHeaders(request) })
  }
}
