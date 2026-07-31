"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, Smartphone } from "lucide-react"
import {
  createPasskey,
  generateRegistrationChallenge,
  verifyRegistration,
} from "@/lib/turnkey/passkeys"
import { isPasskeyCapable } from "@/lib/webauthn/device-detection"

function CrossDeviceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'registering' | 'success' | 'error' | 'incompatible'>('checking')
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const sessionId = searchParams.get('sid')
    const usernameParam = searchParams.get('u')

    if (!sessionId || !usernameParam) {
      setError('Invalid QR code. Missing session information.')
      setStatus('error')
      return
    }

    setUsername(usernameParam)

    const completeRegistration = async () => {
      try {
        const sessionRes = await fetch(
          `/api/auth/cross-device/status?sessionId=${encodeURIComponent(sessionId)}`
        )
        const sessionData = await sessionRes.json()

        if (sessionData.expired) {
          throw new Error('This QR code expired. Go back to desktop and generate a new one.')
        }
        if (sessionData.completed) {
          setStatus('success')
          setTimeout(() => router.push('/auth'), 1500)
          return
        }
        if (sessionData.username && sessionData.username !== usernameParam) {
          throw new Error('Username does not match this QR session.')
        }

        const canCreate = await isPasskeyCapable()

        if (!canCreate) {
          setStatus('incompatible')
          setError('This device also lacks biometric authentication. Please use a device with Face ID, Touch ID, or fingerprint sensor.')
          return
        }

        setStatus('registering')

        // Client helpers hit /api/auth/register/* (server-safe). Do not import them from route handlers.
        const challenge = await generateRegistrationChallenge(usernameParam)

        if (!challenge) {
          throw new Error('Failed to generate challenge')
        }

        if (challenge.user) {
          challenge.user.displayName = usernameParam
          challenge.user.name = usernameParam
        }

        const tempUserId = crypto.randomUUID()
        const credential = await createPasskey(challenge, tempUserId, usernameParam)

        if (!credential) {
          throw new Error('Failed to create passkey')
        }

        const regResult = await verifyRegistration(
          usernameParam,
          credential,
          challenge.challenge,
          null
        )

        if (!regResult?.success || !regResult.userId) {
          throw new Error('Registration verification failed')
        }

        const response = await fetch('/api/auth/cross-device/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            username: usernameParam,
            userId: regResult.userId,
            credentialId: credential.id,
          })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to notify desktop')
        }

        setStatus('success')

        setTimeout(() => {
          router.push('/home')
        }, 2000)

      } catch (err) {
        console.error('[Cross-Device] Registration error:', err)
        setError(err instanceof Error ? err.message : 'Registration failed')
        setStatus('error')
      }
    }

    completeRegistration()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Smartphone className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Complete Registration</h1>
          {username && (
            <p className="text-sm text-muted-foreground">
              Setting up <span className="font-mono font-medium">{username}</span>
            </p>
          )}
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          {status === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Checking device compatibility...</p>
            </div>
          )}

          {status === 'registering' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm font-medium">Creating your secure wallet...</p>
              <p className="text-xs text-muted-foreground text-center">
                You may be prompted to use Face ID, Touch ID, or fingerprint
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <div className="space-y-1">
                <p className="text-lg font-medium text-green-700 dark:text-green-400">
                  Registration Complete!
                </p>
                <p className="text-sm text-muted-foreground">
                  Your desktop will update automatically
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-16 w-16 text-destructive" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-destructive">
                  Registration Failed
                </p>
                <p className="text-sm text-muted-foreground">
                  {error}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => router.push('/auth')}
                className="mt-4"
              >
                Return to Login
              </Button>
            </div>
          )}

          {status === 'incompatible' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-16 w-16 text-orange-500" />
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  Device Not Compatible
                </p>
                <p className="text-sm text-muted-foreground">
                  {error}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => router.push('/auth')}
                className="mt-4"
              >
                Try Different Device
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Sozu Wallet is self-custodial. Your keys never leave your device.
        </p>
      </div>
    </div>
  )
}

export default function CrossDevicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <CrossDeviceContent />
    </Suspense>
  )
}
