"use client"

import { WelcomeModal } from "@/components/welcome-modal"
import { TagInputModal } from "@/components/tag-input-modal"
import { WalletSkeleton } from "@/components/ui/wallet-skeleton"
import { Button } from "@/components/ui/button"
import { Fingerprint, Share, Plus, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
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
import { useState, useRef, useEffect, useCallback, Suspense } from "react"
import { usePwaInstall } from "@/hooks/use-pwa-install"
import { useAppViewportLock } from "@/hooks/use-app-viewport-lock"

function AuthPageContent() {
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [resumeLoginTag, setResumeLoginTag] = useState<string | null>(null)
  const [tagModalPrefill, setTagModalPrefill] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [showIosInstallModal, setShowIosInstallModal] = useState(false)
  const [pwaBannerDismissed, setPwaBannerDismissed] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectingRef = useRef(false)
  const { canInstall, triggerInstall, isIos, isInstalled } = usePwaInstall()
  // Stores a passkey credential captured during discovery-mode auth that failed
  // (credential not in DB). Passed to proceedWithRegistration so the user isn't
  // prompted for a second biometric after entering their SozuTag.
  const pendingCredentialRef = useRef<Awaited<ReturnType<typeof getPasskey>>>(null)

  useAppViewportLock()

  /** SDP onboarding: middleware sends unauthenticated users to /auth?sdpInvite=1 */
  const postAuthPath = searchParams.get("sdpInvite") === "1" ? "/sdp/register" : "/home"

  const finalizePasskeyLoginSuccess = useCallback(
    async (userId: string, username: string | undefined, credential: { id: string }) => {
      if (username && username !== "" && username !== "user") {
        localStorage.setItem("sozu_username", username)
      }
      localStorage.setItem("dev_username", userId)
      localStorage.setItem("dev_authenticated", "true")
      try {
        const { alignWalletMaterialAfterLogin } = await import("@/lib/storage/post-login-wallet")
        const { publicKey, needsWalletSync } = await alignWalletMaterialAfterLogin(userId, credential.id)
        localStorage.setItem("stellar_public_key", publicKey)
        if (needsWalletSync) {
          console.warn("[Auth] Wallet sync may be required for this passkey on this device.")
        }
      } catch (keyError) {
        console.error("[Auth] Failed to align wallet after login:", keyError)
      }
      setShowTagModal(false)
      setResumeLoginTag(null)
      setTagModalPrefill(null)
      setIsAuthenticated(true)
      setIsAuthenticating(false)
      redirectingRef.current = true
      setIsExiting(true)
      setTimeout(() => router.push(postAuthPath), 300)
    },
    [router, postAuthPath]
  )

  const finalizePinLoginSuccess = useCallback(
    async (userId: string, username: string) => {
      localStorage.setItem("sozu_username", username)
      localStorage.setItem("dev_username", userId)
      localStorage.setItem("dev_authenticated", "true")
      sessionStorage.removeItem("credential_id")
      try {
        const res = await fetch("/api/wallet/stellar/address", { headers: { "x-user-id": userId } })
        const data = (await res.json()) as { publicKey?: string | null }
        if (data.publicKey && typeof data.publicKey === "string" && data.publicKey.startsWith("G")) {
          localStorage.setItem("stellar_public_key", data.publicKey)
          const { getKeypairByPublicKey } = await import("@/lib/storage/browser-keys")
          const kp = await getKeypairByPublicKey(data.publicKey)
          if (kp) sessionStorage.removeItem("wallet_sync_pending")
          else sessionStorage.setItem("wallet_sync_pending", "1")
        }
      } catch (e) {
        console.warn("[Auth] PIN login: could not load wallet address", e)
      }
      setShowTagModal(false)
      setResumeLoginTag(null)
      setTagModalPrefill(null)
      setIsAuthenticated(true)
      setIsAuthenticating(false)
      redirectingRef.current = true
      setIsExiting(true)
      setTimeout(() => router.push(postAuthPath), 300)
    },
    [router, postAuthPath]
  )

  const attemptLoginWithTag = useCallback(
    async (tag: string): Promise<{
      ok: boolean
      cancelled?: boolean
      error?: string
      /** Credential captured during a failed auth attempt — reuse for registration to skip second biometric. */
      capturedCredential?: Awaited<ReturnType<typeof getPasskey>> | null
    }> => {
      try {
        const challenge = await generateAuthChallenge(tag)
        let credential: Awaited<ReturnType<typeof getPasskey>>
        try {
          credential = await getPasskey(challenge)
        } catch (e) {
          if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) {
            return { ok: false, cancelled: true }
          }
          throw e
        }
        if (!credential) return { ok: false, cancelled: true }
        const authResult = await verifyAuthentication(tag, credential, challenge?.challenge)
        if (!authResult?.success || !authResult.userId) {
          // Auth failed (account deleted / credential not in DB).
          // Return the credential so the caller can stash it for registration reuse.
          return { ok: false, error: "Could not sign in", capturedCredential: credential }
        }
        await finalizePasskeyLoginSuccess(authResult.userId, authResult.username, credential)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Could not sign in" }
      }
    },
    [finalizePasskeyLoginSuccess]
  )

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

    // Step 1: Check localStorage for stored username (quick check, no prompts)
    let usernameToUse: string | null = null
    if (typeof window !== "undefined") {
      const storedUsername = localStorage.getItem("sozu_username")
      if (storedUsername && storedUsername !== "user") {
        usernameToUse = storedUsername
        console.log("[Auth] Found stored username:", usernameToUse)
      }
    }

    // Step 2: If username exists, try login directly (assumes passkey exists)
    if (usernameToUse) {
      console.log("[Auth] ====== Attempting login with stored username:", usernameToUse)
      const result = await attemptLoginWithTag(usernameToUse)
      if (result.ok) {
        return
      }
      console.log("[Auth] Login with stored tag failed:", result.error, result.cancelled)

      // Stash credential for registration reuse — avoids a second biometric prompt
      // when the user enters a SozuTag after a failed login (e.g. deleted account).
      if (result.capturedCredential) {
        pendingCredentialRef.current = result.capturedCredential
        console.log("[Auth] Captured credential stashed for registration reuse")
      }

      setIsAuthenticating(false)
      if (result.cancelled) {
        setResumeLoginTag(usernameToUse)
      } else if (typeof window !== "undefined") {
        localStorage.removeItem("sozu_username")
        setTagModalPrefill(usernameToUse)
      }
      setShowTagModal(true)
      return
    }

    // Step 3: No stored username - try passkey discovery mode (for incognito/private browsing)
    // This allows users to select from passkeys stored on their device even without localStorage
    console.log("[Auth] No stored username found - attempting passkey discovery mode")

    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      console.log("[Auth] WebAuthn not supported, showing tag modal")
      setIsAuthenticating(false)
      setShowTagModal(true)
      return
    }

    try {
      // Generate challenge in discovery mode (no username)
      // This allows the browser to show all available passkeys for this rpId
      const discoveryChallenge = await generateAuthChallenge()
      console.log("[Auth] Generated discovery challenge, rpId:", discoveryChallenge.rpId)

      // Get passkey from device (browser will show picker if multiple passkeys exist)
      // In incognito mode, this will show passkeys stored on the device
      const credential = await getPasskey(discoveryChallenge)

      if (!credential) {
        // User cancelled or no passkey found - show tag modal
        console.log("[Auth] No passkey selected or user cancelled discovery")
        setIsAuthenticating(false)
        setShowTagModal(true)
        return
      }

      console.log("[Auth] Passkey selected in discovery mode, credential ID:", credential.id.substring(0, 20) + "...")

      // Verify authentication in discovery mode (no username needed)
      // The API will find the user by credential ID
      const authResult = await verifyAuthentication("", credential, discoveryChallenge.challenge)

      if (!authResult || !authResult.success) {
        // Auth failed: this passkey isn't registered in our DB yet (e.g. deleted account).
        // Keep the credential so proceedWithRegistration can reuse it — the user won't
        // need a second biometric after they enter their SozuTag.
        console.log("[Auth] Discovery mode authentication failed — credential captured for registration reuse")
        pendingCredentialRef.current = credential
        setIsAuthenticating(false)
        setShowTagModal(true)
        return
      }

      // Login successful via discovery mode
      console.log("[Auth] ✅ Login successful via passkey discovery")
      const finalUserId = authResult.userId
      if (!finalUserId || !credential?.id) {
        throw new Error("No userId or credential from discovery login")
      }
      await finalizePasskeyLoginSuccess(finalUserId, authResult.username, credential)
      return
    } catch (discoveryError: any) {
      // Discovery mode failed - could mean:
      // 1. No passkeys exist on device
      // 2. User cancelled
      // 3. Network error
      console.log("[Auth] Passkey discovery failed:", discoveryError.name, discoveryError.message)

      // Show tag modal for registration
      setIsAuthenticating(false)
      setShowTagModal(true)
      return
    }
  }

  const handleRegisterFromModal = (tag: string) => {
    setShowTagModal(false)
    setResumeLoginTag(null)
    setTagModalPrefill(null)
    setIsAuthenticating(true)
    // Consume any credential captured during a failed discovery-mode auth so that
    // proceedWithRegistration can skip the second biometric prompt.
    const captured = pendingCredentialRef.current
    pendingCredentialRef.current = null
    void proceedWithRegistration(tag, captured)
  }

  const handleLoginPasskeyFromModal = async (tag: string) => {
    const result = await attemptLoginWithTag(tag)
    if (result.cancelled) {
      setResumeLoginTag(tag)
      setShowTagModal(true)
    }
    return result
  }

  const handlePinLoginFromModal = async (tag: string, pin: string) => {
    try {
      const res = await fetch("/api/auth/pin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: tag, pin }),
      })
      const data = (await res.json()) as { error?: string; message?: string; userId?: string; username?: string }
      if (!res.ok) {
        if (data.error === "pin_not_configured" && typeof data.message === "string") {
          return { ok: false as const, error: data.message }
        }
        return { ok: false as const, error: typeof data.message === "string" ? data.message : "Could not sign in" }
      }
      if (!data.userId || !data.username) {
        return { ok: false as const, error: "Could not sign in" }
      }
      await finalizePinLoginSuccess(data.userId, data.username)
      return { ok: true as const }
    } catch {
      return { ok: false as const, error: "Network error" }
    }
  }

  const proceedWithRegistration = async (
    tag: string,
    /** Credential already captured from a prior (failed) discovery-mode auth.
     *  When provided the browser biometric prompt is skipped entirely. */
    existingCredential?: Awaited<ReturnType<typeof getPasskey>> | null,
  ) => {
    console.log("[Auth] ====== Starting registration with tag:", tag, existingCredential ? "(reusing captured credential)" : "")

    try {
      let credential: Awaited<ReturnType<typeof getPasskey>> = existingCredential ?? null
      const usernameToRegister = tag

      // Store tag in localStorage for future logins
      if (typeof window !== "undefined") {
        localStorage.setItem("sozu_username", tag)
      }

      console.log("[Auth] Reg Step 1: Generating registration challenge with tag:", usernameToRegister)
      let challenge
      try {
        challenge = await generateRegistrationChallenge(usernameToRegister)
      } catch (challengeError: any) {
        // Check if username already exists (409 status or usernameExists flag)
        if (challengeError.status === 409 || challengeError.usernameExists ||
          challengeError.message?.includes("already taken") ||
          challengeError.message?.includes("Username already exists")) {
          console.log("[Auth] Tag already exists — open sign-in in modal")
          setIsAuthenticating(false)
          if (typeof window !== "undefined") {
            localStorage.setItem("sozu_username", usernameToRegister)
          }
          setShowTagModal(true)
          setResumeLoginTag(usernameToRegister)
          return
        }
        throw challengeError
      }

      if (!existingCredential) {
        // Normal path: no prior credential — prompt the user for a new passkey.
        // Update challenge to use tag as displayName for passkey
        if (challenge.user) {
          challenge.user.displayName = usernameToRegister
          challenge.user.name = usernameToRegister
        }

        // PHASE 1: Generate a temporary userId client-side for userHandle storage
        const tempUserId = crypto.randomUUID()
        console.log("[Auth] Reg Step 1.5: Generated temporary userId for userHandle:", tempUserId)

        console.log("[Auth] Reg Step 2: Challenge generated, calling createPasskey with tag as displayName...")

        try {
          // Pass userId and tag to createPasskey so it can be stored in userHandle and used as displayName
          credential = await createPasskey(challenge, tempUserId, usernameToRegister)
          console.log("[Auth] Reg Step 3: createPasskey result:", credential ? "Got credential" : "No credential")
          if (credential?.response?.userHandle) {
            console.log("[Auth] UserHandle stored in passkey:", credential.response.userHandle)
          }
        } catch (passkeyError) {
          // Check if user cancelled the passkey prompt
          if (passkeyError instanceof DOMException && (
            passkeyError.name === "NotAllowedError" ||
            passkeyError.name === "AbortError"
          )) {
            console.log("[Auth] User cancelled passkey registration")
            setIsAuthenticating(false)
            setTagModalPrefill(usernameToRegister)
            setShowTagModal(true)
            return
          }
          throw passkeyError // Re-throw other errors
        }
      } else {
        console.log("[Auth] Reg Step 2–3: Skipping createPasskey — reusing credential from prior discovery auth")
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
        console.error("[Auth] Registration verification failed - result:", regResult)
        setIsAuthenticating(false)
        alert("Registration failed. Please try again.")
        return
      }

      console.log("[Auth] Registration successful:", regResult)

      // Set authenticated state to trigger animation ONLY after successful verification
      setIsAuthenticated(true)
      setIsAuthenticating(false)

      // Set up authentication after registration
      if (typeof window !== "undefined") {
        console.log("[Auth] Reg Step 6: Setting up authentication...")

        // Store username in localStorage for future logins
        const registeredUsername = (regResult as any).username || usernameToRegister || "user"
        if (registeredUsername) {
          localStorage.setItem("sozu_username", registeredUsername)
          console.log("[Auth] Saved username to localStorage after registration:", registeredUsername)
        }

        // CRITICAL: Use server userId for key derivation (not tempUserId)
        // Key derivation includes userId, so different userId = different keypair
        const finalUserId = regResult.userId
        if (!finalUserId) {
          console.error("[Auth] ERROR: No userId available from server!")
          throw new Error("No userId available. Cannot continue.")
        }

        // PHASE 1: Derive and store keys AFTER server verification (so we have the correct userId)
        // This ensures keys are derived with the correct userId that matches the server
        console.log("[Auth] Reg Step 6.5: Deriving Stellar keypair from passkey...")
        console.log("[Auth] Window available:", typeof window !== "undefined")
        console.log("[Auth] Credential available:", !!credential)
        console.log("[Auth] Credential ID:", credential?.id ? credential.id.substring(0, 20) + "..." : "NO")
        console.log("[Auth] Server userId:", finalUserId)

        if (typeof window !== "undefined" && credential?.id) {
          try {
            const { deriveAndStoreKey } = await import("@/lib/storage/browser-keys")
            const { storeCredentialIdInSession } = await import("@/lib/storage/key-utils")

            console.log("[Auth] Calling deriveAndStoreKey with:", {
              credentialId: credential.id.substring(0, 20) + "...",
              userId: finalUserId,
            })

            // Use server userId for key derivation (this is the canonical userId)
            const { keypair, publicKey } = await deriveAndStoreKey(credential.id, finalUserId)

            console.log("[Auth] ✅ Stellar keypair derived and stored:", {
              publicKey: publicKey.substring(0, 10) + "...",
              credentialId: credential.id.substring(0, 20) + "...",
              userId: finalUserId,
            })

            // Store public key persistently; credential_id stays in sessionStorage (ephemeral)
            localStorage.setItem("stellar_public_key", publicKey)
            storeCredentialIdInSession(credential.id)

            console.log("[Auth] ✅ Credential ID stored in sessionStorage for client-side signing")
            console.log("[Auth] ✅ Public key stored:", publicKey.substring(0, 10) + "...")
            console.log("[Auth] ✅ Credential ID stored:", credential.id.substring(0, 20) + "...")

            // Verify storage
            const storedCredentialId = sessionStorage.getItem("credential_id")
            const storedPublicKey = sessionStorage.getItem("stellar_public_key")
            console.log("[Auth] Verification - Stored credential_id:", storedCredentialId ? storedCredentialId.substring(0, 20) + "..." : "MISSING")
            console.log("[Auth] Verification - Stored public_key:", storedPublicKey ? storedPublicKey.substring(0, 10) + "..." : "MISSING")
          } catch (keyError) {
            console.error("[Auth] ❌ Failed to derive/store keypair:", keyError)
            console.error("[Auth] Error details:", {
              message: keyError instanceof Error ? keyError.message : String(keyError),
              stack: keyError instanceof Error ? keyError.stack : undefined,
            })
            // Don't fail authentication if key derivation fails - user can create wallet later
          }
        } else {
          console.warn("[Auth] ⚠️ Skipping key derivation:", {
            windowAvailable: typeof window !== "undefined",
            credentialAvailable: !!credential,
            credentialIdAvailable: !!credential?.id,
          })
        }

        // Persist session so the user never needs to re-auth on next open
        localStorage.setItem("dev_username", finalUserId)
        localStorage.setItem("dev_authenticated", "true")
        sessionStorage.setItem("passkey_registered", "true")
        sessionStorage.setItem("dev_username_display", registeredUsername)

        console.log("[Auth] Persisted session after registration:", finalUserId, "Username:", registeredUsername)

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
        redirectingRef.current = true

        console.log("[Auth] Reg Step 7: Redirecting to wallet...")
        console.log("[Auth] SessionStorage items after registration:", {
          dev_authenticated: sessionStorage.getItem("dev_authenticated"),
          dev_username: sessionStorage.getItem("dev_username"),
          passkey_registered: sessionStorage.getItem("passkey_registered"),
        })

        // Start fade-out animation, then redirect
        setIsExiting(true)

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

          console.log("[Auth] Executing redirect after registration:", postAuthPath)

          // Use router.push with replace to prevent back button issues
          // Don't use window.location.href as it causes hard refresh
          console.log("[Auth] Attempting router.push after registration...")
          try {
            // Use replace: true to prevent adding to history and ensure clean navigation
            router.push(postAuthPath)
            // Give router time to navigate - Next.js router.push is async
            // Don't check pathname immediately as it may not have updated yet
            console.log("[Auth] Router.push called, navigation in progress...")
          } catch (routerError) {
            console.error("[Auth] Router.push error:", routerError)
            // Only use window.location as absolute last resort, and log it
            console.warn("[Auth] Router.push failed, using window.location as fallback (this will cause refresh)")
            window.location.href = postAuthPath
          }
        }, 300) // Wait 300ms for fade-out animation

        return
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
        const t = typeof window !== "undefined" ? localStorage.getItem("sozu_username") : null
        if (t) setTagModalPrefill(t)
        setShowTagModal(true)
        return
      }

      // Check if error is a passkey cancellation in the error chain
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes("NotAllowedError") || errorMessage.includes("AbortError")) {
        console.log("[Auth] User cancelled passkey (detected in error message)")
        setIsAuthenticating(false)
        const t = typeof window !== "undefined" ? localStorage.getItem("sozu_username") : null
        if (t) setTagModalPrefill(t)
        setShowTagModal(true)
        return
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
          console.log("[Auth] Executing error recovery redirect via router:", postAuthPath)
          router.push(postAuthPath)
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
    <div className="relative h-full min-h-[var(--sozu-app-height,100lvh)] w-full overflow-hidden">

      {/* ── PWA install banner — fixed top toast, visible on mobile before install ── */}
      <AnimatePresence>
        {!isInstalled && !pwaBannerDismissed && (canInstall || isIos) && (
          <motion.div
            key="pwa-banner"
            initial={{ y: "-110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-110%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300, delay: 1.2 }}
            className="fixed left-3 right-3 z-[60] rounded-2xl border border-white/[0.10] px-4 py-3"
            style={{
              top: "max(0.75rem, env(safe-area-inset-top))",
              background: "rgba(18, 18, 20, 0.82)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <div className="flex items-center gap-3">
              {/* App icon */}
              <img
                src="/icons/sozu_icon_192.png"
                alt="Sozu"
                className="h-11 w-11 shrink-0 rounded-[22%] object-cover"
              />

              {/* Text */}
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-[13px] font-semibold text-white leading-tight">
                  Sozu
                </p>
                <p className="text-[11px] text-white/45 leading-tight mt-0.5">
                  {isIos
                    ? "Instálala desde Safari → Compartir → Agregar a inicio"
                    : "Guárdala en tu pantalla de inicio para acceso instantáneo"}
                </p>
              </div>

              {/* Install / Add CTA */}
              <button
                type="button"
                onClick={() => {
                  if (canInstall) void triggerInstall()
                  else setShowIosInstallModal(true)
                }}
                className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-black hover:bg-white/90 active:scale-95 transition-transform"
              >
                {isIos ? "Cómo instalar" : "Agregar a inicio"}
              </button>

              {/* Dismiss */}
              <button
                type="button"
                onClick={() => setPwaBannerDismissed(true)}
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-white/35 hover:text-white/60 transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOZU wordmark — top of screen, matches Passkey caption style */}
      <p className="pointer-events-none absolute top-[max(1.1rem,env(safe-area-inset-top))] left-0 right-0 z-[3] text-center text-[10px] font-extralight tracking-[0.12em] text-white">
        SOZU
      </p>

      {/* Logo and Version - Always centered, above everything (only visible when locked) */}
      <div className={`absolute inset-0 z-[2] flex flex-col items-center justify-center pointer-events-none transition-opacity duration-700 ${isAuthenticated
        ? "opacity-0"
        : "opacity-100"
        }`}>
        <div className="flex flex-col items-center gap-4">
          <img
            src="/sozucapital_logo_tb.png"
            alt="Sozu Wallet Logo"
            className="w-32 h-32 md:w-40 md:h-40 object-contain"
          />
          <div className="text-white/60 text-sm font-medium">
            v 0.1
          </div>
        </div>
      </div>

      {/* Post-auth skeleton — full viewport */}
      <div className="relative z-[1] h-full overflow-hidden">
        {isAuthenticated ? (
          <div className="z-10 h-full">
            <WalletSkeleton isExiting={isExiting} layout="landing" />
          </div>
        ) : null}
      </div>

      {/* Enter CTA — pinned to viewport bottom with safe-area inset (no scroll needed) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[4] flex w-full flex-col items-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-all duration-700 ${
          isAuthenticated
            ? "pointer-events-none scale-95 opacity-0"
            : "scale-100 opacity-100"
        }`}
      >
        <Button
          onClick={handleAuth}
          disabled={isAuthenticating}
          className="w-full md:w-1/6 h-16 text-lg font-semibold bg-white text-black hover:bg-white/90 active:bg-white/80 transition-all duration-200 rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden relative"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {isAuthenticating ? (
              <motion.div
                key="authenticating"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-center absolute inset-0"
              >
                <Fingerprint className="w-8 h-8" />
              </motion.div>
            ) : (
              <motion.span
                key="idle"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center"
              >
                Enter
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
        <p className="max-w-sm px-2 text-center text-[10px] font-extralight tracking-[0.12em] text-white">
          Passkey on this device
        </p>

        {/* PWA banner placeholder — actual banner is fixed at top, rendered below */}
      </div>

      {/* Welcome Modal - Shows on first visit */}
      <WelcomeModal />

      {/* Tag Input Modal - Shows when user needs to choose a tag */}
      <TagInputModal
        isOpen={showTagModal}
        resumeWithTag={resumeLoginTag}
        prefillTag={tagModalPrefill}
        onClose={() => {
          setShowTagModal(false)
          setIsAuthenticating(false)
          setResumeLoginTag(null)
          setTagModalPrefill(null)
        }}
        onRegister={handleRegisterFromModal}
        onLoginPasskey={handleLoginPasskeyFromModal}
        onLoginPin={handlePinLoginFromModal}
      />

      {/* iOS "Add to Home Screen" instructions modal */}
      <AnimatePresence>
        {showIosInstallModal && (
          <>
            {/* Backdrop */}
            <motion.div
              key="ios-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowIosInstallModal(false)}
            />

            {/* Bottom sheet */}
            <motion.div
              key="ios-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[#111] border-t border-white/10 px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              {/* Handle */}
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />

              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-white font-semibold text-base">Instala Sozu en tu iPhone</p>
                  <p className="text-white/45 text-xs mt-0.5">3 pasos rápidos desde Safari — sin App Store</p>
                </div>
                <button
                  onClick={() => setShowIosInstallModal(false)}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 ml-4"
                  aria-label="Cerrar"
                >
                  <X className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>

              {/* Steps */}
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/60">1</span>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug">Abre esta página en Safari</p>
                    <p className="text-white/45 text-[11px] mt-0.5 leading-snug">
                      La instalación solo funciona desde el navegador Safari de Apple
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/60">2</span>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug">
                      Toca{" "}
                      <Share className="inline w-3.5 h-3.5 text-[#0a84ff] align-text-bottom" />
                      {" "}<span className="text-[#0a84ff]">Compartir</span>{" "}en la barra inferior
                    </p>
                    <p className="text-white/45 text-[11px] mt-0.5 leading-snug">
                      Es el ícono de cuadrado con flecha hacia arriba
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/60">3</span>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug">
                      Selecciona{" "}<span className="text-white font-semibold">"Agregar a pantalla de inicio"</span>
                    </p>
                    <p className="text-white/45 text-[11px] mt-0.5 leading-snug">
                      Desplázate en el menú hasta encontrarlo, luego toca{" "}
                      <span className="text-white/70">"Agregar"</span> arriba a la derecha
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[11px] font-semibold text-emerald-400">✓</span>
                  <div className="pt-0.5 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug">Sozu aparece en tu inicio</p>
                    <p className="text-white/45 text-[11px] mt-0.5 leading-snug">
                      Ábrela como cualquier app — sin App Store, sin contraseñas
                    </p>
                  </div>
                </li>
              </ol>

              {/* Dismiss button */}
              <button
                onClick={() => setShowIosInstallModal(false)}
                className="mt-5 w-full py-3.5 rounded-2xl bg-white text-black text-[13px] font-semibold hover:bg-white/90 active:scale-[0.98] transition-all"
              >
                Entendido
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[var(--sozu-app-height,100lvh)] items-center justify-center bg-black text-white">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}
