import { createClient } from "@/lib/supabase/server"
import { challengeStore } from "@/lib/webauthn/config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const { username, credential } = await request.json()

    // Verify challenge exists
    const storedChallenge = challengeStore.get(username)
    if (!storedChallenge) {
      return NextResponse.json(
        { error: "Challenge not found or expired" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Clean up challenge
    challengeStore.delete(username)

    // Get user and passkey
    const supabase = await createClient()
    const { data: profile } = await supabase.from("profiles").select("id").eq("username", username).single()

    if (!profile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const { data: passkey } = await supabase
      .from("passkeys")
      .select("*")
      .eq("user_id", profile.id)
      .eq("credential_id", credential.id)
      .single()

    if (!passkey) {
      return NextResponse.json(
        { error: "Invalid passkey" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    // Update last used timestamp
    await supabase.from("passkeys").update({ last_used_at: new Date().toISOString() }).eq("id", passkey.id)

    // For passkey authentication, we rely on sessionStorage on the client side
    // We don't need to create a Supabase session here since the client handles auth state
    // In production, you could use service role key to create a proper session if needed

    // Return success - the client will use sessionStorage for authentication
    // The middleware will check sessionStorage on client side
    return NextResponse.json(
      { 
        success: true, 
        userId: profile.id
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Login] Login verification error:", error)
    
    // Provide more detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV === "development"
    
    return NextResponse.json(
      {
        error: "Failed to verify login",
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
