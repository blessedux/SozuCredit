"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SozuTagCard } from "@/components/settings/sozu-tag-card"
import { AccountSettingsContent } from "@/components/settings/account-settings-content"
import {
  Loader2,
  Mail,
  ExternalLink,
  Coins,
  Languages,
} from "lucide-react"
import { loadTreasuryPrefs, saveTreasuryPrefs } from "@/lib/treasury/prefs-storage"
import type { TreasuryPrefs } from "@/lib/treasury/types"
import { REFERENCE_FIAT_OPTIONS } from "@/lib/treasury/types"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

  const [settingsView, setSettingsView] = useState<"main" | "profile_settings">("main")
  const [username, setUsername] = useState<string>("")

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

  // Reference fiat only (treasury mode / yield strategy are out of demo settings)
  const [treasuryPrefs, setTreasuryPrefs] = useState<TreasuryPrefs>(() => loadTreasuryPrefs())

  useEffect(() => {
    // Read from localStorage (persistent) with sessionStorage fallback
    const storedUsername =
      localStorage.getItem("dev_username") ?? sessionStorage.getItem("dev_username")
    if (storedUsername) {
      setUsername(storedUsername)
    } else {
      // No username means not logged in - redirect to auth
      router.push("/auth")
    }
  }, [router])

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

  if (settingsView === "profile_settings") {
    return (
      <div className="min-h-screen bg-transparent text-white">
        <AccountSettingsContent onBack={() => setSettingsView("main")} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-white">
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <SozuTagCard onOpenAccountSettings={() => setSettingsView("profile_settings")} />

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

        <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Coins className="w-5 h-5" />
              {t.currency}
            </CardTitle>
            <CardDescription className="text-white/60">
              {t.referenceFiatNote} USDC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-white/80 text-sm">{t.currency}</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {REFERENCE_FIAT_OPTIONS.map((fiat) => (
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
      </div>
    </div>
  )
}
