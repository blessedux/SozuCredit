import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { resolveOnChainPasskeyPublicKey } from "@/lib/stellar/smartAccounts/resolveOnChainPublicKey"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)

  const userId = request.headers.get("x-user-id")
  const contractId = request.nextUrl.searchParams.get("contractId")?.trim() ?? ""
  const credentialId = request.nextUrl.searchParams.get("credentialId")?.trim() ?? ""

  if (!contractId || !credentialId) {
    return NextResponse.json(
      { error: "contractId and credentialId are required." },
      { status: 400, headers }
    )
  }

  let publicKey65b = await resolveOnChainPasskeyPublicKey({ contractId, credentialId })

  if (!publicKey65b && userId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && supabaseServiceKey) {
      const svc = createServiceClient(supabaseUrl, supabaseServiceKey)
      const normalized = normalizeCredentialId(credentialId)
      const { data: rows } = await svc
        .from("passkeys")
        .select("credential_id, public_key")
        .eq("user_id", userId)
        .limit(20)

      const match =
        rows?.find((p) => normalizeCredentialId(p.credential_id) === normalized) ?? rows?.[0]
      if (match?.public_key && typeof match.public_key === "string") {
        publicKey65b = match.public_key
      }
    }
  }

  if (!publicKey65b) {
    return NextResponse.json(
      { error: "Passkey public key not found for this smart account." },
      { status: 404, headers }
    )
  }

  return NextResponse.json({ publicKey65b }, { headers })
}
