"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SozuTagCard } from "@/components/settings/sozu-tag-card"
import {
  Trash2,
  AlertTriangle,
  Loader2,
  Mail,
  ExternalLink,
  Fingerprint,
  Smartphone,
  Copy,
  Check,
  Lock,
  BarChart3,
  Languages,
} from "lucide-react"
import { loadTreasuryPrefs, saveTreasuryPrefs } from "@/lib/treasury/prefs-storage"
import type { TreasuryPrefs, ReferenceFiat, TreasuryMode } from "@/lib/treasury/types"
import { TREASURY_MODE_CONFIG } from "@/lib/treasury/treasury-modes"
import { useYieldPrefs } from "@/hooks/use-yield-prefs"
import { getStrategyCatalog } from "@/lib/defindex/strategy-catalog"
import { getBlendStrategyLink } from "@/lib/defindex/blend-strategy-link"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AppLanguageSelector } from "@/components/app-language-selector"
import { useWalletLanguage } from "@/lib/wallet-language"

export default function SettingsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const redirectedRef = useRef(false)
  const { t } = useWalletLanguage()

  useEffect(() => {
    if (redirectedRef.current || pathname !== "/settings") return
    redirectedRef.current = true
    router.replace("/home?panel=settings")
  }, [pathname, router])

  const [username, setUsername] = useState<string>("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean
    googleEmail?: string
    lastSyncAt?: string | null
    migrationRequired?: boolean
    message?: string
  } | null>(null)
  const [gmailLoading, setGmailLoading] = useState(true)
  const [gmailConnectLoading, setGmailConnectLoading] = useState(false)
  const [gmailConnectMessage, setGmailConnectMessage] = useState<string | null>(null)
  const [gmailSyncLoading, setGmailSyncLoading] = useState(false)
  const [gmailFlash, setGmailFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null)

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

  // Treasury preferences
  const [treasuryPrefs, setTreasuryPrefs] = useState<TreasuryPrefs>(() => loadTreasuryPrefs())

  // Yield preferences
  const { prefs: yieldPrefs, setStrategy: setYieldStrategy, setAutoEarn, loaded: yieldLoaded } = useYieldPrefs()
  const strategyCatalog = getStrategyCatalog(process.env.NEXT_PUBLIC_STELLAR_NETWORK)
  const [pairingCopied, setPairingCopied] = useState(false)

  // Resolved sozutag — fetched from the server on mount so we always show
  // the real username, not the UUID that sessionStorage("dev_username") holds.
  const [sozuTag, setSozuTag] = useState<string>("")

  useEffect(() => {
    // Get username from session storage
    const storedUsername = sessionStorage.getItem("dev_username")
    if (storedUsername) {
      setUsername(storedUsername)
    } else {
      // No username means not logged in - redirect to auth
      router.push("/auth")
    }
  }, [router])

  // Fetch the real sozutag from the profile API as soon as we have a userId.
  // sessionStorage("dev_username") stores the UUID, not the tag.
  useEffect(() => {
    const userId = getUserId()
    if (!userId) return
    fetch("/api/auth/passkeys/status", { headers: { "x-user-id": userId } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.username) setSozuTag(data.username)
      })
      .catch(() => {})
  }, [username])

  const loadGmail = useCallback(async () => {
    setGmailLoading(true)
    try {
      const res = await fetch("/api/gmail/status", { headers: ledgerUserHeaders() })
      const json = await res.json()
      if (!res.ok) {
        setGmailStatus({ connected: false, message: json.error ?? "Could not load Gmail status" })
        return
      }
      setGmailStatus(json)
    } catch {
      setGmailStatus({ connected: false, message: "Network error" })
    } finally {
      setGmailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGmail()
  }, [loadGmail])

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

  useEffect(() => {
    if (typeof window === "undefined") return
    const sp = new URLSearchParams(window.location.search)
    const g = sp.get("gmail")
    if (!g) return
    const raw = sp.get("msg")
    const decoded = raw ? decodeURIComponent(raw.replace(/\+/g, " ")) : ""
    if (g === "linked") {
      setGmailFlash({ kind: "success", text: "Gmail linked successfully. Use Sync from the ledger when it is available." })
    } else if (g === "denied") {
      setGmailFlash({ kind: "error", text: "Google sign-in was cancelled." })
    } else if (g === "error") {
      setGmailFlash({
        kind: "error",
        text: decoded || "Could not complete Gmail linking. Check GOOGLE_CLIENT_SECRET and redirect URI in Google Cloud.",
      })
    }
    window.history.replaceState({}, "", "/settings")
    void loadGmail()
  }, [loadGmail])

  const handleSyncGmail = async () => {
    setGmailSyncLoading(true)
    setGmailConnectMessage(null)
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { ...ledgerUserHeaders() },
        signal: AbortSignal.timeout(280_000),
      })
      let json: Record<string, unknown> = {}
      try {
        json = (await res.json()) as Record<string, unknown>
      } catch {
        if (res.status === 504 || res.status === 502) {
          setGmailConnectMessage(
            "Sync timed out on the server (many messages to re-import). Deploy the latest API or run sync again; Pro plans allow longer runs."
          )
          return
        }
        setGmailConnectMessage("Sync returned an unreadable response.")
        return
      }
      if (!res.ok) {
        setGmailConnectMessage(
          (typeof json.hint === "string" && json.hint) ||
            (typeof json.error === "string" && json.error) ||
            "Sync failed"
        )
        return
      }
      const parts = [
        json.message,
        typeof json.listedMessages === "number"
          ? `Listed ${json.listedMessages} matching message(s).`
          : "",
        typeof json.skippedExisting === "number" && json.skippedExisting > 0
          ? `Skipped ${json.skippedExisting} already-imported message(s) (no re-download).`
          : "",
        typeof json.scanned === "number" ? `Fetched ${json.scanned}.` : "",
        typeof json.createdTransactions === "number" && json.createdTransactions > 0
          ? `Added ${json.createdTransactions} ledger row(s).`
          : "",
        json.listTruncated
          ? "More mail may exist beyond this sync cap — set GMAIL_SYNC_MAX_MESSAGES higher if needed."
          : "",
      ]
      setGmailFlash({
        kind: "success",
        text: parts.filter(Boolean).join(" "),
      })
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        setGmailConnectMessage(`${json.errors.length} issue(s): ${json.errors.slice(0, 3).join(" · ")}`)
      }
      await loadGmail()
    } catch {
      setGmailConnectMessage("Sync request failed.")
    } finally {
      setGmailSyncLoading(false)
    }
  }

  const handleDisconnectGmail = async () => {
    if (!confirm("Disconnect Gmail from Sozu? You can link again later.")) return
    try {
      const res = await fetch("/api/gmail/disconnect", {
        method: "POST",
        headers: { ...ledgerUserHeaders() },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setGmailFlash({ kind: "error", text: (j as { error?: string }).error ?? "Disconnect failed" })
        return
      }
      setGmailFlash({ kind: "success", text: "Gmail disconnected." })
      await loadGmail()
    } catch {
      setGmailFlash({ kind: "error", text: "Network error" })
    }
  }

  const handleLinkGmail = async () => {
    setGmailConnectLoading(true)
    setGmailConnectMessage(null)
    try {
      const res = await fetch("/api/gmail/connect", {
        method: "POST",
        headers: { ...ledgerUserHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (json.authUrl && typeof json.authUrl === "string") {
        window.location.href = json.authUrl
        return
      }
      setGmailConnectMessage(json.message ?? "Gmail OAuth is not configured on the server.")
    } catch {
      setGmailConnectMessage("Could not start Gmail linking.")
    } finally {
      setGmailConnectLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      // Step 1: Discovery-mode challenge — no username so any passkey on this device
      // can satisfy it, regardless of what name it was registered under.
      const challenge = await generateAuthChallenge()

      // Step 2: Trigger the biometric / passkey prompt
      const credential = await getPasskey(challenge)
      if (!credential) {
        setDeleteError("Passkey sign-in was cancelled. Please try again.")
        setIsDeleting(false)
        return
      }

      // Step 3: Call the delete API — auth via x-user-id (no Supabase session in this app)
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

      // Step 4: Clear all local state and hard-navigate to /auth.
      // Order matters:
      //   a) Sign out of Supabase first — this clears the sb-*-auth-token
      //      httpOnly cookies. Without this the middleware sees a valid
      //      Supabase session on the next request to /auth and server-redirects
      //      to /wallet, which then redirects back to /home, which sees empty
      //      sessionStorage and calls window.location.replace("/auth") again →
      //      infinite /home ↔ /wallet loop.
      //   b) Clear sessionStorage + relevant localStorage keys.
      //   c) Hard-navigate (window.location.replace, not router.push) so the
      //      entire React tree is torn down and no in-flight useEffect timers
      //      from WalletDataProvider fire against the now-empty session.
      try {
        const supabase = createSupabaseClient()
        await supabase.auth.signOut()
      } catch {
        // Non-fatal: proceed even if signOut fails (e.g. no session existed)
      }
      const { clearClientSession } = await import("@/lib/storage/clear-session")
      clearClientSession()
      window.location.replace("/auth")
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to delete account"
      // Surface cancelled passkey as a friendlier message
      const isCancelled = msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("notallowed")
      setDeleteError(isCancelled ? "Passkey sign-in was cancelled. Please try again." : msg)
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-white">
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <SozuTagCard />

        <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Languages className="w-5 h-5" />
              {t.language}
            </CardTitle>
            <CardDescription className="text-white/60">{t.settingsLanguageDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <AppLanguageSelector variant="settings" className="w-full max-w-sm" />
          </CardContent>
        </Card>

        {/* Treasury preferences */}
        <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Tesorería y moneda de referencia
            </CardTitle>
            <CardDescription className="text-white/60">
              La billetera muestra tu saldo en la moneda elegida. USDC es el saldo real en cadena — aparece en gris debajo del monto principal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Reference fiat */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm">Moneda de referencia</Label>
              <p className="text-xs text-white/45">
                Este es el monto grande en la tarjeta de saldo. El USDC real queda en la línea pequeña.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(["CLP", "ARS", "BRL", "COP"] as ReferenceFiat[]).map((fiat) => (
                  <button
                    key={fiat}
                    type="button"
                    onClick={() => {
                      const next = { ...treasuryPrefs, referenceFiat: fiat }
                      setTreasuryPrefs(next)
                      saveTreasuryPrefs(next)
                    }}
                    className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                      treasuryPrefs.referenceFiat === fiat
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                        : "border-white/15 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {fiat}
                  </button>
                ))}
              </div>
            </div>

            {/* Treasury mode */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm">Modo de tesorería</Label>
              <div className="space-y-2">
                {(["efficient", "balanced", "fast"] as TreasuryMode[]).map((m) => {
                  const cfg = TREASURY_MODE_CONFIG[m]
                  const active = treasuryPrefs.mode === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const next = { ...treasuryPrefs, mode: m }
                        setTreasuryPrefs(next)
                        saveTreasuryPrefs(next)
                      }}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-emerald-500/60 bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/25"
                      }`}
                    >
                      <div className={`text-sm font-medium ${active ? "text-emerald-300" : "text-white/80"}`}>
                        {cfg.label}
                      </div>
                      <div className="text-xs text-white/45 mt-0.5">{cfg.description}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Holding period */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm">Período de proyección</Label>
              <div className="grid grid-cols-4 gap-2">
                {([7, 14, 30, 90] as Array<7 | 14 | 30 | 90>).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const next = { ...treasuryPrefs, holdingDays: d }
                      setTreasuryPrefs(next)
                      saveTreasuryPrefs(next)
                    }}
                    className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                      treasuryPrefs.holdingDays === d
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                        : "border-white/15 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-white/30 leading-relaxed">
              Estimaciones basadas en tasas históricas. No garantizado. No constituye asesoramiento financiero.
            </p>
          </CardContent>
        </Card>

        {/* ── Yield Strategy Settings ──────────────────────────────── */}
        <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Estrategia de rendimiento
            </CardTitle>
            <CardDescription className="text-white/60">
              Elige cómo tu USDC genera rendimiento en DeFindex + Blend Capital.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Strategy selector */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm">Pool de Blend</Label>
              {yieldLoaded && (
                <div className="space-y-2">
                  {(["fixed", "yieldblox"] as const).map((stratId) => {
                    const cfg = strategyCatalog[stratId]
                    const active = yieldPrefs.strategy === stratId
                    const link = getBlendStrategyLink(process.env.NEXT_PUBLIC_STELLAR_NETWORK, stratId)
                    return (
                      <div key={stratId} className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => setYieldStrategy(stratId)}
                          className={`flex-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                            active
                              ? "border-emerald-500/60 bg-emerald-500/10"
                              : "border-white/10 bg-white/[0.02] hover:border-white/25"
                          }`}
                        >
                          <div className={`text-sm font-medium ${active ? "text-emerald-300" : "text-white/80"}`}>
                            {cfg.label}
                          </div>
                          <div className="text-xs text-white/45 mt-0.5">{cfg.description}</div>
                        </button>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 text-white/40 hover:text-white/70 transition-colors"
                          title={`Verificar ${cfg.label} en Blend`}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Auto-earn toggle */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm">Auto-earn</Label>
              <button
                type="button"
                onClick={() => setAutoEarn(!yieldPrefs.autoEarn)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  yieldPrefs.autoEarn
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <div className={`text-sm font-medium ${yieldPrefs.autoEarn ? "text-emerald-300" : "text-white/80"}`}>
                  {yieldPrefs.autoEarn ? "Activado" : "Desactivado"}
                </div>
                <div className="text-xs text-white/45 mt-0.5">
                  Mueve automáticamente el USDC nuevo a la estrategia seleccionada.
                </div>
              </button>
            </div>

            {process.env.NEXT_PUBLIC_STELLAR_NETWORK !== "mainnet" && (
              <p className="text-[11px] text-amber-400/60 leading-relaxed">
                En testnet se usa BlendUSDC (no el USDC real). Obtén tokens de prueba en testnet.blend.capital.
              </p>
            )}

            <p className="text-[11px] text-white/30 leading-relaxed">
              DeFindex administra los fondos en el pool de Blend seleccionado. El rendimiento no está garantizado.
            </p>
          </CardContent>
        </Card>

        {gmailFlash && (
          <Alert
            className={
              gmailFlash.kind === "success"
                ? "border-emerald-500/40 bg-emerald-950/30"
                : "border-amber-500/40 bg-amber-950/30"
            }
          >
            <AlertTitle className={gmailFlash.kind === "success" ? "text-emerald-200" : "text-amber-200"}>
              {gmailFlash.kind === "success" ? "Gmail" : "Notice"}
            </AlertTitle>
            <AlertDescription className="text-white/85 text-sm">{gmailFlash.text}</AlertDescription>
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => setGmailFlash(null)}
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Gmail & receipts
            </CardTitle>
            <CardDescription className="text-white/60">
              Link Gmail with read-only access to detect payment and receipt emails for your email ledger (no changes to
              your on-chain balance).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gmailLoading ? (
              <p className="text-sm text-white/50 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking connection…
              </p>
            ) : gmailStatus?.connected ? (
              <div className="space-y-2 text-sm">
                <p className="text-emerald-400 font-medium">Connected</p>
                <p className="text-white/80">
                  <span className="text-white/50">Google account:</span> {gmailStatus.googleEmail}
                </p>
                {gmailStatus.lastSyncAt && (
                  <p className="text-white/50 text-xs">Last sync: {new Date(gmailStatus.lastSyncAt).toLocaleString()}</p>
                )}
                <p className="text-white/45 text-xs pt-2">
                  Pull recent receipt-like messages (last 90 days) and add parsed amounts to your ledger when detected.
                </p>
                <p className="text-white/35 text-[11px] leading-relaxed">
                  Optional background sync about every 30 minutes: set <code className="text-white/50">CRON_SECRET</code>{" "}
                  in production and deploy with Vercel Cron (<code className="text-white/50">vercel.json</code>) hitting{" "}
                  <code className="text-white/50">/api/cron/gmail-sync</code>, or call that URL on the same schedule from
                  your own job with <code className="text-white/50">Authorization: Bearer …</code>.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={handleSyncGmail}
                    disabled={gmailSyncLoading}
                    className="bg-white text-black hover:bg-white/90"
                  >
                    {gmailSyncLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing…
                      </>
                    ) : (
                      "Sync receipts now"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDisconnectGmail}
                    className="border border-red-500/80 text-red-400 hover:!bg-red-500/10 hover:!text-red-300 hover:border-red-400"
                  >
                    Disconnect Gmail
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {gmailStatus?.migrationRequired && (
                  <Alert className="bg-amber-950/40 border-amber-500/40">
                    <AlertTitle className="text-amber-200">Database</AlertTitle>
                    <AlertDescription className="text-amber-100/90 text-sm">
                      {gmailStatus.message ?? "Apply the Supabase email_ledger migration so Gmail links can be stored."}
                    </AlertDescription>
                  </Alert>
                )}
                {gmailStatus?.message && !gmailStatus.migrationRequired && (
                  <p className="text-sm text-amber-200/90">{gmailStatus.message}</p>
                )}
                <p className="text-white/60 text-sm">
                  OAuth uses scope <code className="text-xs bg-white/10 px-1 rounded">gmail.readonly</code>. You will be
                  redirected to Google to approve access.
                </p>
                {gmailConnectMessage && <p className="text-sm text-amber-200/90">{gmailConnectMessage}</p>}
                <Button
                  type="button"
                  onClick={handleLinkGmail}
                  disabled={gmailConnectLoading}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  {gmailConnectLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opening…
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Link Gmail account
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
                  <p className="text-xs text-white/45 text-center">Expires in about {Math.floor(pairingInfo.expiresInSeconds / 60)} min</p>
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

        {/* Danger Zone */}
        <Card className="border-red-500/40 bg-red-950/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-red-300/80">
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-white font-semibold">Delete Account</h3>
              <p className="text-white/60 text-sm">
                Permanently delete your account and free up your Sozu tag. This action cannot be undone.
                Your username will be available for others to claim.
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
      </div>

      {/* Delete Confirmation Dialog */}
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
            {/* What gets deleted */}
            <ul className="text-white/50 text-xs space-y-1 list-disc list-inside">
              <li>All account data deleted permanently</li>
              <li>Sozu tag freed — anyone can claim it</li>
              <li>Wallet &amp; balance records removed</li>
            </ul>

            {/* Error feedback */}
            {deleteError && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-500/50 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">{deleteError}</AlertDescription>
              </Alert>
            )}

            {/* Passkey CTA */}
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="w-full flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/30 hover:bg-red-950/60 active:scale-[0.98] transition-all px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Thumbnail / icon */}
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
