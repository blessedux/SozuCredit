import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarConfig } from "@/lib/turnkey/config"
import { provisionSmartWalletForSigner } from "@/lib/stellar/smart-account-provision"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/**
 * POST /api/wallet/smart-account/provision
 * Deploy a Soroban smart account (C…) for a passkey-derived signer (G…) and register it in stellar_wallets.
 */
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request)

  try {
    const userId = request.headers.get("x-user-id")
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
    }

    const body = await request.json().catch(() => ({}))
    const signerPublicKey =
      typeof body.signerPublicKey === "string" ? body.signerPublicKey.trim().toUpperCase() : ""

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
    const { data: existing } = await svc
      .from("stellar_wallets")
      .select("public_key, signer_public_key")
      .eq("user_id", userId)
      .maybeSingle()

    if (existing?.public_key?.startsWith("C")) {
      return NextResponse.json(
        {
          ok: true,
          contractId: existing.public_key.trim().toUpperCase(),
          signerPublicKey: existing.signer_public_key ?? signerPublicKey,
          alreadyProvisioned: true,
        },
        { headers },
      )
    }

    const provisioned = await provisionSmartWalletForSigner(signerPublicKey)
    if ("error" in provisioned) {
      return NextResponse.json({ error: provisioned.error }, { status: 502, headers })
    }

    const stellarConfig = getStellarConfig()
    const row: Record<string, string | null> = {
      user_id: userId,
      public_key: provisioned.contractId,
      signer_public_key: provisioned.signerPublicKey,
      wallet_type: "factory",
      turnkey_wallet_id: null,
      network: stellarConfig.network,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await svc.from("stellar_wallets").upsert(row, {
      onConflict: "user_id",
    })

    if (upsertError) {
      const withoutSigner = { ...row }
      delete withoutSigner.signer_public_key
      const retry = await svc.from("stellar_wallets").upsert(withoutSigner, { onConflict: "user_id" })
      if (retry.error) {
        console.error("[smart-account/provision] upsert:", retry.error.message)
        return NextResponse.json(
          {
            error: `Smart account deployed (${provisioned.contractId}) but DB save failed. Run docs/supabase-stellar-wallet-signer.sql.`,
            contractId: provisioned.contractId,
          },
          { status: 502, headers }
        )
      }
    }

    return NextResponse.json(
      {
        ok: true,
        contractId: provisioned.contractId,
        signerPublicKey: provisioned.signerPublicKey,
        funded: provisioned.funded,
        alreadyProvisioned: false,
      },
      { headers }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[smart-account/provision]", msg)
    return NextResponse.json({ error: msg }, { status: 500, headers })
  }
}
