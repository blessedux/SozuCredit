import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/**
 * Align stellar_wallets.signer_public_key with the passkey-derived G the client can sign.
 * SEP-10 requires the challenge account to match a key the user controls locally.
 */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)

  try {
    const userId = request.headers.get("x-user-id")?.trim()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
    }

    const body = await request.json().catch(() => ({}))
    const signerPublicKey =
      typeof body.signerPublicKey === "string" ? body.signerPublicKey.trim().toUpperCase() : ""
    const credentialIdRaw =
      typeof body.credentialId === "string" ? body.credentialId.trim() : ""

    if (!/^G[A-Z0-9]{55}$/.test(signerPublicKey)) {
      return NextResponse.json(
        { error: "signerPublicKey (G…) is required." },
        { status: 400, headers }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers })
    }

    const svc = createServiceClient(supabaseUrl, supabaseServiceKey)

    if (credentialIdRaw) {
      const normalized = normalizeCredentialId(credentialIdRaw)
      const { data: passkey } = await svc
        .from("passkeys")
        .select("credential_id")
        .eq("user_id", userId)
        .eq("credential_id", normalized)
        .maybeSingle()

      if (!passkey) {
        return NextResponse.json(
          { error: "Passkey does not belong to this account." },
          { status: 403, headers }
        )
      }
    }

    const { data: wallet, error: fetchError } = await svc
      .from("stellar_wallets")
      .select("public_key, signer_public_key")
      .eq("user_id", userId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500, headers })
    }

    if (!wallet?.public_key) {
      return NextResponse.json(
        { error: "Wallet not found. Complete passkey setup first." },
        { status: 404, headers }
      )
    }

    const existingSigner = wallet.signer_public_key?.trim().toUpperCase() ?? null
    if (existingSigner === signerPublicKey) {
      return NextResponse.json({ ok: true, signerPublicKey, unchanged: true }, { headers })
    }

    const patch: Record<string, string> = {
      signer_public_key: signerPublicKey,
      updated_at: new Date().toISOString(),
    }
    if (credentialIdRaw) {
      patch.oz_credential_id = normalizeCredentialId(credentialIdRaw)
    }

    let { error: updateError } = await svc
      .from("stellar_wallets")
      .update(patch)
      .eq("user_id", userId)

    if (updateError?.message?.includes("oz_credential")) {
      const { oz_credential_id: _o, ...withoutOz } = patch
      const retry = await svc.from("stellar_wallets").update(withoutOz).eq("user_id", userId)
      updateError = retry.error
    }

    if (updateError?.message?.includes("signer_public_key")) {
      return NextResponse.json(
        {
          error:
            "Database missing signer_public_key column. Run docs/supabase-stellar-wallet-signer.sql.",
        },
        { status: 503, headers }
      )
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500, headers })
    }

    if (existingSigner && existingSigner !== signerPublicKey) {
      console.warn("[sync-signer] Updated signer for user", userId.slice(0, 8), {
        from: existingSigner.slice(0, 10),
        to: signerPublicKey.slice(0, 10),
      })
    }

    return NextResponse.json({ ok: true, signerPublicKey, updated: true }, { headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[sync-signer]", msg)
    return NextResponse.json({ error: msg }, { status: 500, headers })
  }
}
