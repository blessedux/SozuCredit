"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Check, ChevronRight, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { getUserId } from "@/lib/wallet-utils"

type SozuTagCardProps = {
  onOpenAccountSettings?: () => void
}

export function SozuTagCard({ onOpenAccountSettings }: SozuTagCardProps) {
  const [currentTag, setCurrentTag] = useState("")
  const [tag, setTag] = useState("")
  const [tagStatus, setTagStatus] = useState<"idle" | "checking" | "available" | "taken" | "error" | "own">("idle")
  const [tagMessage, setTagMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // dev_username_display / sozu_username hold the tag string.
    // dev_username holds the UUID — never use it for display.
    const stored =
      sessionStorage.getItem("dev_username_display") ??
      localStorage.getItem("sozu_username") ??
      ""
    setCurrentTag(stored)
    setTag(stored)
    if (stored) {
      setTagStatus("own")
      setTagMessage("This is your current tag")
    }
  }, [])

  const checkAvailability = useCallback(async (value: string) => {
    if (value === currentTag) {
      setTagStatus("own")
      setTagMessage("This is your current tag")
      return
    }
    if (value.length < 3) { setTagStatus("idle"); setTagMessage(""); return }
    setTagStatus("checking")
    try {
      const res = await fetch("/api/auth/username/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      })
      const data = await res.json()
      if (data.available) {
        setTagStatus("available"); setTagMessage("Tag is available")
      } else {
        setTagStatus("taken"); setTagMessage("Tag is already taken")
      }
    } catch {
      setTagStatus("error"); setTagMessage("Unable to check availability")
    }
  }, [currentTag])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "")
    setTag(value)
    setSaveError("")
    setSaved(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length >= 3) {
      debounceRef.current = setTimeout(() => checkAvailability(value), 400)
    } else {
      setTagStatus("idle"); setTagMessage("")
    }
  }, [checkAvailability])

  const handleSave = useCallback(async () => {
    if (tagStatus !== "available" || tag === currentTag) return
    setIsSaving(true)
    setSaveError("")
    try {
      const userId = getUserId()
      const res = await fetch("/api/wallet/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(userId ? { "x-user-id": userId } : {}),
        },
        body: JSON.stringify({ username: tag }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error || "Failed to update tag")
      } else {
        sessionStorage.setItem("dev_username_display", tag)
        localStorage.setItem("sozu_username", tag)
        setCurrentTag(tag)
        setTagStatus("own")
        setTagMessage("This is your current tag")
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setSaveError("Network error. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }, [tag, tagStatus, currentTag])

  const borderColor =
    tagStatus === "available" ? "border-green-500/60" :
    tagStatus === "taken"     ? "border-red-500/60" :
    tagStatus === "error"     ? "border-yellow-500/60" :
    "border-white/20"

  const messageColor =
    tagStatus === "available" ? "text-green-400" :
    tagStatus === "taken"     ? "text-red-400" :
    tagStatus === "error"     ? "text-yellow-400" :
    "text-white/45"

  const canSave = tagStatus === "available" && tag !== currentTag && tag.length >= 3

  return (
    <Card className="border-white/15 bg-black/55 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          Account
          {saved && <span className="text-[10px] font-normal text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> Saved</span>}
        </CardTitle>
        {onOpenAccountSettings ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenAccountSettings}
            className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
          >
            Settings
            <ChevronRight className="ml-0.5 h-4 w-4" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 select-none font-mono text-sm text-white/60">
            $
          </span>
          <Input
            value={tag}
            onChange={handleChange}
            maxLength={30}
            placeholder="yourname"
            className={`pl-7 bg-white/[0.05] text-white border ${borderColor} focus:border-white/40 placeholder:text-white/25`}
          />
          {tagStatus === "checking" && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-white/40" />
          )}
        </div>

        {tagMessage && (
          <p className={`text-xs ${messageColor}`}>{tagMessage}</p>
        )}
        {saveError && (
          <p className="text-xs text-red-400">{saveError}</p>
        )}

        <Button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="w-full bg-white text-black hover:bg-white/90 disabled:opacity-30"
          size="sm"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save tag"}
        </Button>

        <p className="text-[10px] text-white/35">
          Letters, numbers and underscore — 3 to 30 characters.
        </p>
      </CardContent>
    </Card>
  )
}
