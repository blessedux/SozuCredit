import { generateChallenge } from "@/lib/webauthn/utils"
import { challengeStore, cleanupChallenges, rpID, rpName } from "@/lib/webauthn/config"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    // Clean up old challenges
    cleanupChallenges()

    // Generate challenge
    const challenge = generateChallenge()

    // Store challenge temporarily (in production, use Redis)
    challengeStore.set(username, {
      challenge,
      timestamp: Date.now(),
    })

    // Return WebAuthn registration options
    return NextResponse.json({
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
        authenticatorAttachment: "platform",
        requireResidentKey: true,
        residentKey: "required",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    })
  } catch (error) {
    console.error("[v0] Registration challenge error:", error)
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500 })
  }
}
