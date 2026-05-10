"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { ArrowLeft, Fingerprint, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  createPasskey,
  generateAddPasskeyChallenge,
  verifyAddPasskey,
} from "@/lib/turnkey/passkeys"

export default function AddDevicePage() {
  const router = useRouter()
  const [tag, setTag] = useState("")
  const [pairingCode, setPairingCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneCredentialId, setDoneCredentialId] = useState<string | null>(null)
  const [doneUsername, setDoneUsername] = useState<string | null>(null)

  const onSubmit = useCallback(async () => {
    setError(null)
    const code = pairingCode.replace(/\s+/g, "").toUpperCase()
    const u = tag.replace(/^\$/, "").trim()
    if (!u || !code) {
      setError("Enter your Sozu tag and the pairing code from your other device.")
      return
    }
    setBusy(true)
    try {
      const challenge = await generateAddPasskeyChallenge({ pairingCode: code, username: u })
      const cred = await createPasskey(challenge, challenge.user?.id, challenge.user?.displayName)
      if (!cred) throw new Error("Passkey creation failed")
      const result = await verifyAddPasskey(cred, challenge.challenge, { pairingCode: code, username: u })
      if (!result.success || !result.credentialId) throw new Error("Verification failed")
      setDoneCredentialId(result.credentialId)
      setDoneUsername(u)
      if (typeof window !== "undefined") {
        localStorage.setItem("sozu_username", u)
      }
    } catch (e) {
      if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) {
        setError("Passkey prompt was cancelled.")
      } else {
        setError(e instanceof Error ? e.message : "Something went wrong")
      }
    } finally {
      setBusy(false)
    }
  }, [tag, pairingCode])

  const qrPayload =
    doneCredentialId && doneUsername
      ? JSON.stringify({
          v: 1,
          kind: "sozu-wallet-sync",
          username: doneUsername,
          credentialId: doneCredentialId,
        })
      : ""

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <button
          type="button"
          onClick={() => router.push("/auth")}
          className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>

        <Card className="border-white/20 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Add this device
            </CardTitle>
            <CardDescription className="text-white/60">
              On your signed-in device, open Settings → Passkeys and generate a pairing code. Enter your Sozu tag and
              that code here, then create a passkey on this device. You can register up to two passkeys per account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!doneCredentialId ? (
              <>
                <div className="space-y-2">
                  <Label className="text-white/80">Sozu tag</Label>
                  <Input
                    value={tag}
                    onChange={(e) => setTag(e.target.value.replace(/[^a-zA-Z0-9_$]/g, ""))}
                    placeholder="yourtag"
                    className="bg-white/5 border-white/20 text-white"
                    disabled={busy}
                    autoCapitalize="none"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Pairing code</Label>
                  <Input
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    placeholder="From Settings on your other device"
                    className="bg-white/5 border-white/20 text-white font-mono tracking-wider"
                    disabled={busy}
                    autoCapitalize="characters"
                  />
                </div>
                {error && <p className="text-sm text-amber-300">{error}</p>}
                <Button
                  type="button"
                  onClick={() => void onSubmit()}
                  disabled={busy}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Working…
                    </>
                  ) : (
                    "Continue with passkey"
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-emerald-400 text-sm font-medium">Passkey added for this device.</p>
                <p className="text-white/60 text-sm">
                  So this device can sign with the same Stellar wallet, open Settings on your{" "}
                  <span className="text-white/90">original</span> device → Passkeys → &quot;Sync wallet&quot;, then
                  scan this QR or paste the credential ID.
                </p>
                <div className="flex justify-center p-4 bg-white rounded-xl">
                  <QRCodeSVG value={qrPayload} size={200} level="M" />
                </div>
                <p className="text-xs text-white/40 font-mono break-all">{doneCredentialId}</p>
                <Button type="button" variant="outline" className="border-white/30 text-white" onClick={() => router.push("/auth")}>
                  Done — go to sign in
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
