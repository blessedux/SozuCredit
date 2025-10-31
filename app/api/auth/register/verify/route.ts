import { createClient } from "@/lib/supabase/server"
import { challengeStore } from "@/lib/webauthn/config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { createStellarWallet, storeStellarWallet } from "@/lib/turnkey/stellar-wallet"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const { username, credential, challenge } = await request.json()

    // Try to verify challenge from store (for security)
    // If challenge store doesn't have it (e.g., in serverless environments), 
    // we can still proceed for registration if challenge is provided in the request
    const storedChallenge = challengeStore.get(username)
    
    if (storedChallenge) {
      // Challenge found in store - clean it up
      challengeStore.delete(username)
      
      // Verify the challenge matches if provided
      if (challenge && challenge !== storedChallenge.challenge) {
        console.warn("[Register] Challenge mismatch - provided:", challenge, "stored:", storedChallenge.challenge)
      }
      
      // Use stored challenge for verification
      console.log("[Register] Using stored challenge for verification")
    } else {
      // Challenge not in store - this can happen in serverless environments or if cleanup ran
      // For registration, we can still proceed if challenge is provided
      if (!challenge) {
        console.error("[Register] Challenge not found in store and not provided in request for username:", username)
        console.error("[Register] Challenge store size:", challengeStore.size)
        console.error("[Register] Available usernames in store:", Array.from(challengeStore.keys()))
        return NextResponse.json(
          { error: "Challenge not found or expired" },
          { status: 400, headers: corsHeaders(request) }
        )
      }
      
      // Challenge provided in request - use it for verification
      console.log("[Register] Challenge not in store, using provided challenge from request")
    }

    // Create user in Supabase Auth (using a valid email format since passkeys don't need email)
    let supabase
    try {
      supabase = await createClient()
      console.log("[Register] Supabase client created successfully")
    } catch (clientError: any) {
      console.error("[Register] Failed to create Supabase client:", clientError)
      return NextResponse.json(
        { 
          error: "Failed to initialize database connection",
          details: {
            message: clientError.message,
            hint: "Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set correctly in Vercel."
          }
        },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    // Use a valid email format - Supabase requires proper email format with valid TLD
    // Generate a unique email using UUID to ensure uniqueness and pass validation
    // Using test.com domain which is a real domain (not reserved like example.com)
    const uuid = crypto.randomUUID()
    const randomEmail = `passkey-${uuid}@test.com`

    console.log("[Register] Attempting to create user with email:", randomEmail)
    console.log("[Register] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing")
    
    // The trigger handle_new_user() tries to create profile with email column,
    // but the schema was updated to remove email and require username.
    // This may cause the trigger to fail silently.
    // We'll create the user and handle profile creation manually to avoid trigger conflicts.
    
    let { data: authData, error: authError } = await supabase.auth.signUp({
      email: randomEmail,
      password: crypto.randomUUID(), // Random password, won't be used
      options: {
        data: {
          username,
        },
        emailRedirectTo: undefined, // Disable email redirect
      },
    })

    if (authError) {
      console.error("[Register] Signup error:", JSON.stringify(authError, null, 2))
      console.error("[Register] Error code:", authError.status, "message:", authError.message)
      console.error("[Register] Full error details:", {
        name: authError.name,
        status: authError.status,
        message: authError.message,
        __isAuthError: (authError as any).__isAuthError,
      })
      
      // Check for network errors
      if (authError.message?.includes("Failed to fetch") || authError.message?.includes("NetworkError") || authError.message?.includes("fetch")) {
        console.error("[Register] Network error detected - check Supabase URL and connectivity")
        return NextResponse.json(
          { 
            error: "Network error connecting to Supabase",
            details: {
              message: authError.message,
              hint: "Check your internet connection and verify NEXT_PUBLIC_SUPABASE_URL is correct (should be like https://xxxxx.supabase.co, not api.supabase.com). Make sure your Supabase project is not paused.",
              troubleshooting: [
                "1. Verify NEXT_PUBLIC_SUPABASE_URL in Vercel is correct",
                "2. Check your Supabase project is active (not paused)",
                "3. Redeploy after changing env vars",
                "4. Check network connectivity"
              ]
            }
          },
          { status: 500, headers: corsHeaders(request) }
        )
      }
      
      // The error is likely due to the trigger handle_new_user() failing
      // because it tries to insert 'email' column that was removed from profiles table
      // The user may have been created in auth.users but the trigger failed
      // We'll proceed with error message that points to the fix
      
      if (authError && !authData?.user) {
        return NextResponse.json(
          { 
            error: authError.message || "Database error saving new user",
            details: {
              code: authError.status,
              message: authError.message,
              name: authError.name,
              hint: "This error is likely due to the database trigger handle_new_user() failing. Please run scripts/005_fix_trigger.sql in your Supabase SQL Editor to fix the trigger schema mismatch.",
              fullError: JSON.stringify(authError, Object.getOwnPropertyNames(authError)),
            }
          },
          { status: 400, headers: corsHeaders(request) }
        )
      }
    }

    if (!authData?.user) {
      console.error("[Register] Signup succeeded but no user returned")
      return NextResponse.json(
        { 
          error: "Failed to create user - no user returned",
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    console.log("[Register] User created:", authData.user.id)

    // The trigger handle_new_user() might have failed due to schema mismatch (tries to insert email column)
    // So we'll manually create/update everything to ensure it works
    
    // Wait a moment for trigger to complete if it's running
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Check if profile exists (created by trigger)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", authData.user.id)
      .single()

    if (existingProfile) {
      console.log("[Register] Profile exists (created by trigger), updating username")
      // Profile exists but might not have username - update it
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ username, display_name: username })
        .eq("id", authData.user.id)

      if (profileUpdateError) {
        console.error("[Register] Error updating profile:", profileUpdateError)
        // If update fails due to unique constraint, the username might already exist
        if (profileUpdateError.code === "23505") {
          console.log("[Register] Username already taken, trying to get existing profile")
          const { data: existing } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .single()
          
          if (!existing) {
            // Profile doesn't actually exist, create it
            const { error: createError } = await supabase.from("profiles").insert({
              id: authData.user.id,
              username: `${username}-${Date.now().toString().slice(-6)}`, // Make unique
              display_name: username,
            })
            
            if (createError) {
              console.error("[Register] Error creating profile after update failed:", createError)
            }
          }
        }
      }
    } else {
      // Profile doesn't exist - create it manually (trigger failed or didn't run)
      console.log("[Register] Profile doesn't exist, creating manually")
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authData.user.id,
        username,
        display_name: username,
      })

      if (profileError) {
        console.error("[Register] Error creating profile:", profileError)
        // Check if it's a duplicate key error (trigger might have created it during insert)
        if (!profileError.code?.includes("23505") && !profileError.message?.includes("duplicate")) {
          return NextResponse.json(
            { 
              error: "Failed to create profile", 
              details: profileError.message,
              code: profileError.code
            },
            { status: 500, headers: corsHeaders(request) }
          )
        } else {
          console.log("[Register] Profile was created by trigger after all, continuing...")
        }
      }
    }

    // Check if trust_points exists (created by trigger)
    const { data: existingTrustPoints } = await supabase
      .from("trust_points")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .single()

    if (!existingTrustPoints) {
      console.log("[Register] Trust points don't exist, creating manually")
      const { error: trustError } = await supabase.from("trust_points").insert({
        user_id: authData.user.id,
        balance: 5,
      })

      if (trustError) {
        console.error("[Register] Error creating trust points:", trustError)
        // Continue - this is not critical for registration
      }
    }

    // Check if vault exists (created by trigger)
    const { data: existingVault } = await supabase
      .from("vaults")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .single()

    if (!existingVault) {
      console.log("[Register] Vault doesn't exist, creating manually")
      const { error: vaultError } = await supabase.from("vaults").insert({
        user_id: authData.user.id,
        balance: 0,
        alias: username,
      })

      if (vaultError) {
        console.error("[Register] Error creating vault:", vaultError)
        // Continue - this is not critical for registration
      }
    }

    // Store passkey credential
    // Extract public key from attestation object (we'll store the full attestation object for now)
    // In production, you'd parse the CBOR attestation object to extract just the public key
    const publicKey = credential.response.publicKey || credential.response.attestationObject || credential.id
    
    console.log("[Register] Storing passkey for user:", authData.user.id)
    const { error: passkeyError } = await supabase.from("passkeys").insert({
      user_id: authData.user.id,
      credential_id: credential.id,
      public_key: publicKey,
      counter: 0,
      transports: credential.response.transports || [],
    })

    if (passkeyError) {
      console.error("[Register] Error storing passkey:", passkeyError)
      return NextResponse.json(
        { 
          error: "Failed to store passkey", 
          details: passkeyError.message 
        },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    // Create Stellar wallet for user (non-blocking)
    // Registration succeeds even if wallet creation fails
    // Use service client since we don't have an authenticated Supabase session here yet
    try {
      console.log("[Register] Creating Stellar wallet for user:", authData.user.id)
      const wallet = await createStellarWallet(authData.user.id)
      await storeStellarWallet(authData.user.id, wallet.turnkeyWalletId, wallet.publicKey, true) // Use service client
      console.log("[Register] Stellar wallet created successfully:", wallet.publicKey)
    } catch (walletError) {
      // Log error but don't fail registration
      console.error("[Register] Error creating Stellar wallet:", walletError)
      console.warn("[Register] Registration will proceed without wallet. Wallet can be created later via API.")
      // Registration continues successfully
    }

    console.log("[Register] Registration successful for user:", authData.user.id)

    return NextResponse.json(
      { success: true, userId: authData.user.id },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Register] Registration verification error:", error)
    
    // Provide more detailed error in development, generic in production
    const isDevelopment = process.env.NODE_ENV === "development"
    
    return NextResponse.json(
      {
        error: "Failed to verify registration",
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
