import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/**
 * POST /api/auth/username/check
 * Check if a username/tag is available for registration
 */
export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { 
          available: false,
          error: "Username is required" 
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Basic format validation (should match client-side validation)
    if (username.length < 3 || username.length > 30) {
      return NextResponse.json(
        { 
          available: false,
          error: "Username must be between 3 and 30 characters" 
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { 
          available: false,
          error: "Username can only contain letters, numbers, and underscores" 
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Check if username exists in database
    // Use service role client to bypass RLS for username availability checks
    // This is a legitimate use case - we're only checking existence, not exposing sensitive data
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      console.error("[Username Check] Missing Supabase service credentials")
      return NextResponse.json(
        { 
          available: false,
          error: "Service not available",
          message: "Unable to check username availability. Please try again."
        },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    let { data: existingProfile, error: checkError } = await serviceClient
      .from("profiles")
      .select("id, username, recovery_pin_hash")
      .ilike("username", username)
      .maybeSingle()

    if (checkError && (checkError.message?.includes("recovery_pin_hash") || checkError.code === "42703")) {
      const retry = await serviceClient.from("profiles").select("id, username").ilike("username", username).maybeSingle()
      existingProfile = retry.data as typeof existingProfile
      checkError = retry.error
    }
    
    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows returned (expected when username is available)
      console.error("[Username Check] Error checking for existing username:", checkError)
      return NextResponse.json(
        { 
          available: false,
          error: "Error checking username availability",
          message: "Unable to verify username availability. Please try again."
        },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    if (existingProfile) {
      const pinEnabled = Boolean((existingProfile as { recovery_pin_hash?: string | null }).recovery_pin_hash)
      return NextResponse.json(
        {
          available: false,
          exists: true,
          pinEnabled,
          message: pinEnabled
            ? "This name is taken. Sign in with your passkey or PIN."
            : "This name is taken. Sign in with your passkey.",
        },
        { status: 200, headers: corsHeaders(request) }
      )
    }

    // Username is available
    return NextResponse.json(
      {
        available: true,
        exists: false,
        pinEnabled: false,
        message: "This name is free.",
      },
      { status: 200, headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Username Check] Unexpected error:", error)
    return NextResponse.json(
      { 
        available: false,
        error: "Internal server error",
        message: "Unable to check username availability. Please try again."
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
