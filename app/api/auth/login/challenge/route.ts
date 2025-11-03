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
    const { username, userId } = await request.json()

    // Accept either username or userId (userId is preferred since it never changes)
    if (!username && !userId) {
      return NextResponse.json(
        { error: "Username or userId is required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Verify user exists
    const supabase = await createClient()
    let profile
    
    if (userId) {
      // Use userId if provided (preferred method - more reliable)
      const { data: profileById } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("id", userId)
        .single()
      
      if (!profileById) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: corsHeaders(request) }
        )
      }
      profile = profileById
      console.log("[Login Challenge] Found user by userId:", userId, "username:", profile.username)
    } else if (username) {
      // Fallback to username lookup (for backward compatibility)
      const { data: profileByUsername } = await supabase
        .from("profiles")
        .select("id, username")
        .eq("username", username)
        .single()
      
      if (!profileByUsername) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: corsHeaders(request) }
        )
      }
      profile = profileByUsername
      console.log("[Login Challenge] Found user by username:", username, "userId:", profile.id)
    }

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

    // Store challenge temporarily using userId (preferred) or username (fallback)
    // Using userId as key ensures challenges work even if username changes
    // Store under both userId and username keys for backward compatibility
    const challengeKey = userId || profile.id || username
    
    challengeStore.set(challengeKey, {
      challenge,
      timestamp: Date.now(),
    })
    
    // Also store under username key if different from userId (for backward compatibility)
    if (username && username !== challengeKey) {
      challengeStore.set(username, {
        challenge,
        timestamp: Date.now(),
      })
    }

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
