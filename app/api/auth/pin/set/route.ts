import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { hashRecoveryPin, isValidPinFormat } from "@/lib/auth/pin-crypto"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id")?.trim()
    if (!userId) {
      return NextResponse.json({ error: "Missing x-user-id" }, { status: 401, headers: corsHeaders(request) })
    }

    const { pin } = await request.json()
    if (!pin || typeof pin !== "string" || !isValidPinFormat(pin)) {
      return NextResponse.json(
        { error: "PIN must be 6–12 digits." },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders(request) })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error: readError } = await serviceClient
      .from("profiles")
      .select("id, recovery_pin_hash")
      .eq("id", userId)
      .maybeSingle()

    if (readError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404, headers: corsHeaders(request) })
    }

    if (profile.recovery_pin_hash) {
      return NextResponse.json(
        { error: "PIN already set. Contact support to rotate it." },
        { status: 409, headers: corsHeaders(request) }
      )
    }

    const hashed = hashRecoveryPin(pin)

    const { error: upError } = await serviceClient
      .from("profiles")
      .update({ recovery_pin_hash: hashed })
      .eq("id", userId)

    if (upError) {
      if (upError.message?.includes("recovery_pin_hash") || upError.code === "42703") {
        return NextResponse.json(
          {
            error: "Database migration required",
            message: "Apply the Supabase migration that adds profiles.recovery_pin_hash.",
          },
          { status: 503, headers: corsHeaders(request) }
        )
      }
      console.error("[PIN set]", upError)
      return NextResponse.json({ error: "Failed to save PIN" }, { status: 500, headers: corsHeaders(request) })
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders(request) })
  } catch (e) {
    console.error("[PIN set]", e)
    return NextResponse.json({ error: "Failed to save PIN" }, { status: 500, headers: corsHeaders(request) })
  }
}
