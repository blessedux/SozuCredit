/**
 * Initialize Cross-Device Registration Session
 *
 * Desktop device calls this to create a session before showing QR code.
 * Returns sessionId for QR generation; phone completes registration separately.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { generateChallenge } from "@/lib/webauthn/utils"
import { challengeStore, cleanupChallenges } from "@/lib/webauthn/config"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username =
      typeof body?.username === "string" ? body.username.trim() : ""

    if (!username) {
      return NextResponse.json({ error: "Missing username" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[Cross-Device Init] Missing Supabase service credentials")
      return NextResponse.json({ error: "Service not available" }, { status: 500 })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: existingProfile, error: checkError } = await serviceClient
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .maybeSingle()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[Cross-Device Init] Username check failed:", checkError)
    }

    if (existingProfile) {
      return NextResponse.json(
        {
          error:
            "This Sozu tag is already taken. Please choose a different tag or log in.",
          usernameExists: true,
        },
        { status: 409 }
      )
    }

    cleanupChallenges()
    const challenge = generateChallenge()
    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60_000)

    challengeStore.set(username, {
      challenge,
      timestamp: Date.now(),
    })

    const { error: insertError } = await serviceClient
      .from("cross_device_sessions")
      .insert({
        session_id: sessionId,
        username,
        challenge,
        expires_at: expiresAt.toISOString(),
        completed: false,
      })

    if (insertError) {
      console.error("[Cross-Device Init] Error creating session:", insertError)
      return NextResponse.json(
        { error: "Failed to create session", details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sessionId,
      challenge,
      expiresAt: expiresAt.getTime(),
    })
  } catch (error) {
    console.error("[Cross-Device Init] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
