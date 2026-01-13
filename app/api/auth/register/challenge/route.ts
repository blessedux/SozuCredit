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

    // Check if username/tag already exists in database
    // This ensures 1 tag = 1 user = 1 passkey = 1 wallet
    // Use service role client to bypass RLS for username availability checks
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      console.error("[Register Challenge] Missing Supabase service credentials")
      return NextResponse.json(
        { error: "Service not available" },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    const { data: existingProfile, error: checkError } = await serviceClient
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .maybeSingle()
    
    if (checkError && checkError.code !== "PGRST116") { // PGRST116 = no rows returned
      console.error("[Register Challenge] Error checking for existing username:", checkError)
      // Continue anyway - let the registration verify endpoint handle it
    }
    
    if (existingProfile) {
      console.log("[Register Challenge] Username already exists:", username)
      return NextResponse.json(
        { 
          error: "This Sozu tag is already taken. Please choose a different tag or log in with your existing account.",
          usernameExists: true
        },
        { status: 409, headers: corsHeaders(request) }
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
