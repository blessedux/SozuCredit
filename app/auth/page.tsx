"use client"

import { FingerScanButton } from "@/components/ui/finger-scan-button"
import { FallingPattern } from "@/components/ui/falling-pattern"
import { 
  generateRegistrationChallenge, 
  generateAuthChallenge,
  createPasskey,
  getPasskey,
  verifyRegistration,
  verifyAuthentication
} from "@/lib/turnkey/passkeys"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useRef, useEffect, Suspense } from "react"
import { useIsMobile } from "@/hooks/use-mobile"

function AuthPageContent() {
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [registrationUsername, setRegistrationUsername] = useState("")
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectingRef = useRef(false)
  const isMobile = useIsMobile()

  // Extract invite code from URL params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const invite = searchParams?.get("invite") || new URLSearchParams(window.location.search).get("invite")
      if (invite) {
        setReferralCode(invite)
        console.log("[Auth] Referral code found in URL:", invite)
      }
    }
  }, [searchParams])

  // Extract referral code from URL on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const invite = searchParams.get("invite")
      if (invite) {
        console.log("[Auth] Found referral code in URL:", invite)
        setReferralCode(invite)
      }
    }
  }, [searchParams])

  const handleAuth = async () => {
    if (redirectingRef.current) {
      console.log("[Auth] Already redirecting, ignoring...")
      return
    }
    
    setIsAuthenticating(true)
    
    console.log("[Auth] ====== Starting authentication ======")

    try {
      // Try login first
      let credential = null
      let authComplete = false
      
      // Try to get stored username from localStorage first (available in both login and registration flows)
      let usernameToUse: string | null = null
      if (typeof window !== "undefined") {
        const storedUsername = localStorage.getItem("sozu_username")
        if (storedUsername && storedUsername !== "user") {
          usernameToUse = storedUsername
          console.log("[Auth] Using stored username:", usernameToUse)
        } else {
          console.log("[Auth] No stored username found or username is 'user', using discovery mode")
        }
      }
      
      try {
        console.log("[Auth] Step 1: Attempting login...")
        
        let challenge
        try {
          // Use discovery mode if no username or username is "user"
          // Discovery mode allows passkey selection without requiring username
          const challengeUsername = usernameToUse || ""
          console.log("[Auth] Generating challenge with username:", challengeUsername || "(discovery mode)")
          challenge = await generateAuthChallenge(challengeUsername)
          console.log("[Auth] Step 2: Challenge generated, calling getPasskey...")
        } catch (challengeError) {
          // If challenge generation fails (user doesn't exist), skip login and go to registration
          console.log("[Auth] Login challenge failed (user may not exist), will try registration:", challengeError)
          // Only fall back to registration if we had a valid username and it failed
          if (usernameToUse && usernameToUse !== "user") {
            throw challengeError // Re-throw to trigger registration flow
          }
          // If no username or username is "user", try discovery mode
          console.log("[Auth] Retrying with discovery mode (no username)...")
          challenge = await generateAuthChallenge("")
          console.log("[Auth] Step 2: Discovery mode challenge generated, calling getPasskey...")
        }
        
        try {
          credential = await getPasskey(challenge)
          console.log("[Auth] Step 3: getPasskey result:", credential ? "Got credential" : "No credential")
        } catch (passkeyError) {
          // Check if user cancelled the passkey prompt
          if (passkeyError instanceof DOMException && (
            passkeyError.name === "NotAllowedError" || 
            passkeyError.name === "AbortError"
          )) {
            console.log("[Auth] User cancelled passkey authentication, trying discovery mode to show all passkeys...")
            
            // If user cancelled and we had allowCredentials, retry with discovery mode
            // This allows the user to choose from all available passkeys (device-stored and browser-stored)
            if (challenge?.allowCredentials && challenge.allowCredentials.length > 0) {
              try {
                console.log("[Auth] Retrying with discovery mode (no credential restrictions)...")
                const discoveryChallenge = await generateAuthChallenge("") // Discovery mode
                credential = await getPasskey(discoveryChallenge)
                console.log("[Auth] Discovery mode result:", credential ? "Got credential" : "No credential")
                
                if (credential) {
                  // Update challenge reference for verification
                  challenge = discoveryChallenge
                } else {
                  // If still no credential, user cancelled again - offer registration
                  console.log("[Auth] User cancelled discovery mode as well, offering registration...")
                  // Re-throw to outer catch block to trigger registration
                  throw new Error("USER_CANCELLED_ALL_LOGIN_ATTEMPTS")
                }
              } catch (discoveryError) {
                // If discovery mode also fails or is cancelled, offer registration
                if (discoveryError instanceof DOMException && (
                  discoveryError.name === "NotAllowedError" || 
                  discoveryError.name === "AbortError"
                )) {
                  console.log("[Auth] User cancelled discovery mode, offering registration to create new passkey...")
                  // Re-throw to outer catch block to trigger registration
                  throw new Error("USER_CANCELLED_ALL_LOGIN_ATTEMPTS")
                }
                // If it's our custom error, re-throw it
                if (discoveryError instanceof Error && discoveryError.message === "USER_CANCELLED_ALL_LOGIN_ATTEMPTS") {
                  throw discoveryError
                }
                throw discoveryError
              }
            } else {
              // If no allowCredentials (already in discovery mode), user cancelled
              // Offer registration to create new passkey
              console.log("[Auth] User cancelled passkey authentication (already in discovery mode), offering registration...")
              // Re-throw to outer catch block to trigger registration
              throw new Error("USER_CANCELLED_ALL_LOGIN_ATTEMPTS")
            }
          } else {
            throw passkeyError // Re-throw other errors
          }
        }
        
        if (credential) {
          console.log("[Auth] Step 4: Verifying authentication...")
          // Username is optional - verify will find user by credential_id
          // Use empty string for discovery mode to ensure challenge lookup works
          // Pass challenge from the challenge response to handle serverless environments
          const verifyUsername = usernameToUse && usernameToUse !== "user" ? usernameToUse : ""
          const authResult = await verifyAuthentication(verifyUsername, credential, challenge?.challenge)
          console.log("[Auth] Step 5: Verification result:", authResult)
          console.log("[Auth] Verification success:", authResult.success)
          console.log("[Auth] Verification userId:", authResult.userId)
          
          // Check if authResult exists and is successful
          if (!authResult) {
            console.error("[Auth] Authentication failed - no result returned")
            throw new Error("Authentication returned no result")
          }
          
          if (!authResult.success) {
            console.error("[Auth] Authentication failed - result:", authResult)
            console.error("[Auth] Auth result success value:", authResult.success)
            throw new Error(`Authentication failed: ${JSON.stringify(authResult)}`)
          }

          console.log("[Auth] Login successful:", authResult)

          // Set authenticated state to trigger animation ONLY after successful verification
          setIsAuthenticated(true)
          setIsAuthenticating(false)

          // Create Supabase session for the user
          // Since we can't use password, we'll use sessionStorage for now
          // In production, you'd use Admin API to generate a proper session
          if (typeof window !== "undefined") {
            console.log("[Auth] Step 6: Setting up authentication...")
            
            // Store username in localStorage for future logins
            // The API returns the actual username from the database
            const actualUsername = (authResult as any).username || usernameToUse
            if (actualUsername) {
              localStorage.setItem("sozu_username", actualUsername)
              console.log("[Auth] Saved username to localStorage:", actualUsername)
            }
          
          // CRITICAL: Always use userId from API response, never fall back to username
          // Using username as fallback causes wallet lookup issues
          if (!authResult.userId) {
            console.error("[Auth] ERROR: No userId returned from login API!")
            throw new Error("Login succeeded but no userId was returned. Cannot continue.")
          }
            
            // Store in session storage FIRST (client-side auth check)
          // Use userId (UUID) not username - this is critical for wallet consistency
          sessionStorage.setItem("dev_username", authResult.userId)
            sessionStorage.setItem("dev_authenticated", "true")
            sessionStorage.setItem("passkey_registered", "true")
            sessionStorage.setItem("dev_username_display", actualUsername) // Store for display
          
          console.log("[Auth] Stored userId in sessionStorage:", authResult.userId, "Username:", actualUsername)
            
            // Verify sessionStorage was set
            const verifyAuth = sessionStorage.getItem("dev_authenticated")
            console.log("[Auth] SessionStorage verified:", verifyAuth === "true")
            
            // Try to refresh the session if user exists
            try {
              const supabase = createClient()
              const { data: { user } } = await supabase.auth.getUser()
              
              if (!user) {
                console.log("[Auth] No Supabase session, using sessionStorage fallback")
                // Session will be checked via sessionStorage in middleware
              } else {
                console.log("[Auth] Supabase session exists")
              }
            } catch (supabaseError) {
              console.warn("[Auth] Error checking Supabase session (using sessionStorage fallback):", supabaseError)
              // Continue with sessionStorage fallback
            }
            
            // Force immediate redirect - set flags first
            authComplete = true
            redirectingRef.current = true
            
            console.log("[Auth] Step 7: Redirecting to wallet...")
            console.log("[Auth] SessionStorage items:", {
              dev_authenticated: sessionStorage.getItem("dev_authenticated"),
              dev_username: sessionStorage.getItem("dev_username"),
              passkey_registered: sessionStorage.getItem("passkey_registered"),
            })
            
            // Wait for animation to play, then redirect
            setTimeout(() => {
              // Ensure sessionStorage is committed, then redirect using Next.js router
              // This prevents full page refresh and preserves console logs
              console.log("[Auth] About to redirect - final check:", {
                pathname: window.location.pathname,
                sessionAuth: sessionStorage.getItem("dev_authenticated"),
                redirectingRef: redirectingRef.current
              })
              
              console.log("[Auth] Executing redirect via Next.js router to /wallet")
              router.push("/wallet")
              
              // Give router a moment to navigate, but if it doesn't work, force it
              setTimeout(() => {
                if (window.location.pathname === "/auth" || window.location.pathname === "/auth/") {
                  console.warn("[Auth] Router.push didn't navigate after 300ms, forcing with window.location.href")
                  window.location.href = "/wallet"
                } else {
                  console.log("[Auth] Successfully navigated to:", window.location.pathname)
                }
              }, 300)
            }, 800) // Wait 800ms for animation
            
            return
          }
        }
      } catch (loginError) {
        // Check the error to determine if we should try registration
        const errorMessage = loginError instanceof Error ? loginError.message : String(loginError)
        
        console.log("[Auth] Caught login error:", errorMessage)
        
        // Check if user cancelled all login attempts - this means they want to register
        // Use a specific error code to ensure we catch it correctly
        const userCancelledAll = errorMessage === "USER_CANCELLED_ALL_LOGIN_ATTEMPTS" ||
                                 errorMessage.includes("User cancelled all login attempts") || 
                                 errorMessage.includes("User cancelled discovery mode")
        
        console.log("[Auth] userCancelledAll:", userCancelledAll, "errorMessage:", errorMessage)
        
        // Don't try registration if:
        // 1. Challenge errors (should retry login, not register)
        // 2. Passkey not found errors (user already has passkey)
        // 3. Authentication errors (user exists but verification failed)
        // UNLESS user explicitly cancelled all attempts (then they want to register)
        const shouldNotRegister = !userCancelledAll && (
          errorMessage.includes("Challenge not found") ||
          errorMessage.includes("Challenge not found or expired") ||
          errorMessage.includes("Passkey not found") ||
          errorMessage.includes("Invalid passkey") ||
          errorMessage.includes("Authentication failed") ||
          errorMessage.includes("Failed to verify authentication")
        )
        
        if (shouldNotRegister) {
          console.error("[Auth] Login failed with error that suggests user already exists:", errorMessage)
          console.error("[Auth] Not attempting registration - user likely has existing passkey")
          setIsAuthenticating(false)
          // Show user-friendly error
          alert("Login failed. Please try again or contact support if the problem persists.")
          return
        }
        
        // Try registration if:
        // 1. User cancelled all login attempts (wants to create new passkey)
        // 2. User not found error
        // 3. No passkeys found
        if (userCancelledAll) {
          console.log("[Auth] ✅ User cancelled all login attempts, proceeding with registration to create new passkey...")
        } else if (errorMessage.includes("User not found") || errorMessage.includes("No passkeys found")) {
          console.log("[Auth] User doesn't exist yet, proceeding with registration...")
        } else {
          console.warn("[Auth] Unexpected login error:", loginError)
          console.warn("[Auth] Attempting registration as fallback...")
        }
        
        // If user cancelled all login attempts, they want to create a NEW passkey with a NEW username
        // Always prompt for username in this case, don't use stored username
        let usernameToRegister: string
        if (userCancelledAll) {
          // User wants to create a new passkey - always prompt for new username
          console.log("[Auth] User wants to create new passkey, prompting for new username...")
          const userInput = prompt("Please enter a username for your new passkey (3-30 characters, letters, numbers, and underscores only):", "")
          if (userInput === null) {
            // User cancelled
            console.log("[Auth] User cancelled username prompt")
            setIsAuthenticating(false)
            return
          }
          const trimmedInput = userInput.trim()
          if (trimmedInput.length >= 3 && trimmedInput.length <= 30 && /^[a-zA-Z0-9_]+$/.test(trimmedInput)) {
            usernameToRegister = trimmedInput
            setRegistrationUsername(trimmedInput)
          } else {
            alert("Invalid username. Must be 3-30 characters and contain only letters, numbers, and underscores.")
            setIsAuthenticating(false)
            return
          }
        } else {
          // For other cases (user not found, etc.), use stored username if available, otherwise prompt
          usernameToRegister = registrationUsername || usernameToUse || ""
          if (!usernameToRegister || usernameToRegister === "user") {
            // Prompt user for username
            const userInput = prompt("Please enter a username (3-30 characters, letters, numbers, and underscores only):", usernameToUse || "user")
            if (userInput === null) {
              // User cancelled
              setIsAuthenticating(false)
              return
            }
            const trimmedInput = userInput.trim()
            if (trimmedInput.length >= 3 && trimmedInput.length <= 30 && /^[a-zA-Z0-9_]+$/.test(trimmedInput)) {
              usernameToRegister = trimmedInput
              setRegistrationUsername(trimmedInput)
            } else {
              alert("Invalid username. Must be 3-30 characters and contain only letters, numbers, and underscores.")
              setIsAuthenticating(false)
              return
            }
          } else {
            // Use the stored username
            setRegistrationUsername(usernameToRegister)
          }
        }
        
        try {
          console.log("[Auth] Reg Step 1: Generating registration challenge with username:", usernameToRegister)
          let challenge = await generateRegistrationChallenge(usernameToRegister)
          console.log("[Auth] Reg Step 2: Challenge generated, calling createPasskey...")
          
          try {
            credential = await createPasskey(challenge)
            console.log("[Auth] Reg Step 3: createPasskey result:", credential ? "Got credential" : "No credential")
          } catch (passkeyError) {
            // Check if user cancelled the passkey prompt
            if (passkeyError instanceof DOMException && (
              passkeyError.name === "NotAllowedError" || 
              passkeyError.name === "AbortError"
            )) {
              console.log("[Auth] User cancelled passkey registration, trying cross-platform (browser-stored) passkey...")
              
              // If user cancelled, try again with cross-platform authenticator (browser-stored)
              // This allows users to create browser-stored passkeys if they don't want device-stored
              try {
                console.log("[Auth] Retrying registration with cross-platform authenticator (browser-stored)...")
                // Modify challenge to prefer cross-platform authenticators
                challenge = {
                  ...challenge,
                  authenticatorSelection: {
                    ...challenge.authenticatorSelection,
                    authenticatorAttachment: "cross-platform", // Prefer browser-stored passkeys
                  },
                }
                credential = await createPasskey(challenge)
                console.log("[Auth] Cross-platform passkey result:", credential ? "Got credential" : "No credential")
                
                if (!credential) {
                  // If still no credential, user cancelled again
                  console.log("[Auth] User cancelled cross-platform passkey registration as well")
                  setIsAuthenticating(false)
                  return
                }
              } catch (crossPlatformError) {
                // If cross-platform also fails or is cancelled, just return
                if (crossPlatformError instanceof DOMException && (
                  crossPlatformError.name === "NotAllowedError" || 
                  crossPlatformError.name === "AbortError"
                )) {
                  console.log("[Auth] User cancelled cross-platform passkey registration")
                  setIsAuthenticating(false)
                  return
                }
                throw crossPlatformError
              }
            } else {
              throw passkeyError // Re-throw other errors
            }
          }
          
          if (!credential) {
            throw new Error("Failed to create passkey.")
          }

          console.log("[Auth] Reg Step 4: Verifying registration...")
          // Pass the challenge and referral code to verifyRegistration
          const regResult = await verifyRegistration(usernameToRegister, credential, challenge.challenge, referralCode)
          console.log("[Auth] Reg Step 5: Verification result:", regResult)
          console.log("[Auth] Registration success:", regResult.success)
          console.log("[Auth] Registration userId:", regResult.userId)
          
          if (!regResult || !regResult.success) {
            console.error("[Auth] Registration failed - result:", regResult)
            throw new Error("Failed to register passkey.")
          }

          console.log("[Auth] Registration successful:", regResult)

          // Set authenticated state to trigger animation ONLY after successful verification
          setIsAuthenticated(true)
          setIsAuthenticating(false)

          // Set up authentication after registration
          if (typeof window !== "undefined") {
            console.log("[Auth] Reg Step 6: Setting up authentication...")
            
            // Store username in localStorage for future logins
            const registeredUsername = (regResult as any).username || usernameToUse || "user"
            if (registeredUsername) {
              localStorage.setItem("sozu_username", registeredUsername)
              console.log("[Auth] Saved username to localStorage after registration:", registeredUsername)
            }
            
            // CRITICAL: Always use userId from API response, never fall back to username
            // Using username as fallback causes wallet lookup issues
            if (!regResult.userId) {
              console.error("[Auth] ERROR: No userId returned from registration API!")
              throw new Error("Registration succeeded but no userId was returned. Cannot continue.")
            }
            
            // Store in session storage FIRST (client-side auth check)
            // Use userId (UUID) not username - this is critical for wallet consistency
            sessionStorage.setItem("dev_username", regResult.userId)
            sessionStorage.setItem("dev_authenticated", "true")
            sessionStorage.setItem("passkey_registered", "true")
            sessionStorage.setItem("dev_username_display", registeredUsername) // Store for display
            
            console.log("[Auth] Stored userId in sessionStorage after registration:", regResult.userId, "Username:", registeredUsername)
            
            // Verify sessionStorage was set
            const verifyAuth = sessionStorage.getItem("dev_authenticated")
            console.log("[Auth] SessionStorage verified after registration:", verifyAuth === "true")
            
            // Check if Supabase session exists
            try {
              const supabase = createClient()
              const { data: { user } } = await supabase.auth.getUser()
              
              if (!user) {
                console.log("[Auth] No Supabase session after registration, using sessionStorage fallback")
              } else {
                console.log("[Auth] Supabase session exists after registration")
              }
            } catch (supabaseError) {
              console.warn("[Auth] Error checking Supabase session after registration (using sessionStorage fallback):", supabaseError)
              // Continue with sessionStorage fallback
            }
            
            // Force immediate redirect - set flags first
            authComplete = true
            redirectingRef.current = true
            
            console.log("[Auth] Reg Step 7: Redirecting to wallet...")
            console.log("[Auth] SessionStorage items after registration:", {
              dev_authenticated: sessionStorage.getItem("dev_authenticated"),
              dev_username: sessionStorage.getItem("dev_username"),
              passkey_registered: sessionStorage.getItem("passkey_registered"),
            })
            
            // Wait for animation to play, then redirect
            setTimeout(() => {
              // Ensure sessionStorage is committed, then redirect using Next.js router
              // This prevents full page refresh and preserves console logs
              console.log("[Auth] About to redirect after registration - final check:", {
                pathname: window.location.pathname,
                sessionAuth: sessionStorage.getItem("dev_authenticated"),
                redirectingRef: redirectingRef.current
              })
              
              // Force a synchronous write to sessionStorage
              // This ensures it's definitely set before we navigate
              // CRITICAL: Use userId (UUID), never fallback to username
              if (!regResult.userId) {
                console.error("[Auth] CRITICAL: No userId available for sessionStorage!")
                return // Don't redirect if we don't have a userId
              }
              sessionStorage.setItem("dev_authenticated", "true")
              sessionStorage.setItem("dev_username", regResult.userId)
              sessionStorage.setItem("passkey_registered", "true")
              sessionStorage.setItem("redirect_to_wallet", "true")
              
              // Verify it's set (synchronous)
              const verified = sessionStorage.getItem("dev_authenticated") === "true"
              console.log("[Auth] SessionStorage verified synchronously:", verified)
              
              if (!verified) {
                console.error("[Auth] CRITICAL: sessionStorage failed to set! Cannot proceed with redirect.")
                return
              }
              
              console.log("[Auth] Executing redirect to /wallet after registration")
              
              // Try router.push first
              console.log("[Auth] Attempting router.push('/wallet')...")
              try {
                router.push("/wallet")
                
                // Give router a moment to navigate, but if it doesn't work, force it
                setTimeout(() => {
                  if (window.location.pathname === "/auth" || window.location.pathname === "/auth/") {
                    console.warn("[Auth] Router.push didn't navigate after 300ms, forcing with window.location.href")
                    window.location.href = "/wallet"
                  } else {
                    console.log("[Auth] Successfully navigated to:", window.location.pathname)
                  }
                }, 300)
              } catch (routerError) {
                console.error("[Auth] Router.push error:", routerError)
                window.location.href = "/wallet"
              }
            }, 800) // Wait 800ms for animation
            
            return
          }
        } catch (regError) {
          console.error("[Auth] Registration also failed:", regError)
          throw regError
        }
        
        authComplete = true
        return
      }

      // Fallback redirect (should not reach here, but just in case)
      if (!authComplete) {
        console.log("[Auth] Fallback redirect to wallet...")
        // Check if we're authenticated via sessionStorage
        const isAuth = typeof window !== "undefined" && sessionStorage.getItem("dev_authenticated") === "true"
        if (isAuth) {
          console.log("[Auth] Executing fallback redirect to /wallet via router")
          router.push("/wallet")
        }
      }
    } catch (error: unknown) {
      // If we're redirecting, don't do anything else
      if (redirectingRef.current) {
        console.log("[Auth] Redirect in progress, ignoring error")
        return
      }
      
      // Check if this is a cancellation error (user cancelled passkey prompt)
      if (error instanceof DOMException && (
        error.name === "NotAllowedError" || 
        error.name === "AbortError"
      )) {
        console.log("[Auth] User cancelled passkey authentication/registration")
        setIsAuthenticating(false)
        return // User can try again
      }
      
      // Check if error is a passkey cancellation in the error chain
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes("NotAllowedError") || errorMessage.includes("AbortError")) {
        console.log("[Auth] User cancelled passkey (detected in error message)")
        setIsAuthenticating(false)
        return // User can try again
      }
      
      console.error("[Auth] ====== Authentication error ======")
      console.error("[Auth] Error:", error)
      console.error("[Auth] Error type:", error instanceof Error ? error.constructor.name : typeof error)
      console.error("[Auth] Error message:", error instanceof Error ? error.message : String(error))
      console.error("[Auth] Error stack:", error instanceof Error ? error.stack : "No stack trace")
      
      // Check if we somehow got authenticated despite the error
      if (typeof window !== "undefined") {
        const isAuth = sessionStorage.getItem("dev_authenticated") === "true"
        console.log("[Auth] Checking sessionStorage after error - authenticated:", isAuth)
        
        if (isAuth) {
          console.log("[Auth] Found auth state after error, redirecting anyway...")
          redirectingRef.current = true
          console.log("[Auth] Executing error recovery redirect to /wallet via router")
          router.push("/wallet")
          return
        }
      }
      
      setIsAuthenticating(false)
      console.log("[Auth] Authentication failed - setting isAuthenticating to false")
    } finally {
      console.log("[Auth] ====== Authentication flow complete ======")
    }
  }

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-black">
      {/* Falling Pattern Background */}
      <div className="absolute inset-0 z-0">
        <FallingPattern 
          className="h-full w-full" 
          backgroundColor="oklch(0 0 0)"
          color="oklch(1 0 0)"
        />
      </div>
      
      {/* Circular Button - centered on desktop, bottom on mobile */}
      <div className={`z-10 transition-all duration-700 ${
        isAuthenticated 
          ? "scale-150 opacity-0" 
          : "scale-100 opacity-100"
      } ${
        isMobile 
          ? "fixed bottom-8 left-1/2 -translate-x-1/2 w-full flex items-center justify-center" 
          : "absolute inset-0 flex items-center justify-center"
      }`}>
        <FingerScanButton
          onScan={handleAuth}
          scanning={isAuthenticating}
          disabled={isAuthenticating}
        />
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black dark text-white flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}
