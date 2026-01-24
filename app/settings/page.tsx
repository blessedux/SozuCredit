"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Settings, Trash2, AlertTriangle, Loader2 } from "lucide-react"
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
      <div className="max-w-2xl mx-auto px-4 py-8">
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
