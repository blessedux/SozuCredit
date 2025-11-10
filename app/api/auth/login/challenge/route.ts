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

    console.log("[Login Challenge] Request received - username:", username || "(empty/not provided)", "type:", typeof username)

    // Clean up old challenges (but keep recent ones)
    cleanupChallenges()

    // Generate challenge
    const challenge = generateChallenge()
    console.log("[Login Challenge] Generated challenge:", challenge.substring(0, 20) + "...")

    // If username provided and not empty, try to get specific passkeys for that user
    if (username && typeof username === "string" && username !== "") {
      console.log("[Login Challenge] Username provided:", username)
      
      // Verify user exists
      const supabase = await createClient()
      const { data: profile } = await supabase.from("profiles").select("id").eq("username", username).single()

      if (profile) {
        // Get user's passkeys with their transport information
        const { data: passkeys } = await supabase
          .from("passkeys")
          .select("credential_id, transports")
          .eq("user_id", profile.id)

        if (passkeys && passkeys.length > 0) {
          console.log("[Login Challenge] Found", passkeys.length, "passkey(s) for user:", username)
          
          // Store challenge temporarily
          challengeStore.set(username, {
            challenge,
            timestamp: Date.now(),
          })
          console.log("[Login Challenge] ✅ Stored challenge under username key:", username, "Store size:", challengeStore.size)

          // Return WebAuthn authentication options with CORS headers
          // Include all passkeys with their stored transport types
          // If no transports stored, allow all transports (browser will handle selection)
          return NextResponse.json(
            {
              challenge,
              allowCredentials: passkeys.map((pk) => ({
                id: pk.credential_id,
                type: "public-key",
                // Use stored transports if available, otherwise omit to allow all transports
                transports: pk.transports && pk.transports.length > 0 
                  ? pk.transports as AuthenticatorTransport[]
                  : undefined, // Omit transports to allow browser to use any available transport
              })),
              timeout: 60000,
              userVerification: "required",
            },
            { headers: corsHeaders(request) }
          )
        }
      }
    }

    // If no username or user not found, allow discovery of any passkey
    // This enables passkey-based login without requiring username
    console.log("[Login Challenge] Username not provided or user not found, enabling passkey discovery")
    
    // Store challenge with a special key for discovery mode
    challengeStore.set("__discovery__", {
      challenge,
      timestamp: Date.now(),
    })
    console.log("[Login Challenge] ✅ Stored challenge under discovery key: __discovery__, Store size:", challengeStore.size, "Store keys:", [...challengeStore.keys()])

    // Return WebAuthn authentication options without allowCredentials
    // This allows the browser to discover and use any registered passkey
    return NextResponse.json(
      {
        challenge,
        // Omit allowCredentials to enable passkey discovery
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
