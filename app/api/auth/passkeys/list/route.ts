import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

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

    const { data: rows, error } = await serviceClient
      .from("passkeys")
      .select("credential_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[Passkeys list]", error)
      return NextResponse.json({ error: "Failed to list passkeys" }, { status: 500, headers: corsHeaders(request) })
    }

    return NextResponse.json(
      { passkeys: rows ?? [] },
      { headers: corsHeaders(request) }
    )
  } catch (e) {
    console.error("[Passkeys list]", e)
    return NextResponse.json({ error: "Failed to list passkeys" }, { status: 500, headers: corsHeaders(request) })
  }
}
