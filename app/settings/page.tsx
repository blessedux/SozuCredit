"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Settings, Trash2, AlertTriangle, Loader2, Mail, ExternalLink } from "lucide-react"
import { ledgerUserHeaders } from "@/lib/ledger/client-headers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  const router = useRouter()
  const [username, setUsername] = useState<string>("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
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
    // Check if they typed the Sozu tag with or without $ prefix
    const expectedTag = `$${username}`
    const expectedTagWithoutPrefix = username

    if (deleteConfirmation !== expectedTag && deleteConfirmation !== expectedTagWithoutPrefix) {
      setDeleteError("Confirmation does not match your Sozu tag")
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account")
      }

      // Clear session storage
      sessionStorage.clear()

      // Redirect to auth page
      router.push("/auth")
    } catch (error) {
      console.error("[Settings] Error deleting account:", error)
      setDeleteError(error instanceof Error ? error.message : "Failed to delete account")
      setIsDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/20 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-white" />
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
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

        <Card className="border-white/20 bg-white/[0.03]">
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

        {/* Danger Zone */}
        <Card className="border-red-500/50 bg-red-950/10">
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
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-black border-red-500/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-white/60">
              This action cannot be undone. This will permanently delete your account and free up your Sozu tag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive" className="bg-red-950/50 border-red-500/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You are about to permanently delete your account. All your data will be lost and your Sozu tag will be freed.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirmation" className="text-white">
                Type your Sozu tag <span className="font-mono text-red-400">${username}</span> to confirm:
              </Label>
              <Input
                id="confirmation"
                type="text"
                value={deleteConfirmation}
                onChange={(e) => {
                  setDeleteConfirmation(e.target.value)
                  setDeleteError(null)
                }}
                placeholder={`Type $${username} to confirm`}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                disabled={isDeleting}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setDeleteConfirmation("")
                setDeleteError(null)
              }}
              disabled={isDeleting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting || (deleteConfirmation !== `$${username}` && deleteConfirmation !== username)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
