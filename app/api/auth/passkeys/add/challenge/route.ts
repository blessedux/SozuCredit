import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { MAX_PASSKEYS_PER_USER } from "@/lib/auth/passkey-limits"
import { challengeStore, cleanupChallenges, getRpID, rpName } from "@/lib/webauthn/config"
import { generateChallenge } from "@/lib/webauthn/utils"
import { getPairingEntry } from "@/lib/webauthn/device-pairing"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

function normalizeCredentialUsername(username: string): string {
  return String(username).replace(/^\$/, "").trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const pairingCode =
      typeof body.pairingCode === "string" ? body.pairingCode.replace(/\s+/g, "").toUpperCase() : ""
    const usernameRaw = typeof body.username === "string" ? body.username.trim() : ""
    const headerUserId = request.headers.get("x-user-id")?.trim() || ""

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers: corsHeaders(request) })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    cleanupChallenges()

    let userId: string | null = null
    let profileUsername: string | null = null

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
        return NextResponse.json({ error: "Username (Sozu tag) is required with pairing code" }, { status: 400, headers: corsHeaders(request) })
      }
      if (pairing.username.toLowerCase() !== normalizedTag.toLowerCase()) {
        return NextResponse.json({ error: "Sozu tag does not match this pairing code" }, { status: 403, headers: corsHeaders(request) })
      }
      userId = pairing.userId
      profileUsername = pairing.username
    } else {
      if (!headerUserId) {
        return NextResponse.json(
          { error: "Sign in on this device first, or use a pairing code from Settings on your other device." },
          { status: 401, headers: corsHeaders(request) }
        )
      }
      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .select("id, username")
        .eq("id", headerUserId)
        .maybeSingle()

      if (profileError || !profile?.username) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404, headers: corsHeaders(request) })
      }
      userId = profile.id
      profileUsername = profile.username
    }

    const { count, error: countError } = await serviceClient
      .from("passkeys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

    if (countError) {
      console.error("[Add passkey challenge]", countError)
      return NextResponse.json({ error: "Failed to verify passkeys" }, { status: 500, headers: corsHeaders(request) })
    }

    if ((count ?? 0) >= MAX_PASSKEYS_PER_USER) {
      return NextResponse.json(
        { error: `This account already has ${MAX_PASSKEYS_PER_USER} passkeys.` },
        { status: 409, headers: corsHeaders(request) }
      )
    }

    const challenge = generateChallenge()
    const rpID = getRpID(request)

    const challengeKey = pairingCode ? `addpk:pair:${pairingCode}` : `addpk:uid:${userId}`
    challengeStore.set(challengeKey, { challenge, timestamp: Date.now() })

    return NextResponse.json(
      {
        challenge,
        rp: { name: rpName, id: rpID },
        user: {
          id: userId,
          name: profileUsername!,
          displayName: profileUsername!,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" },
        ],
        authenticatorSelection: {
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
      { headers: corsHeaders(request) }
    )
  } catch (e) {
    console.error("[Add passkey challenge]", e)
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500, headers: corsHeaders(request) })
  }
}
