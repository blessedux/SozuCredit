import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarConfig } from "@/lib/turnkey/config"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)

  const userId = request.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
  }

  const body = await request.json().catch(() => ({}))
  const contractId = typeof body.contractId === "string" ? body.contractId.trim() : ""
  const credentialIdRaw = typeof body.credentialId === "string" ? body.credentialId.trim() : ""
  const signerRaw =
    typeof body.signerPublicKey === "string" ? body.signerPublicKey.trim().toUpperCase() : ""
  const signerPublicKey = signerRaw.startsWith("G") && signerRaw.length === 56 ? signerRaw : null

  if (!contractId.startsWith("C") || !credentialIdRaw) {
    return NextResponse.json(
      { error: "contractId (C…) and credentialId are required." },
      { status: 400, headers }
    )
  }

  const credentialId = normalizeCredentialId(credentialIdRaw)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
  }

  const svc = createServiceClient(supabaseUrl, supabaseServiceKey)
  const stellarConfig = getStellarConfig()

  const row: Record<string, string | null> = {
    user_id: userId,
    public_key: contractId.toUpperCase(),
    wallet_type: "oz",
    oz_credential_id: credentialId,
    signer_public_key: signerPublicKey,
    turnkey_wallet_id: null,
    network: stellarConfig.network,
    updated_at: new Date().toISOString(),
  }

  let { error } = await svc.from("stellar_wallets").upsert(row, { onConflict: "user_id" })

  if (error?.message?.includes("wallet_type") || error?.message?.includes("oz_credential")) {
    const fallback = {
      user_id: userId,
      public_key: contractId.toUpperCase(),
      signer_public_key: null,
      turnkey_wallet_id: null,
      network: stellarConfig.network,
      updated_at: new Date().toISOString(),
    }
    const retry = await svc.from("stellar_wallets").upsert(fallback, { onConflict: "user_id" })
    error = retry.error
  }

  if (error) {
    console.error("[smart-accounts/register]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500, headers })
  }

  return NextResponse.json(
    {
      ok: true,
      contractId: contractId.toUpperCase(),
      walletType: "oz",
      credentialId,
    },
    { headers }
  )
}
