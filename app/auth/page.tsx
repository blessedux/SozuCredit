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
import { useState, useRef, useEffect } from "react"

export default function AuthPage() {
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectingRef = useRef(false)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  
  // Read referral code from URL query parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ref = searchParams?.get("ref") || new URLSearchParams(window.location.search).get("ref")
      if (ref) {
        setReferralCode(ref)
        console.log("[Auth] Referral code found:", ref)
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
      let usernameToUse = "user" // Default fallback
      if (typeof window !== "undefined") {
        const storedUsername = localStorage.getItem("sozu_username")
        if (storedUsername) {
          usernameToUse = storedUsername
          console.log("[Auth] Using stored username:", usernameToUse)
        } else {
          console.log("[Auth] No stored username found, using default:", usernameToUse)
        }
      }
      
      try {
        console.log("[Auth] Step 1: Attempting login...")
        
        let challenge
        try {
          challenge = await generateAuthChallenge(usernameToUse)
          console.log("[Auth] Step 2: Challenge generated, calling getPasskey...")
        } catch (challengeError) {
          // If challenge generation fails (user doesn't exist), skip login and go to registration
          console.log("[Auth] Login challenge failed (user may not exist), will try registration:", challengeError)
          throw challengeError // Re-throw to trigger registration flow
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
            console.log("[Auth] User cancelled passkey authentication")
            setIsAuthenticating(false)
            return // Return early, user can try again
          }
          throw passkeyError // Re-throw other errors
        }
        
        if (credential) {
          console.log("[Auth] Step 4: Verifying authentication...")
          const authResult = await verifyAuthentication(usernameToUse, credential)
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
            
            // Store in session storage FIRST (client-side auth check)
            sessionStorage.setItem("dev_username", authResult.userId || actualUsername)
            sessionStorage.setItem("dev_authenticated", "true")
            sessionStorage.setItem("passkey_registered", "true")
            sessionStorage.setItem("dev_username_display", actualUsername) // Store for display
            
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
        // If login fails, try registration
        console.log("[Auth] Login failed, attempting registration...")
        console.log("[Auth] Login error:", loginError)
        
        // Check if error is "User not found" or "No passkeys found" - this is expected for first-time users
        const errorMessage = loginError instanceof Error ? loginError.message : String(loginError)
        if (errorMessage.includes("User not found") || errorMessage.includes("No passkeys found")) {
          console.log("[Auth] User doesn't exist yet, proceeding with registration...")
        } else {
          console.warn("[Auth] Unexpected login error:", loginError)
        }
        
        try {
          console.log("[Auth] Reg Step 1: Generating registration challenge...")
          const challenge = await generateRegistrationChallenge("user")
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
              console.log("[Auth] User cancelled passkey registration")
              setIsAuthenticating(false)
              return // Return early, user can try again
            }
            throw passkeyError // Re-throw other errors
          }
          
          if (!credential) {
            throw new Error("Failed to create passkey.")
          }

          console.log("[Auth] Reg Step 4: Verifying registration...")
          // Pass the challenge to verifyRegistration in case the in-memory store doesn't have it
          // Also pass referral code if present
          const regResult = await verifyRegistration("user", credential, challenge.challenge, referralCode)
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
            
            // Store in session storage FIRST (client-side auth check)
            sessionStorage.setItem("dev_username", regResult.userId || registeredUsername)
            sessionStorage.setItem("dev_authenticated", "true")
            sessionStorage.setItem("passkey_registered", "true")
            sessionStorage.setItem("dev_username_display", registeredUsername) // Store for display
            
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
              sessionStorage.setItem("dev_authenticated", "true")
              sessionStorage.setItem("dev_username", regResult.userId || "user")
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
      
      {/* Circular Button - centered vertically and horizontally */}
      <div className={`relative z-10 transition-all duration-700 ${
        isAuthenticated 
          ? "scale-150 opacity-0" 
          : "scale-100 opacity-100"
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
