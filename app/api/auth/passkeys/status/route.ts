import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { MAX_PASSKEYS_PER_USER } from "@/lib/auth/passkey-limits"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
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

    let { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, username, recovery_pin_hash")
      .eq("id", userId)
      .maybeSingle()

    if (profileError && (profileError.message?.includes("recovery_pin_hash") || profileError.code === "42703")) {
      const retry = await serviceClient.from("profiles").select("id, username").eq("id", userId).maybeSingle()
      profile = retry.data as typeof profile
      profileError = retry.error
    }

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404, headers: corsHeaders(request) })
    }

    const { count, error: countError } = await serviceClient
      .from("passkeys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

    if (countError) {
      console.error("[Passkeys status]", countError)
      return NextResponse.json({ error: "Failed to count passkeys" }, { status: 500, headers: corsHeaders(request) })
    }

    const n = count ?? 0
    const pinSet = Boolean((profile as { recovery_pin_hash?: string | null }).recovery_pin_hash)
    return NextResponse.json(
      {
        count: n,
        max: MAX_PASSKEYS_PER_USER,
        canAddMore: n < MAX_PASSKEYS_PER_USER,
        username: profile.username,
        pinSet,
      },
      { headers: corsHeaders(request) }
    )
  } catch (e) {
    console.error("[Passkeys status]", e)
    return NextResponse.json({ error: "Failed to load passkey status" }, { status: 500, headers: corsHeaders(request) })
  }
}
