import { generateChallenge } from "@/lib/webauthn/utils"
import { challengeStore, cleanupChallenges, getRpID, rpName } from "@/lib/webauthn/config"
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

    // Clean up old challenges
    cleanupChallenges()

    // Generate challenge
    const challenge = generateChallenge()

    // Get the correct rpID from the request (for Vercel deployment)
    const rpID = getRpID(request)

    // Store challenge temporarily (in production, use Redis)
    challengeStore.set(username, {
      challenge,
      timestamp: Date.now(),
    })

    // Return WebAuthn registration options with CORS headers
    return NextResponse.json(
      {
        challenge,
        rp: {
          name: rpName,
          id: rpID,
        },
        user: {
          id: username,
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" }, // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          // Don't restrict to platform - allow both device-stored and browser-stored passkeys
          // This allows users to choose which type they prefer
          requireResidentKey: true,
          residentKey: "required",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Register Challenge] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate challenge" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
