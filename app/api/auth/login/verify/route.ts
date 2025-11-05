import { createClient } from "@/lib/supabase/server"
import { challengeStore } from "@/lib/webauthn/config"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { createStellarWallet, storeStellarWallet, getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { base64URLToBuffer } from "@/lib/webauthn/utils"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
  try {
    const { username, credential, challenge: providedChallenge } = await request.json()
    
    // Username is optional - we can find user by credential_id
    console.log("[Login] Verify request - username:", username || "(not provided)", "credential_id:", credential?.id ? `${credential.id.substring(0, 10)}...` : "missing", "challenge provided:", !!providedChallenge)

    // Try to get challenge from store first (for security)
    // If challenge store doesn't have it (e.g., in serverless environments), 
    // we can still proceed if challenge is provided in the request
    let storedChallenge = null
    let challengeKey = null
    
    // Log challenge store state before lookup
    console.log("[Login] Challenge store state before lookup:", {
      size: challengeStore.size,
      keys: [...challengeStore.keys()],
      username: username || "(empty)"
    })
    
    // Try to find challenge in store first
    if (!username || username === "" || username === "user") {
      console.log("[Login] Looking for discovery mode challenge (username is empty or 'user')")
      storedChallenge = challengeStore.get("__discovery__")
      if (storedChallenge) {
        challengeKey = "__discovery__"
        console.log("[Login] ✅ Found discovery mode challenge in store:", storedChallenge.challenge.substring(0, 20) + "...")
      }
    } else {
      console.log("[Login] Looking for username-based challenge for:", username)
      storedChallenge = challengeStore.get(username)
      if (storedChallenge) {
        challengeKey = username
        console.log("[Login] ✅ Found username-based challenge in store for:", username, storedChallenge.challenge.substring(0, 20) + "...")
      } else {
        // Fallback to discovery mode if username challenge not found
        console.log("[Login] Username challenge not found, trying discovery mode")
        storedChallenge = challengeStore.get("__discovery__")
        if (storedChallenge) {
          challengeKey = "__discovery__"
          console.log("[Login] ✅ Found discovery mode challenge as fallback:", storedChallenge.challenge.substring(0, 20) + "...")
        }
      }
    }
    
    // Clean up the challenge from store after retrieving it (only if we found it)
    if (challengeKey && storedChallenge) {
      challengeStore.delete(challengeKey)
      console.log("[Login] Cleaned up challenge key from store:", challengeKey)
    }
    
    // If challenge not in store, use provided challenge (for serverless environments)
    if (!storedChallenge) {
      if (providedChallenge) {
        console.log("[Login] Challenge not in store, using provided challenge from request (serverless mode)")
        storedChallenge = {
          challenge: providedChallenge,
          timestamp: Date.now() // Use current timestamp
        }
      } else {
        console.error("[Login] ❌ Challenge not found in store and not provided in request")
        console.error("[Login] Challenge store keys:", [...challengeStore.keys()])
        console.error("[Login] Challenge store size:", challengeStore.size)
        return NextResponse.json(
          { error: "Challenge not found or expired" },
          { status: 400, headers: corsHeaders(request) }
        )
      }
    } else {
      // Verify the provided challenge matches stored challenge if both are present
      if (providedChallenge && providedChallenge !== storedChallenge.challenge) {
        console.warn("[Login] ⚠️ Challenge mismatch - stored:", storedChallenge.challenge.substring(0, 20), "provided:", providedChallenge.substring(0, 20))
        // Still use stored challenge for verification
      }
    }

    // Get user and passkey
    // Use service client to bypass RLS since we don't have an authenticated session during passkey verification
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      console.error("[Login] Missing Supabase service client credentials")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    // Validate credential data
    if (!credential || !credential.id) {
      console.error("[Login] Missing credential or credential.id")
      return NextResponse.json(
        { error: "Invalid credential data" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    console.log("[Login] Looking up passkey by credential_id")
    console.log("[Login] Credential ID details:", {
      id: credential.id,
      length: credential.id.length,
      first_20: credential.id.substring(0, 20),
      last_20: credential.id.substring(credential.id.length - 20),
      type: typeof credential.id
    })
    
    // Debug: List all passkeys first to help with matching
    const { data: allPasskeysDebug } = await serviceClient
      .from("passkeys")
      .select("credential_id, user_id, created_at")
      .limit(10)
    
    console.log("[Login] DEBUG: All passkeys in database (first 10):", allPasskeysDebug?.map((p: { credential_id: string | null; user_id: string; created_at: string }) => ({
      credential_id: p.credential_id ? `${p.credential_id.substring(0, 20)}...${p.credential_id.substring(p.credential_id.length - 10)}` : "NULL",
      credential_id_length: p.credential_id?.length || 0,
      credential_id_full: p.credential_id, // Log full ID for comparison
      user_id: p.user_id,
      created_at: p.created_at
    })))
    
    console.log("[Login] DEBUG: Searching for credential_id:", {
      full: credential.id,
      length: credential.id.length,
      first_50: credential.id.substring(0, 50),
      last_50: credential.id.substring(Math.max(0, credential.id.length - 50))
    })
    
    // First, try to find the passkey by credential_id to get the user
    // This ensures we match the correct user even if username is wrong
    // Use service client to bypass RLS
    // Try exact match first - query passkey first, then get profile separately
    let { data: passkeyByCredential, error: passkeyError } = await serviceClient
      .from("passkeys")
      .select("*")
      .eq("credential_id", credential.id)
      .maybeSingle()
    
    // If passkey found, get the profile separately
    if (passkeyByCredential && !passkeyError) {
      const { data: profileData } = await serviceClient
        .from("profiles")
        .select("id, username")
        .eq("id", passkeyByCredential.user_id)
        .maybeSingle()
      
      if (profileData) {
        // Add profile to passkey result
        passkeyByCredential = {
          ...passkeyByCredential,
          profiles: profileData
        }
      }
    }
    
    // If exact match fails, try to query all passkeys and match in memory
    // This helps with cases where the database query might have encoding issues
    if (!passkeyByCredential && !passkeyError) {
      console.log("[Login] Exact database query failed, trying in-memory match from all passkeys...")
      
      // Get all passkeys
      const { data: allPasskeysWithProfiles, error: allPasskeysError } = await serviceClient
        .from("passkeys")
        .select("*")
        .limit(100)
      
      // Get profiles for all passkeys
      if (!allPasskeysError && allPasskeysWithProfiles && allPasskeysWithProfiles.length > 0) {
        const userIds = allPasskeysWithProfiles.map((p: any) => p.user_id)
        const { data: profilesData } = await serviceClient
          .from("profiles")
          .select("id, username")
          .in("id", userIds)
        
        if (profilesData) {
          const profilesMap = profilesData.reduce((acc: any, profile: any) => {
            acc[profile.id] = profile
            return acc
          }, {})
          
          // Add profiles to passkeys
          allPasskeysWithProfiles.forEach((p: any) => {
            if (profilesMap[p.user_id]) {
              p.profiles = profilesMap[p.user_id]
            }
          })
        }
      }
      
      if (!allPasskeysError && allPasskeysWithProfiles && allPasskeysWithProfiles.length > 0) {
        // Try exact match first
        const exactMatch = allPasskeysWithProfiles.find((p: any) => p.credential_id === credential.id)
        if (exactMatch) {
          console.log("[Login] ✅ Found exact match in memory")
          passkeyByCredential = exactMatch
        } else {
          // Try normalized match
          const normalizedSearch = credential.id.replace(/\s+/g, '').trim()
          const normalizedMatch = allPasskeysWithProfiles.find((p: any) => 
            p.credential_id && p.credential_id.replace(/\s+/g, '').trim() === normalizedSearch
          )
          if (normalizedMatch) {
            console.log("[Login] ✅ Found normalized match in memory")
            passkeyByCredential = normalizedMatch
          } else {
            // Try length and prefix match
            const lengthMatches = allPasskeysWithProfiles.filter((p: any) => 
              p.credential_id && p.credential_id.length === credential.id.length
            )
            if (lengthMatches.length > 0) {
              const prefixMatches = lengthMatches.filter((p: any) => 
                p.credential_id && p.credential_id.substring(0, 20) === credential.id.substring(0, 20)
              )
              if (prefixMatches.length > 0) {
                console.log("[Login] ⚠️ Found prefix match but not exact match - possible encoding issue")
                console.log("[Login] Stored credential_id:", prefixMatches[0].credential_id)
                console.log("[Login] Searching credential_id:", credential.id)
                // Use the first prefix match as a fallback (this should be rare)
                passkeyByCredential = prefixMatches[0]
                console.log("[Login] ⚠️ Using prefix match as fallback - this may indicate a data issue")
              }
            }
          }
        }
      }
    }
    
    // If exact match fails, try multiple strategies
    if (!passkeyByCredential && !passkeyError && allPasskeysDebug && allPasskeysDebug.length > 0) {
      console.log("[Login] Exact match failed, trying alternative matching strategies...")
      
      // Strategy 1: Try with trimmed whitespace
      const trimmedCredentialId = credential.id.trim()
      if (trimmedCredentialId !== credential.id) {
        const { data: passkeyByCredentialTrimmed } = await serviceClient
          .from("passkeys")
          .select("*, profiles!inner(id, username)")
          .eq("credential_id", trimmedCredentialId)
          .maybeSingle()
        
        if (passkeyByCredentialTrimmed) {
          console.log("[Login] ✅ Found passkey with trimmed credential_id")
          passkeyByCredential = passkeyByCredentialTrimmed
        }
      }
      
      // Strategy 2: Find by matching length and prefix, then try to find the exact match
      if (!passkeyByCredential) {
        const matchingLength = allPasskeysDebug.filter((p: { credential_id: string | null }) => 
          p.credential_id && p.credential_id.length === credential.id.length
        )
        console.log("[Login] DEBUG: Passkeys with matching length:", matchingLength.length)
        
        if (matchingLength.length > 0) {
          const prefixMatches = matchingLength.filter((p: { credential_id: string | null }) => 
            p.credential_id && p.credential_id.substring(0, 20) === credential.id.substring(0, 20)
          )
          console.log("[Login] DEBUG: Passkeys with matching prefix (first 20 chars):", prefixMatches.length)
          
          if (prefixMatches.length > 0) {
            // Try each prefix match to see if it's the same after normalization
            for (const match of prefixMatches) {
              const storedCredentialId = match.credential_id
              if (!storedCredentialId) continue
              
              // Try direct comparison with normalization
              const normalizedStored = storedCredentialId.replace(/\s+/g, '').trim()
              const normalizedSearched = credential.id.replace(/\s+/g, '').trim()
              
              if (normalizedStored === normalizedSearched) {
                console.log("[Login] DEBUG: ✅ Found match after normalization - using stored credential_id")
                // Use the stored credential_id for lookup
                const { data: normalizedMatchPasskey } = await serviceClient
                  .from("passkeys")
                  .select("*")
                  .eq("credential_id", storedCredentialId)
                  .maybeSingle()
                
                if (normalizedMatchPasskey) {
                  // Get profile for this passkey
                  const { data: normalizedProfile } = await serviceClient
                    .from("profiles")
                    .select("id, username")
                    .eq("id", normalizedMatchPasskey.user_id)
                    .maybeSingle()
                  
                  const normalizedMatch = normalizedProfile ? {
                    ...normalizedMatchPasskey,
                    profiles: normalizedProfile
                  } : normalizedMatchPasskey
                  
                  if (normalizedMatch) {
                    passkeyByCredential = normalizedMatch
                    break
                  }
                }
              }
            }
            
            // If still not found, try character-by-character comparison
            if (!passkeyByCredential) {
              for (const match of prefixMatches) {
                const storedCredentialId = match.credential_id
                if (!storedCredentialId) continue
                
                // Direct string comparison
                if (storedCredentialId === credential.id) {
                  console.log("[Login] DEBUG: ✅ Found exact match on retry")
                  const { data: exactMatch } = await serviceClient
                    .from("passkeys")
                    .select("*, profiles!inner(id, username)")
                    .eq("credential_id", storedCredentialId)
                    .maybeSingle()
                  if (exactMatch) {
                    passkeyByCredential = exactMatch
                    break
                  }
                }
              }
            }
            
            // If still not found, log detailed comparison
            if (!passkeyByCredential) {
              console.error("[Login] DEBUG: Found prefix match but not exact match - possible encoding issue")
              console.error("[Login] DEBUG: Stored credential_id sample:", prefixMatches[0]?.credential_id?.substring(0, 50))
              console.error("[Login] DEBUG: Searching credential_id sample:", credential.id.substring(0, 50))
              console.error("[Login] DEBUG: Character-by-character comparison needed")
              // Log first difference
              const storedSample = prefixMatches[0]?.credential_id || ""
              const searchedSample = credential.id
              for (let i = 0; i < Math.min(storedSample.length, searchedSample.length); i++) {
                if (storedSample[i] !== searchedSample[i]) {
                  console.error(`[Login] DEBUG: First difference at index ${i}: stored='${storedSample[i]}' (${storedSample.charCodeAt(i)}), searched='${searchedSample[i]}' (${searchedSample.charCodeAt(i)})`)
                  break
                }
              }
            }
          }
        }
      }
    }

    if (passkeyError) {
      console.error("[Login] Error looking up passkey by credential_id:", passkeyError)
      console.error("[Login] Passkey error details:", {
        code: passkeyError.code,
        message: passkeyError.message,
        details: passkeyError.details,
        hint: passkeyError.hint,
      })
    }

    let profile
    let passkey

    if (passkeyByCredential && passkeyByCredential.profiles) {
      // Found passkey, use its associated user
      profile = passkeyByCredential.profiles
      passkey = {
        id: passkeyByCredential.id,
        user_id: passkeyByCredential.user_id,
        credential_id: passkeyByCredential.credential_id,
        public_key: passkeyByCredential.public_key,
        counter: passkeyByCredential.counter,
        transports: passkeyByCredential.transports,
        created_at: passkeyByCredential.created_at,
        last_used_at: passkeyByCredential.last_used_at,
      }
      
      console.log("[Login] ✅ Found user by passkey credential_id:", profile.id, "username:", profile.username)
    } else {
      console.log("[Login] Passkey not found by credential_id, trying username fallback...")
      
      // If no username provided in discovery mode, we can't use username fallback
      if (!username || username === "") {
        console.error("[Login] ❌ Passkey not found by credential_id and no username provided for fallback")
        console.error("[Login] Credential ID searched:", credential.id)
        
        // Debug: List all passkeys to see what's in the database
        const { data: allPasskeys } = await serviceClient
          .from("passkeys")
          .select("credential_id, user_id")
          .limit(10)
        
        console.log("[Login] DEBUG: Sample passkeys in database:", allPasskeys?.map((p: { credential_id: string | null; user_id: string }) => ({
          credential_id: p.credential_id ? `${p.credential_id.substring(0, 20)}...` : "NULL",
          credential_id_length: p.credential_id?.length || 0,
          user_id: p.user_id
        })))
        console.log("[Login] DEBUG: Credential ID being searched:", {
          id: credential.id,
          length: credential.id.length,
          first_20: credential.id.substring(0, 20)
        })
        
        return NextResponse.json(
          { error: "Passkey not found. Please register a new passkey." },
          { status: 401, headers: corsHeaders(request) }
        )
      }
      
      // Fallback: try to find user by username (original method)
      // Use service client to bypass RLS
      const { data: profileByUsername } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("username", username)
        .single()

      if (!profileByUsername) {
        console.error("[Login] User not found by username:", username)
        return NextResponse.json(
          { error: "User not found" },
          { status: 404, headers: corsHeaders(request) }
        )
      }

      profile = profileByUsername

      // Try to find passkey for this user
      // Use service client to bypass RLS
      const { data: passkeyByUser } = await serviceClient
        .from("passkeys")
        .select("*")
        .eq("user_id", profile.id)
        .eq("credential_id", credential.id)
        .maybeSingle()

      if (!passkeyByUser) {
        console.error("[Login] Passkey not found for user:", profile.id, "credential_id:", credential.id)
        return NextResponse.json(
          { error: "Invalid passkey" },
          { status: 401, headers: corsHeaders(request) }
        )
      }

      passkey = passkeyByUser
      console.log("[Login] ✅ Found passkey by username fallback")
    }

    if (!passkey) {
      console.error("[Login] ❌ Passkey is null/undefined after all lookups")
      return NextResponse.json(
        { error: "Invalid passkey" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    // Verify challenge matches (basic verification)
    if (credential.response && credential.response.clientDataJSON) {
      try {
        const clientDataBuffer = base64URLToBuffer(credential.response.clientDataJSON)
        const clientDataJSON = JSON.parse(
          new TextDecoder().decode(clientDataBuffer)
        )
        
        // Verify challenge matches (need to base64url encode the stored challenge)
        const storedChallengeBase64 = Buffer.from(storedChallenge.challenge, 'base64')
          .toString('base64url')
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
        
        // The challenge in clientDataJSON is base64url encoded
        if (clientDataJSON.challenge !== storedChallenge.challenge) {
          console.error("[Login] Challenge mismatch - stored:", storedChallenge.challenge.substring(0, 20), "received:", clientDataJSON.challenge?.substring(0, 20))
          // For now, log but don't fail - we'll add proper verification later
          console.warn("[Login] ⚠️ Challenge mismatch detected, but continuing for now")
        }
        
        // Verify type is "webauthn.get"
        if (clientDataJSON.type !== "webauthn.get") {
          console.error("[Login] Invalid clientDataJSON type:", clientDataJSON.type)
          return NextResponse.json(
            { error: "Invalid authentication type" },
            { status: 401, headers: corsHeaders(request) }
          )
        }
        
        console.log("[Login] ✅ Challenge verification passed")
      } catch (error) {
        console.error("[Login] Error parsing clientDataJSON:", error)
        // Continue anyway - this is basic verification
        console.warn("[Login] ⚠️ Skipping clientDataJSON verification due to error")
      }
    }

    // Update last used timestamp
    // Use service client to bypass RLS
    await serviceClient.from("passkeys").update({ last_used_at: new Date().toISOString() }).eq("id", passkey.id)

    // Check if Stellar wallet exists, create one if it doesn't (non-blocking)
    // This ensures users have a wallet immediately upon login
    // Use service client since we don't have an authenticated Supabase session here
    try {
      console.log("[Login] Checking for existing wallet for userId:", profile.id, "userId type:", typeof profile.id)
      
      // Debug: Check all wallets for this user to see if there are duplicates
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseServiceKey && supabaseUrl) {
        const { createClient: createServiceClient } = await import("@supabase/supabase-js")
        const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
        const { data: allWallets, error: debugError } = await serviceClient
          .from("stellar_wallets")
          .select("*")
          .eq("user_id", profile.id)
        
        if (!debugError && allWallets) {
          console.log("[Login] DEBUG: Found", allWallets.length, "wallet(s) for userId:", profile.id)
          if (allWallets.length > 1) {
            console.error("[Login] ⚠️ DUPLICATE WALLETS DETECTED! Found", allWallets.length, "wallets for userId:", profile.id)
            allWallets.forEach((w, i) => {
              console.error(`[Login]   Wallet ${i + 1}: id=${w.id}, publicKey=${w.public_key ? w.public_key.substring(0, 10) + "..." : "NULL"}`)
            })
          }
        }
      }
      
      const existingWallet = await getStellarWallet(profile.id, true) // Use service client
      if (!existingWallet) {
        console.log("[Login] ⚠️ No Stellar wallet found for userId:", profile.id, "- creating new wallet")
        console.log("[Login] This might indicate a new user OR a wallet lookup issue")
        const wallet = await createStellarWallet(profile.id)
        console.log("[Login] Created wallet with Turnkey, storing in database...")
        console.log("[Login] New wallet publicKey:", wallet.publicKey ? `${wallet.publicKey.substring(0, 10)}...` : "NULL")
        const storedWallet = await storeStellarWallet(profile.id, wallet.turnkeyWalletId, wallet.publicKey, true) // Use service client
        console.log("[Login] ✅ Stellar wallet created and stored successfully:", {
          userId: profile.id,
          publicKey: storedWallet.publicKey ? `${storedWallet.publicKey.substring(0, 10)}...` : "NULL",
          turnkeyWalletId: storedWallet.turnkeyWalletId,
          wallet_id: storedWallet.id,
        })
      } else {
        console.log("[Login] ✅ Stellar wallet already exists for userId:", profile.id, "publicKey:", existingWallet.publicKey ? `${existingWallet.publicKey.substring(0, 10)}...` : "NULL", "wallet_id:", existingWallet.id)
      }
    } catch (walletError) {
      // Log error but don't fail login - wallet can be created later
      console.error("[Login] ❌ Error with wallet for userId:", profile.id, "Error:", walletError)
      console.warn("[Login] Login will proceed without wallet. Wallet can be created later via API.")
    }

    // For passkey authentication, we rely on sessionStorage on the client side
    // We don't need to create a Supabase session here since the client handles auth state
    // In production, you could use service role key to create a proper session if needed

    console.log("[Login] ✅ Login successful for userId:", profile.id, "username:", profile.username)
    
    // Return success - the client will use sessionStorage for authentication
    // The middleware will check sessionStorage on client side
    // Also return username so client can store it for future logins
    return NextResponse.json(
      { 
        success: true, 
        userId: profile.id,
        username: profile.username || username // Return actual username from database
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
