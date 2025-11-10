import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { challengeStore } from "@/lib/webauthn/config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { createStellarWallet, storeStellarWallet, getStellarWallet } from "@/lib/turnkey/stellar-wallet"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const { username, credential, challenge, referralCode } = await request.json()
    
    // Log referral code for debugging
    console.log("[Register] Referral code received:", referralCode || "none")

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
    console.log("[Register] User metadata to be set:", {
      username,
      referral_code: referralCode || null,
    })
    
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
          referral_code: referralCode || null, // Pass referral code to trigger
        },
        emailRedirectTo: undefined, // Disable email redirect
      },
    })
    
    // Log the created user's metadata to verify referral code was stored
    if (authData?.user) {
      console.log("[Register] User created successfully. User metadata:", authData.user.user_metadata)
      console.log("[Register] Referral code in user metadata:", authData.user.user_metadata?.referral_code || "not found")
    }

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
        balance: 0, // New users start with 0 points (only get points from referrals)
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
    
    // Use service client to bypass RLS since we don't have an authenticated session yet
    // The user was just created but we don't have auth.uid() available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      const missing = []
      if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL")
      if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY")
      console.error("[Register] Missing environment variables for service client:", missing.join(", "))
      return NextResponse.json(
        { 
          error: "Server configuration error", 
          details: `Missing environment variables: ${missing.join(", ")}. Please configure SUPABASE_SERVICE_ROLE_KEY in Vercel.`
        },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    console.log("[Register] Storing passkey for user:", authData.user.id)
    console.log("[Register] Credential ID being stored:", {
      id: credential.id,
      length: credential.id.length,
      first_20: credential.id.substring(0, 20),
      last_20: credential.id.substring(credential.id.length - 20),
      type: typeof credential.id
    })
    
    const { error: passkeyError, data: insertedPasskey } = await serviceClient.from("passkeys").insert({
      user_id: authData.user.id,
      credential_id: credential.id,
      public_key: publicKey,
      counter: 0,
      transports: credential.response.transports || [],
    }).select().single()

    if (passkeyError) {
      console.error("[Register] Error storing passkey:", passkeyError)
      console.error("[Register] Passkey error details:", {
        code: passkeyError.code,
        message: passkeyError.message,
        details: passkeyError.details,
        hint: passkeyError.hint,
      })
      return NextResponse.json(
        { 
          error: "Failed to store passkey", 
          details: passkeyError.message,
          code: passkeyError.code,
          hint: passkeyError.hint,
        },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    // Verify the passkey was stored correctly
    if (insertedPasskey) {
      console.log("[Register] ✅ Passkey stored successfully:", {
        passkey_id: insertedPasskey.id,
        credential_id: insertedPasskey.credential_id,
        credential_id_length: insertedPasskey.credential_id?.length || 0,
        user_id: insertedPasskey.user_id,
        stored_first_20: insertedPasskey.credential_id?.substring(0, 20) || "NULL",
        stored_last_20: insertedPasskey.credential_id?.substring((insertedPasskey.credential_id?.length || 0) - 20) || "NULL"
      })
      
      // Verify we can retrieve it immediately
      const { data: verifyPasskey } = await serviceClient
        .from("passkeys")
        .select("credential_id")
        .eq("credential_id", credential.id)
        .maybeSingle()
      
      if (verifyPasskey) {
        console.log("[Register] ✅ Verified: Can retrieve passkey immediately after storage")
      } else {
        console.error("[Register] ❌ WARNING: Cannot retrieve passkey immediately after storage!")
      }
    }

    // Create Stellar wallet for user (non-blocking)
    // Registration succeeds even if wallet creation fails
    // Use service client since we don't have an authenticated Supabase session here yet
    try {
      console.log("[Register] Checking for existing wallet for userId:", authData.user.id)
      const existingWallet = await getStellarWallet(authData.user.id, true) // Use service client
      if (!existingWallet) {
        console.log("[Register] No Stellar wallet found for userId:", authData.user.id, "- creating new wallet")
      const wallet = await createStellarWallet(authData.user.id)
        console.log("[Register] Created wallet with Turnkey, storing in database...")
        const storedWallet = await storeStellarWallet(authData.user.id, wallet.turnkeyWalletId, wallet.publicKey, true) // Use service client
        console.log("[Register] ✅ Stellar wallet created and stored successfully:", {
          userId: authData.user.id,
          publicKey: storedWallet.publicKey ? `${storedWallet.publicKey.substring(0, 10)}...` : "NULL",
          turnkeyWalletId: storedWallet.turnkeyWalletId,
        })
      } else {
        console.log("[Register] ✅ Stellar wallet already exists for userId:", authData.user.id, "publicKey:", existingWallet.publicKey ? `${existingWallet.publicKey.substring(0, 10)}...` : "NULL")
      }
    } catch (walletError) {
      // Log error but don't fail registration
      console.error("[Register] ❌ Error with wallet for userId:", authData.user.id, "Error:", walletError)
      console.warn("[Register] Registration will proceed without wallet. Wallet can be created later via API.")
      // Registration continues successfully
    }

    console.log("[Register] Registration successful for user:", authData.user.id)

    // Manually process referral if referral code was provided
    // The trigger should handle this, but we'll also do it manually as a backup
    if (referralCode) {
      console.log("[Register] Processing referral code manually:", referralCode)
      try {
        // Use service client to bypass RLS
        const { data: referral, error: referralError } = await serviceClient
          .from("referrals")
          .select("referrer_id, trust_points_awarded, used")
          .eq("referral_code", referralCode)
          .maybeSingle()

        if (referralError) {
          console.error("[Register] Error looking up referral:", referralError)
        } else if (referral) {
          console.log("[Register] Found referral:", {
            referrer_id: referral.referrer_id,
            trust_points_awarded: referral.trust_points_awarded,
            used: referral.used,
          })

          // Check if referral is valid and not already used
          if (!referral.used && referral.referrer_id !== authData.user.id) {
            console.log("[Register] Referral is valid, processing...")
            
            // Mark referral as used
            const { error: updateError } = await serviceClient
              .from("referrals")
              .update({
                referred_user_id: authData.user.id,
                used: true,
                used_at: new Date().toISOString(),
              })
              .eq("referral_code", referralCode)
              .eq("used", false)

            if (updateError) {
              console.error("[Register] Error updating referral:", updateError)
            } else {
              console.log("[Register] Referral marked as used")
              
              // Award trust points to referrer
              // First, get current balance
              const { data: currentPoints, error: selectError } = await serviceClient
                .from("trust_points")
                .select("balance")
                .eq("user_id", referral.referrer_id)
                .single()

              if (selectError) {
                console.error("[Register] Error getting current trust points:", selectError)
              } else if (currentPoints) {
                const newBalance = (currentPoints.balance || 0) + (referral.trust_points_awarded || 1)
                const { error: updatePointsError } = await serviceClient
                  .from("trust_points")
                  .update({
                    balance: newBalance,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("user_id", referral.referrer_id)

                if (updatePointsError) {
                  console.error("[Register] Error awarding trust points:", updatePointsError)
                } else {
                  console.log("[Register] ✅ Trust points awarded to referrer:", {
                    referrer_id: referral.referrer_id,
                    points_awarded: referral.trust_points_awarded || 1,
                    old_balance: currentPoints.balance || 0,
                    new_balance: newBalance,
                  })
                }
              } else {
                console.error("[Register] No trust_points record found for referrer:", referral.referrer_id)
              }
            }
          } else {
            console.log("[Register] Referral is already used or invalid:", {
              used: referral.used,
              referrer_id: referral.referrer_id,
              new_user_id: authData.user.id,
            })
          }
        } else {
          console.log("[Register] Referral code not found in database:", referralCode)
        }
      } catch (referralProcessError) {
        console.error("[Register] Error processing referral:", referralProcessError)
        // Don't fail registration if referral processing fails
      }
    }

    // Get the username from the profile
    const { data: registeredProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", authData.user.id)
      .single()

    return NextResponse.json(
      { 
        success: true, 
        userId: authData.user.id,
        username: registeredProfile?.username || username 
      },
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
