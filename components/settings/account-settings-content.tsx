"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Trash2,
  AlertTriangle,
  Loader2,
  Fingerprint,
  Smartphone,
  Copy,
  Check,
  Lock,
  ChevronLeft,
} from "lucide-react"
import { getUserId } from "@/lib/wallet-utils"
import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import {
  createPasskey,
  fetchPasskeyStatus,
  generateAddPasskeyChallenge,
  generateAuthChallenge,
  getPasskey,
  initPasskeyPairing,
  verifyAddPasskey,
} from "@/lib/turnkey/passkeys"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AccountSettingsContentProps = {
  onBack?: () => void
}

export function AccountSettingsContent({ onBack }: AccountSettingsContentProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [passkeyStatus, setPasskeyStatus] = useState<{
    count: number
    max: number
    canAddMore: boolean
    username?: string
    pinSet?: boolean
  } | null>(null)
  const [backupPin, setBackupPin] = useState("")
  const [pinSaveBusy, setPinSaveBusy] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(true)
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const [pairingInfo, setPairingInfo] = useState<{ code: string; expiresInSeconds: number } | null>(null)
  const [addPasskeyBusy, setAddPasskeyBusy] = useState(false)
  const [pairingBusy, setPairingBusy] = useState(false)
  const [syncPaste, setSyncPaste] = useState("")
  const [syncBusy, setSyncBusy] = useState(false)
  const [walletSyncPending, setWalletSyncPending] = useState(false)
  const [pairingCopied, setPairingCopied] = useState(false)
  const [sozuTag, setSozuTag] = useState<string>("")

  useEffect(() => {
    const userId = getUserId()
    if (!userId) return
    fetch("/api/auth/passkeys/status", { headers: { "x-user-id": userId } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.username) setSozuTag(data.username)
      })
      .catch(() => {})
  }, [])

  const loadPasskeyStatus = useCallback(async () => {
    if (!getUserId()) {
      setPasskeyLoading(false)
      return
    }
    setPasskeyLoading(true)
    setPasskeyError(null)
    try {
      const s = await fetchPasskeyStatus()
      setPasskeyStatus(s)
    } catch (e) {
      setPasskeyError(e instanceof Error ? e.message : "Could not load passkeys")
    } finally {
      setPasskeyLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPasskeyStatus()
    if (typeof window !== "undefined") {
      setWalletSyncPending(sessionStorage.getItem("wallet_sync_pending") === "1")
    }
  }, [loadPasskeyStatus])

  const handleAddPasskeyThisDevice = async () => {
    const uid = getUserId()
    const { getCredentialIdFromSession, storeCredentialIdInSession } = await import("@/lib/storage/key-utils")
    const sourceCred = getCredentialIdFromSession()
    if (!uid || !sourceCred) {
      setPasskeyMessage(null)
      setPasskeyError("Missing session. Open the wallet from this browser, then try again.")
      return
    }
    if (!passkeyStatus?.canAddMore) {
      setPasskeyError("You already have two passkeys for this account.")
      return
    }
    setAddPasskeyBusy(true)
    setPasskeyError(null)
    setPasskeyMessage(null)
    try {
      const challenge = await generateAddPasskeyChallenge({})
      const cred = await createPasskey(challenge, challenge.user?.id, challenge.user?.displayName)
      if (!cred) throw new Error("Passkey creation failed")
      await verifyAddPasskey(cred, challenge.challenge, {})
      const { cloneEncryptedKeyForNewCredential } = await import("@/lib/storage/browser-keys")
      const cloned = await cloneEncryptedKeyForNewCredential(sourceCred, cred.id, uid)
      if (!cloned) {
        throw new Error("Could not copy wallet keys to the new passkey on this device.")
      }
      storeCredentialIdInSession(cred.id)
      sessionStorage.removeItem("wallet_sync_pending")
      setWalletSyncPending(false)
      setPasskeyMessage("Second passkey registered on this browser and linked to the same wallet.")
      await loadPasskeyStatus()
    } catch (e) {
      if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) {
        setPasskeyError("Passkey prompt was cancelled.")
      } else {
        setPasskeyError(e instanceof Error ? e.message : "Failed to add passkey")
      }
    } finally {
      setAddPasskeyBusy(false)
    }
  }

  const handleCreatePairing = async () => {
    setPairingBusy(true)
    setPasskeyError(null)
    setPasskeyMessage(null)
    setPairingCopied(false)
    try {
      const p = await initPasskeyPairing()
      setPairingInfo({ code: p.pairingCode, expiresInSeconds: p.expiresInSeconds })
      setPasskeyMessage("Give the code to your other device (valid for a limited time).")
    } catch (e) {
      setPasskeyError(e instanceof Error ? e.message : "Could not create pairing code")
      setPairingInfo(null)
    } finally {
      setPairingBusy(false)
    }
  }

  const handleSyncWallet = async () => {
    const uid = getUserId()
    const { getCredentialIdFromSession, storeCredentialIdInSession } = await import("@/lib/storage/key-utils")
    const sourceCred = getCredentialIdFromSession()
    if (!uid || !sourceCred) {
      setPasskeyError("Missing session or passkey on this device.")
      return
    }
    let targetId = syncPaste.trim()
    try {
      const parsed = JSON.parse(targetId) as { credentialId?: string }
      if (parsed?.credentialId && typeof parsed.credentialId === "string") {
        targetId = parsed.credentialId
      }
    } catch {
      /* treat as raw credential id */
    }
    if (!targetId) {
      setPasskeyError("Paste the credential ID or the full QR JSON from your other device.")
      return
    }
    setSyncBusy(true)
    setPasskeyError(null)
    setPasskeyMessage(null)
    try {
      const listRes = await fetch("/api/auth/passkeys/list", { headers: { "x-user-id": uid } })
      const listJson = (await listRes.json()) as { passkeys?: { credential_id: string }[]; error?: string }
      if (!listRes.ok) {
        throw new Error(listJson.error || "Could not verify passkeys")
      }
      const ids = (listJson.passkeys ?? []).map((p) => p.credential_id)
      if (!ids.includes(targetId)) {
        throw new Error("That credential is not registered for your account (check tag and pairing flow).")
      }
      if (targetId === sourceCred) {
        throw new Error("That is already this device’s passkey — nothing to sync.")
      }
      const { cloneEncryptedKeyForNewCredential } = await import("@/lib/storage/browser-keys")
      const cloned = await cloneEncryptedKeyForNewCredential(sourceCred, targetId, uid)
      if (!cloned) {
        throw new Error("Could not read wallet keys from this device. Use the passkey that already controls this wallet.")
      }
      storeCredentialIdInSession(targetId)
      sessionStorage.setItem("stellar_public_key", cloned.publicKey)
      sessionStorage.removeItem("wallet_sync_pending")
      setWalletSyncPending(false)
      setSyncPaste("")
      setPasskeyMessage("Wallet keys are now available for the other passkey on this browser.")
      await loadPasskeyStatus()
    } catch (e) {
      setPasskeyError(e instanceof Error ? e.message : "Sync failed")
    } finally {
      setSyncBusy(false)
    }
  }

  const handleSaveBackupPin = async () => {
    const uid = getUserId()
    if (!uid) return
    const digits = backupPin.replace(/\D/g, "")
    if (digits.length < 6 || digits.length > 12) {
      setPasskeyError("PIN must be 6–12 digits.")
      return
    }
    setPinSaveBusy(true)
    setPasskeyError(null)
    setPasskeyMessage(null)
    try {
      const res = await fetch("/api/auth/pin/set", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": uid },
        body: JSON.stringify({ pin: digits }),
      })
      const j = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        setPasskeyError(j.message || j.error || "Could not save PIN")
        return
      }
      setBackupPin("")
      setPasskeyMessage("Backup PIN saved. You can use it on the sign-in screen with your Sozu tag.")
      await loadPasskeyStatus()
    } catch {
      setPasskeyError("Network error saving PIN.")
    } finally {
      setPinSaveBusy(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const challenge = await generateAuthChallenge()
      const credential = await getPasskey(challenge)
      if (!credential) {
        setDeleteError("Passkey sign-in was cancelled. Please try again.")
        setIsDeleting(false)
        return
      }

      const userId = getUserId()
      if (!userId) throw new Error("Session expired. Please log in again.")
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account")
      }

      try {
        const supabase = createSupabaseClient()
        await supabase.auth.signOut()
      } catch {
        /* non-fatal */
      }
      const { clearClientSession } = await import("@/lib/storage/clear-session")
      clearClientSession()
      window.location.replace("/auth")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to delete account"
      const isCancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("notallowed")
      setDeleteError(isCancelled ? "Passkey sign-in was cancelled. Please try again." : msg)
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors -mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Settings
        </button>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold text-white">Account settings</h1>
        <p className="text-sm text-white/50 mt-1">Passkeys, devices, and account security.</p>
      </div>

      <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Fingerprint className="w-5 h-5" />
            Passkeys & devices
          </CardTitle>
          <CardDescription className="text-white/60">
            Register up to two passkeys for the same account (for example phone and laptop) and recovery if one device
            is lost. Your Stellar wallet stays the same; the second passkey must receive a copy of your encrypted keys
            from a device that already has them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletSyncPending && (
            <Alert className="border-amber-500/40 bg-amber-950/30">
              <AlertTitle className="text-amber-200">Wallet sync needed</AlertTitle>
              <AlertDescription className="text-white/80 text-sm">
                You signed in with a new passkey, but this browser does not yet have your wallet signing keys for it.
                After you add the passkey on the other device, paste the credential ID (or QR JSON) below.
              </AlertDescription>
            </Alert>
          )}
          {passkeyLoading ? (
            <p className="text-sm text-white/50 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading passkeys…
            </p>
          ) : passkeyStatus ? (
            <p className="text-sm text-white/80">
              Registered passkeys:{" "}
              <span className="font-semibold text-white">
                {passkeyStatus.count} / {passkeyStatus.max}
              </span>
            </p>
          ) : null}
          {passkeyError && <p className="text-sm text-amber-200">{passkeyError}</p>}
          {passkeyMessage && <p className="text-sm text-emerald-200/90">{passkeyMessage}</p>}

          <div className="border border-white/10 rounded-lg p-3 space-y-2 bg-white/[0.02]">
            <div className="flex items-center gap-2 text-white/80 text-sm">
              <Lock className="w-4 h-4" />
              Backup PIN
            </div>
            {passkeyStatus?.pinSet ? (
              <p className="text-xs text-white/45">A backup PIN is already set for this account.</p>
            ) : (
              <>
                <p className="text-xs text-white/45">
                  Optional. 6–12 digits. Lets you open the app with your tag + PIN when a passkey prompt is awkward.
                  Does not replace your passkey for signing transactions unless this device already has your keys.
                </p>
                <Input
                  type="password"
                  inputMode="numeric"
                  value={backupPin}
                  onChange={(e) => setBackupPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="digits only"
                  className="bg-white/5 border-white/15 text-white text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pinSaveBusy || backupPin.replace(/\D/g, "").length < 6}
                  className="border-white/25 text-white hover:bg-white/10"
                  onClick={() => void handleSaveBackupPin()}
                >
                  {pinSaveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save backup PIN"}
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              onClick={() => void handleAddPasskeyThisDevice()}
              disabled={addPasskeyBusy || !passkeyStatus?.canAddMore}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              {addPasskeyBusy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding passkey…
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4 mr-2" />
                  Register another passkey on this browser
                </>
              )}
            </Button>
            <p className="text-xs text-white/45">
              Creates a second passkey in this browser and copies your existing wallet keys to it. Use when two
              passkeys live on the same machine (e.g. two profiles) or after testing.
            </p>
          </div>

          <div className="border-t border-white/10 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-white font-medium text-sm">
              <Smartphone className="w-4 h-4" />
              Phone or other device
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCreatePairing()}
              disabled={pairingBusy || !passkeyStatus?.canAddMore}
              className="w-full border-white/25 text-white hover:bg-white/10"
            >
              {pairingBusy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate pairing code"
              )}
            </Button>
            {pairingInfo && (
              <div className="rounded-lg border border-white/15 bg-white/5 p-4 space-y-2">
                <p className="text-xs text-white/50">Pairing code</p>
                <p className="text-2xl font-mono tracking-[0.2em] text-white text-center">{pairingInfo.code}</p>
                <p className="text-xs text-white/45 text-center">
                  Expires in about {Math.floor(pairingInfo.expiresInSeconds / 60)} min
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-white/80 hover:text-white hover:bg-white/10"
                  onClick={async () => {
                    await navigator.clipboard.writeText(pairingInfo.code)
                    setPairingCopied(true)
                    setTimeout(() => setPairingCopied(false), 2000)
                  }}
                >
                  {pairingCopied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy code
                    </>
                  )}
                </Button>
                <p className="text-xs text-white/55 pt-2">
                  On the other device, open{" "}
                  <a href="/auth/add-device" className="text-sky-300 underline underline-offset-2">
                    /auth/add-device
                  </a>{" "}
                  (same site), enter your Sozu tag and this code, then follow the passkey prompt. Then return here and
                  use &quot;Sync wallet&quot; below with the QR or credential ID shown on the new device.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-4 space-y-2">
            <Label className="text-white/80 text-sm">Sync wallet to another passkey (this browser)</Label>
            <Input
              value={syncPaste}
              onChange={(e) => setSyncPaste(e.target.value)}
              placeholder="Paste credential ID or QR JSON from the other device"
              className="bg-white/5 border-white/20 text-white text-sm font-mono"
              disabled={syncBusy}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSyncWallet()}
              disabled={syncBusy}
              className="w-full border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
            >
              {syncBusy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing…
                </>
              ) : (
                "Sync wallet"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-500/40 bg-red-950/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-red-300/80">Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-white font-semibold">Delete Account</h3>
            <p className="text-white/60 text-sm">
              Permanently delete your account and free up your Sozu tag. This action cannot be undone. Your username
              will be available for others to claim.
            </p>
            <ul className="text-white/60 text-sm list-disc list-inside space-y-1 mt-2">
              <li>All your data will be permanently deleted</li>
              <li>Your Sozu tag will be freed and can be claimed by anyone</li>
              <li>Your wallet and balance information will be removed</li>
              <li>This action cannot be reversed</li>
            </ul>
          </div>

          {deleteError && (
            <Alert variant="destructive" className="bg-red-950/50 border-red-500/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => setIsDeleteDialogOpen(true)}
            variant="destructive"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(open)
            if (!open) setDeleteError(null)
          }
        }}
      >
        <DialogContent className="bg-black border-red-500/50 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-white/60">
              This action is permanent and cannot be undone. All your data and your Sozu tag{" "}
              <span className="font-mono text-white/80">${sozuTag}</span> will be freed.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <ul className="text-white/50 text-xs space-y-1 list-disc list-inside">
              <li>All account data deleted permanently</li>
              <li>Sozu tag freed — anyone can claim it</li>
              <li>Wallet &amp; balance records removed</li>
            </ul>

            {deleteError && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-500/50 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">{deleteError}</AlertDescription>
              </Alert>
            )}

            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/30 hover:bg-red-950/60 active:scale-[0.98] transition-all px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
                ) : (
                  <Fingerprint className="w-5 h-5 text-red-400" />
                )}
              </div>

              <div className="flex flex-col items-start text-left">
                <span className="text-white font-semibold text-sm leading-tight">
                  {isDeleting ? "Deleting account…" : "Sign with passkey"}
                </span>
                <span className="text-white/40 text-xs leading-tight mt-0.5">
                  {isDeleting ? "Please wait" : "Confirm with biometrics to delete"}
                </span>
              </div>
            </button>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setDeleteError(null)
              }}
              disabled={isDeleting}
              className="w-full text-white/50 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
