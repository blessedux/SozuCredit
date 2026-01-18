import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { generateChallenge } from "@/lib/webauthn/utils"
import { challengeStore, cleanupChallenges, getRpID, rpName } from "@/lib/webauthn/config"
import { createClient } from "@/lib/supabase/server"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const { transactionHash, userId } = await request.json()

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

    console.log("[Signing Challenge] Request received:", {
      transactionHash: transactionHash.substring(0, 20) + "...",
      userId: userId.substring(0, 10) + "..."
    })

    // Clean up old challenges
    cleanupChallenges()

    // Generate challenge
    const challenge = generateChallenge()
    console.log("[Signing Challenge] Generated challenge:", challenge.substring(0, 20) + "...")

    // Get user's passkeys for allowCredentials
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    // Get user's passkeys
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

    const { data: passkeys } = await serviceClient
      .from("passkeys")
      .select("credential_id, transports")
      .eq("user_id", userId)

    if (!passkeys || passkeys.length === 0) {
      return NextResponse.json(
        { error: "No passkeys found for user" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    // Store challenge with transaction hash as key
    // Format: "tx:{transactionHash}:{userId}"
    const challengeKey = `tx:${transactionHash}:${userId}`
    challengeStore.set(challengeKey, {
      challenge,
      timestamp: Date.now(),
    })
    console.log("[Signing Challenge] ✅ Stored challenge:", challengeKey.substring(0, 30) + "...")

    // Get rpID from request
    const rpID = getRpID(request)

    // Return WebAuthn authentication options
    return NextResponse.json(
      {
        challenge,
        rpId: rpID,
        rp: {
          name: rpName,
          id: rpID,
        },
        allowCredentials: passkeys.map((pk) => ({
          id: pk.credential_id,
          type: "public-key",
          transports: pk.transports && pk.transports.length > 0 
            ? pk.transports as AuthenticatorTransport[]
            : undefined,
        })),
        timeout: 60000,
        userVerification: "required",
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Signing Challenge] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate signing challenge" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
