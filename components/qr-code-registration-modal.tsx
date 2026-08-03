"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Smartphone, RefreshCw } from "lucide-react"
import { pollCrossDeviceCompletion, formatRemainingTime } from "@/lib/webauthn/qr-cross-device"
import Image from "next/image"
import { useWalletLanguage } from "@/lib/wallet-language"

interface QRCodeRegistrationModalProps {
  isOpen: boolean
  username: string
  onComplete: (userId: string, username: string, credentialId: string) => void
  onCancel: () => void
}

export function QRCodeRegistrationModal({
  isOpen,
  username,
  onComplete,
  onCancel
}: QRCodeRegistrationModalProps) {
  const { t } = useWalletLanguage()
  const [qrDataURL, setQrDataURL] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number>(0)
  const [remainingMs, setRemainingMs] = useState<number>(60000)
  const [status, setStatus] = useState<'generating' | 'ready' | 'polling' | 'timeout' | 'error'>('generating')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !username) return

    const initSession = async () => {
      try {
        setStatus('generating')
        setError(null)

        const response = await fetch('/api/auth/cross-device/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        })

        if (!response.ok) {
          throw new Error(t.qrError)
        }

        const data = await response.json()

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
        const mobileUrl = `${appUrl}/auth/cross-device?sid=${data.sessionId}&u=${encodeURIComponent(username)}`

        const qr = await import('qrcode')
        const qrCode = await qr.toDataURL(mobileUrl, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 300,
          color: { dark: '#000000', light: '#FFFFFF' }
        })

        setQrDataURL(qrCode)
        setSessionId(data.sessionId)
        setExpiresAt(data.expiresAt)
        setRemainingMs(data.expiresAt - Date.now())
        setStatus('ready')
      } catch (err) {
        console.error('[QR Modal] Failed to generate QR:', err)
        setError(t.qrError)
        setStatus('error')
      }
    }

    void initSession()
  }, [isOpen, username, t.qrError])

  useEffect(() => {
    if (status !== 'ready' || !sessionId) return

    setStatus('polling')

    const startPolling = async () => {
      try {
        const result = await pollCrossDeviceCompletion(sessionId, (remaining) => {
          setRemainingMs(remaining)
        })

        if (result.completed && result.userId && result.username && result.credentialId) {
          onComplete(result.userId, result.username, result.credentialId)
        } else if (result.timedOut) {
          setStatus('timeout')
        }
      } catch (err) {
        console.error('[QR Modal] Polling error:', err)
        setStatus('error')
        setError(t.qrConnectionError)
      }
    }

    void startPolling()
  }, [status, sessionId, onComplete, t.qrConnectionError])

  useEffect(() => {
    if (status !== 'polling') return

    const interval = setInterval(() => {
      const remaining = expiresAt - Date.now()
      if (remaining <= 0) {
        setRemainingMs(0)
        clearInterval(interval)
      } else {
        setRemainingMs(remaining)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [status, expiresAt])

  const handleRetry = useCallback(() => {
    setStatus('generating')
    setError(null)
    setQrDataURL(null)
    setSessionId(null)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t.qrTitle}
          </DialogTitle>
          <DialogDescription>
            {t.qrBody}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {status === 'generating' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t.qrGenerating}</p>
            </div>
          )}

          {(status === 'ready' || status === 'polling') && qrDataURL && (
            <>
              <div className="rounded-lg border-4 border-border p-4 bg-white">
                <Image
                  src={qrDataURL}
                  alt="QR Code"
                  width={300}
                  height={300}
                  className="w-full h-auto"
                />
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">
                  {status === 'polling' ? t.qrWaiting : t.qrScan}
                </p>
                <p className="text-2xl font-mono font-bold">
                  {formatRemainingTime(remainingMs)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.qrCameraHint}
                </p>
              </div>
            </>
          )}

          {status === 'timeout' && (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                {t.qrTimeout}
              </p>
              <Button onClick={handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t.qrRetry}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t.qrRetry}
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
