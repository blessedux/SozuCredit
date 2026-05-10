import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { verifyRecoveryPin, isValidPinFormat } from "@/lib/auth/pin-crypto"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const { username, pin } = await request.json()

    if (!username || typeof username !== "string" || !pin || typeof pin !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders(request) })
    }

    const clean = username.replace(/^\$/, "").trim()
    if (clean.length < 3 || !isValidPinFormat(pin)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders(request) })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders(request) })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error } = await serviceClient
      .from("profiles")
      .select("id, username, recovery_pin_hash")
      .eq("username", clean)
      .maybeSingle()

    if (error || !profile) {
      return NextResponse.json({ error: "Could not sign in" }, { status: 401, headers: corsHeaders(request) })
    }

    if (!profile.recovery_pin_hash) {
      return NextResponse.json(
        { error: "pin_not_configured", message: "No backup PIN for this account. Use your passkey, or set a PIN in Settings after signing in." },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    if (!verifyRecoveryPin(pin, profile.recovery_pin_hash)) {
      return NextResponse.json({ error: "Could not sign in" }, { status: 401, headers: corsHeaders(request) })
    }

    return NextResponse.json(
      {
        success: true,
        userId: profile.id,
        username: profile.username,
      },
      { headers: corsHeaders(request) }
    )
  } catch (e) {
    console.error("[PIN login]", e)
    return NextResponse.json({ error: "Could not sign in" }, { status: 500, headers: corsHeaders(request) })
  }
}
