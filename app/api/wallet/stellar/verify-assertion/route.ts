import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { challengeStore } from "@/lib/webauthn/config"
import { base64URLToBuffer } from "@/lib/webauthn/utils"

/** Accept clientDataJSON.origin if it matches any plausible app URL (prod env drift, Vercel previews, missing Origin). */
function isWebAuthnOriginAllowed(clientOrigin: string, request: NextRequest): boolean {
  let client: URL
  try {
    client = new URL(clientOrigin)
  } catch {
    return false
  }

  const candidates: string[] = []
  const originHeader = request.headers.get("origin")
  if (originHeader) candidates.push(originHeader)
  const referer = request.headers.get("referer")
  if (referer) {
    try {
      candidates.push(new URL(referer).origin)
    } catch {
      /* ignore */
    }
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    candidates.push(process.env.NEXT_PUBLIC_APP_URL)
  }
  candidates.push("http://localhost:3000")
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    try {
      candidates.push(new URL(`https://${vercelUrl}`).origin)
    } catch {
      /* ignore */
    }
  }

  for (const raw of candidates) {
    try {
      if (new URL(raw).origin === client.origin) {
        return true
      }
    } catch {
      if (raw === clientOrigin) {
        return true
      }
    }
  }
  return false
}

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const { credential, transactionHash, userId, challenge: providedChallenge } = await request.json()

    if (!credential || !credential.id) {
      return NextResponse.json(
        { error: "Credential is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    if (!transactionHash || typeof transactionHash !== "string" || transactionHash.length === 0) {
      return NextResponse.json(
        { error: "Transaction hash is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    console.log("[Verify Assertion] Request received:", {
      credentialId: credential.id.substring(0, 20) + "...",
      transactionHash: transactionHash.substring(0, 20) + "...",
      userId: userId.substring(0, 10) + "..."
    })

    // Get challenge from store
    const challengeKey = `tx:${transactionHash}:${userId}`
    const storedChallenge = challengeStore.get(challengeKey)

    if (!storedChallenge) {
      // Fallback to provided challenge if not in store (serverless environments)
      if (providedChallenge) {
        console.log("[Verify Assertion] Challenge not in store, using provided challenge")
      } else {
        console.error("[Verify Assertion] ❌ Challenge not found in store and not provided")
        return NextResponse.json(
          { error: "Challenge not found or expired. Please try again." },
          { status: 400, headers: corsHeaders(request) }
        )
      }
    } else {
      // Clean up challenge after use
      challengeStore.delete(challengeKey)
      console.log("[Verify Assertion] ✅ Challenge found and cleaned up")
    }

    const challengeToVerify = storedChallenge?.challenge || providedChallenge

    // Verify challenge matches in clientDataJSON
    if (credential.response && credential.response.clientDataJSON) {
      try {
        const clientDataBuffer = base64URLToBuffer(credential.response.clientDataJSON)
        const clientDataJSON = JSON.parse(
          new TextDecoder().decode(clientDataBuffer)
        )

        // Verify challenge matches
        // The challenge in clientDataJSON is base64url encoded
        if (clientDataJSON.challenge !== challengeToVerify) {
          console.error("[Verify Assertion] ❌ Challenge mismatch:", {
            stored: challengeToVerify.substring(0, 20),
            received: clientDataJSON.challenge?.substring(0, 20)
          })
          return NextResponse.json(
            { error: "Challenge mismatch. Transaction may have expired." },
            { status: 401, headers: corsHeaders(request) }
          )
        }

        // Verify type is "webauthn.get"
        if (clientDataJSON.type !== "webauthn.get") {
          console.error("[Verify Assertion] ❌ Invalid clientDataJSON type:", clientDataJSON.type)
          return NextResponse.json(
            { error: "Invalid authentication type" },
            { status: 401, headers: corsHeaders(request) }
          )
        }

        if (!isWebAuthnOriginAllowed(clientDataJSON.origin, request)) {
          console.error("[Verify Assertion] ❌ Origin mismatch:", {
            received: clientDataJSON.origin,
            originHeader: request.headers.get("origin"),
            nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
            vercelUrl: process.env.VERCEL_URL,
          })
          return NextResponse.json(
            { error: "Origin mismatch" },
            { status: 401, headers: corsHeaders(request) }
          )
        }

        console.log("[Verify Assertion] ✅ Challenge verification passed")
      } catch (error) {
        console.error("[Verify Assertion] Error parsing clientDataJSON:", error)
        return NextResponse.json(
          { error: "Invalid assertion data" },
          { status: 400, headers: corsHeaders(request) }
        )
      }
    } else {
      return NextResponse.json(
        { error: "Invalid credential response" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Verify passkey belongs to user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Normalize credential ID
    const normalizeCredentialId = (id: string): string => {
      if (!id) return ""
      return String(id).replace(/\s+/g, '').trim()
    }

    const normalizedCredentialId = normalizeCredentialId(credential.id)

    // Find passkey by credential ID and user ID
    let passkey = null
    let passkeyError = null

    const { data: passkeyData, error: passkeyErrorData } = await serviceClient
      .from("passkeys")
      .select("id, user_id, credential_id, counter")
      .eq("credential_id", normalizedCredentialId)
      .eq("user_id", userId)
      .maybeSingle()

    passkey = passkeyData
    passkeyError = passkeyErrorData

    // Try original credential ID if normalized doesn't match
    if (!passkey && !passkeyError && normalizedCredentialId !== credential.id) {
      const { data: passkeyOriginal, error: passkeyErrorOriginal } = await serviceClient
        .from("passkeys")
        .select("id, user_id, credential_id, counter")
        .eq("credential_id", credential.id)
        .eq("user_id", userId)
        .maybeSingle()

      if (passkeyOriginal) {
        passkey = passkeyOriginal
        console.log("[Verify Assertion] ✅ Found passkey with original credential ID")
      } else if (passkeyErrorOriginal) {
        passkeyError = passkeyErrorOriginal
      }
    }

    if (!passkey && !passkeyError) {
      console.error("[Verify Assertion] ❌ Passkey not found for user")
      return NextResponse.json(
        { error: "Invalid passkey. This passkey does not belong to your account." },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    if (passkeyError) {
      console.error("[Verify Assertion] Error looking up passkey:", passkeyError)
      return NextResponse.json(
        { error: "Failed to verify passkey" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    // Verify challenge timestamp is recent (prevent replay attacks)
    if (storedChallenge) {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      if (storedChallenge.timestamp < fiveMinutesAgo) {
        console.error("[Verify Assertion] ❌ Challenge expired")
        return NextResponse.json(
          { error: "Challenge expired. Please try again." },
          { status: 401, headers: corsHeaders(request) }
        )
      }
    }

    // Update passkey last used timestamp
    if (passkey) {
      await serviceClient
        .from("passkeys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", passkey.id)
    }

    console.log("[Verify Assertion] ✅ Assertion verified successfully")

    return NextResponse.json(
      {
        success: true,
        verified: true,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error: any) {
    console.error("[Verify Assertion] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to verify assertion" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
