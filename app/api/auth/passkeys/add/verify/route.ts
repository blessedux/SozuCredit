import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { MAX_PASSKEYS_PER_USER } from "@/lib/auth/passkey-limits"
import { challengeStore } from "@/lib/webauthn/config"
import { getPairingEntry, revokePairingCode } from "@/lib/webauthn/device-pairing"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

function normalizeCredentialId(id: string): string {
  if (!id) return ""
  return String(id).replace(/\s+/g, "").trim()
}

function normalizeCredentialUsername(username: string): string {
  return String(username).replace(/^\$/, "").trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { credential, challenge: providedChallenge } = body
    const pairingCode =
      typeof body.pairingCode === "string" ? body.pairingCode.replace(/\s+/g, "").toUpperCase() : ""
    const usernameRaw = typeof body.username === "string" ? body.username.trim() : ""
    const headerUserId = request.headers.get("x-user-id")?.trim() || ""

    if (!credential?.id) {
      return NextResponse.json({ error: "Invalid credential data" }, { status: 400, headers: corsHeaders(request) })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders(request) })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    let userId: string | null = null

    if (pairingCode) {
      const pairing = getPairingEntry(pairingCode)
      if (!pairing) {
        return NextResponse.json(
          { error: "Invalid or expired pairing code" },
          { status: 400, headers: corsHeaders(request) }
        )
      }
      const normalizedTag = normalizeCredentialUsername(usernameRaw)
      if (!normalizedTag) {
        return NextResponse.json({ error: "Username (Sozu tag) is required" }, { status: 400, headers: corsHeaders(request) })
      }
      if (pairing.username.toLowerCase() !== normalizedTag.toLowerCase()) {
        return NextResponse.json({ error: "Sozu tag does not match this pairing code" }, { status: 403, headers: corsHeaders(request) })
      }
      userId = pairing.userId
    } else {
      if (!headerUserId) {
        return NextResponse.json({ error: "Missing x-user-id" }, { status: 401, headers: corsHeaders(request) })
      }
      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("id", headerUserId)
        .maybeSingle()
      if (profileError || !profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404, headers: corsHeaders(request) })
      }
      userId = profile.id
    }

    const challengeKey = pairingCode ? `addpk:pair:${pairingCode}` : `addpk:uid:${userId}`
    const stored = challengeStore.get(challengeKey)
    if (stored) {
      challengeStore.delete(challengeKey)
    }

    if (!stored && !providedChallenge) {
      return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400, headers: corsHeaders(request) })
    }

    const { count, error: countError } = await serviceClient
      .from("passkeys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId!)

    if (countError) {
      console.error("[Add passkey verify]", countError)
      return NextResponse.json({ error: "Failed to verify passkeys" }, { status: 500, headers: corsHeaders(request) })
    }

    if ((count ?? 0) >= MAX_PASSKEYS_PER_USER) {
      return NextResponse.json(
        { error: `This account already has ${MAX_PASSKEYS_PER_USER} passkeys.` },
        { status: 409, headers: corsHeaders(request) }
      )
    }

    const normalizedCredentialId = normalizeCredentialId(credential.id)

    const { data: existingSame } = await serviceClient
      .from("passkeys")
      .select("id")
      .eq("credential_id", normalizedCredentialId)
      .maybeSingle()

    if (existingSame) {
      return NextResponse.json({ error: "This passkey is already registered" }, { status: 409, headers: corsHeaders(request) })
    }

    const publicKey = credential.response?.publicKey || credential.response?.attestationObject || credential.id

    const { error: insertError } = await serviceClient.from("passkeys").insert({
      user_id: userId,
      credential_id: normalizedCredentialId,
      public_key: publicKey,
      counter: 0,
      transports: credential.response?.transports || [],
    })

    if (insertError) {
      console.error("[Add passkey verify] insert", insertError)
      return NextResponse.json({ error: "Failed to store passkey", details: insertError.message }, { status: 500, headers: corsHeaders(request) })
    }

    if (pairingCode) {
      revokePairingCode(pairingCode)
    }

    return NextResponse.json(
      {
        success: true,
        userId,
        credentialId: normalizedCredentialId,
        walletSyncHint:
          "If this is a new device, copy this credential ID to your first device (Settings → Sync wallet) so both passkeys control the same Stellar wallet.",
      },
      { headers: corsHeaders(request) }
    )
  } catch (e) {
    console.error("[Add passkey verify]", e)
    return NextResponse.json({ error: "Failed to verify passkey" }, { status: 500, headers: corsHeaders(request) })
  }
}
