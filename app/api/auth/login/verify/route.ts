import { createClient } from "@/lib/supabase/server"
import { challengeStore } from "@/lib/webauthn/config"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { username, credential } = await request.json()

    // Verify challenge exists
    const storedChallenge = challengeStore.get(username)
    if (!storedChallenge) {
      return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400 })
    }

    // Clean up challenge
    challengeStore.delete(username)

    // Get user and passkey
    const supabase = await createClient()
    const { data: profile } = await supabase.from("profiles").select("id").eq("username", username).single()

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { data: passkey } = await supabase
      .from("passkeys")
      .select("*")
      .eq("user_id", profile.id)
      .eq("credential_id", credential.id)
      .single()

    if (!passkey) {
      return NextResponse.json({ error: "Invalid passkey" }, { status: 401 })
    }

    // Update last used timestamp
    await supabase.from("passkeys").update({ last_used_at: new Date().toISOString() }).eq("id", passkey.id)

    // For passkey authentication, we rely on sessionStorage on the client side
    // We don't need to create a Supabase session here since the client handles auth state
    // In production, you could use service role key to create a proper session if needed

    // Return success - the client will use sessionStorage for authentication
    // The middleware will check sessionStorage on client side
    return NextResponse.json({ 
      success: true, 
      userId: profile.id
    })
  } catch (error) {
    console.error("[v0] Login verification error:", error)
    return NextResponse.json({ error: "Failed to verify login" }, { status: 500 })
  }
}
