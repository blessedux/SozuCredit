import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)
  const userId = request.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
  }

  const svc = createServiceClient(supabaseUrl, supabaseServiceKey)
  const { data: rows, error } = await svc
    .from("passkeys")
    .select("credential_id, public_key, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers })
  }

  const row = rows?.[0]
  if (!row?.credential_id || !row?.public_key) {
    return NextResponse.json({ error: "No passkey found" }, { status: 404, headers })
  }

  return NextResponse.json(
    {
      credentialId: normalizeCredentialId(row.credential_id),
      publicKey65b: row.public_key,
    },
    { headers }
  )
}
