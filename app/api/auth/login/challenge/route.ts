import { createClient } from "@/lib/supabase/server"
import { generateChallenge } from "@/lib/webauthn/utils"
import { challengeStore, cleanupChallenges } from "@/lib/webauthn/config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Verify user exists
    const supabase = await createClient()
    const { data: profile } = await supabase.from("profiles").select("id").eq("username", username).single()

    if (!profile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    // Get user's passkeys
    const { data: passkeys } = await supabase.from("passkeys").select("credential_id").eq("user_id", profile.id)

    if (!passkeys || passkeys.length === 0) {
      return NextResponse.json(
        { error: "No passkeys found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    // Clean up old challenges
    cleanupChallenges()

    // Generate challenge
    const challenge = generateChallenge()

    // Store challenge temporarily
    challengeStore.set(username, {
      challenge,
      timestamp: Date.now(),
    })

    // Return WebAuthn authentication options with CORS headers
    return NextResponse.json(
      {
        challenge,
        allowCredentials: passkeys.map((pk) => ({
          id: pk.credential_id,
          type: "public-key",
          transports: ["internal"],
        })),
        timeout: 60000,
        userVerification: "required",
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Login Challenge] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate challenge" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
