"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, X, Loader2 } from "lucide-react"

interface TagInputModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (tag: string) => void
}

type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error"

export function TagInputModal({ isOpen, onClose, onConfirm }: TagInputModalProps) {
  const [tag, setTag] = useState("")
  const [error, setError] = useState("")
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle")
  const [availabilityMessage, setAvailabilityMessage] = useState("")
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const validateTag = (value: string): boolean => {
    // Tag must be 3-30 characters, letters, numbers, and underscores only
    if (value.length < 3 || value.length > 30) {
      setError("Tag must be between 3 and 30 characters")
      setAvailabilityStatus("idle")
      return false
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setError("Tag can only contain letters, numbers, and underscores")
      setAvailabilityStatus("idle")
      return false
    }
    setError("")
    return true
  }

  const checkUsernameAvailability = async (username: string) => {
    if (!username || username.length < 3) {
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      return
    }

    setAvailabilityStatus("checking")
    setAvailabilityMessage("")

    try {
      const response = await fetch("/api/auth/username/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      })

      const data = await response.json()

      if (data.available) {
        setAvailabilityStatus("available")
        setAvailabilityMessage(data.message || "This tag is available")
      } else {
        setAvailabilityStatus("taken")
        setAvailabilityMessage(data.message || "This tag is already taken")
      }
    } catch (error) {
      console.error("[TagInputModal] Error checking username availability:", error)
      setAvailabilityStatus("error")
      setAvailabilityMessage("Unable to check availability. Please try again.")
    }
  }

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const trimmedTag = tag.trim()

    // Reset availability status when tag is empty
    if (!trimmedTag) {
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      return
    }

    // Only check availability if basic validation passes
    const isValidFormat = trimmedTag.length >= 3 && 
                          trimmedTag.length <= 30 && 
                          /^[a-zA-Z0-9_]+$/.test(trimmedTag)

    if (!isValidFormat) {
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      return
    }

    // Debounce the API call
    debounceTimerRef.current = setTimeout(() => {
      checkUsernameAvailability(trimmedTag)
    }, 400) // 400ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [tag])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTag("")
      setError("")
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [isOpen])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTag(value)
    // Clear format errors if basic validation passes
    if (error) {
      const trimmed = value.trim()
      if (trimmed.length >= 3 && trimmed.length <= 30 && /^[a-zA-Z0-9_]+$/.test(trimmed)) {
        setError("")
      }
    }
  }

  const handleConfirm = () => {
    const trimmedTag = tag.trim()
    if (validateTag(trimmedTag) && availabilityStatus === "available") {
      onConfirm(trimmedTag)
      setTag("")
      setError("")
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleConfirm()
    }
  }

  const isTagValid = tag.trim().length >= 3 && 
                     tag.trim().length <= 30 && 
                     /^[a-zA-Z0-9_]+$/.test(tag.trim()) &&
                     !error

  const canSubmit = isTagValid && availabilityStatus === "available"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="bg-black/95 border-white/20 text-white max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
      >
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-2xl font-bold text-center text-white">
            Choose Your Sozu Tag
          </DialogTitle>
          <DialogDescription className="text-white/80 text-center">
            Your tag will be used as your username and to identify your passkey.
            Choose something memorable and unique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="tag" className="text-white/80">
              Sozu Tag
            </Label>
            <div className="relative">
              <Input
                id="tag"
                type="text"
                value={tag}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="e.g., alice, bob123, trader_01"
                className={`bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-white/40 pr-10 ${
                  availabilityStatus === "available" ? "border-green-500/50" : 
                  availabilityStatus === "taken" ? "border-red-500/50" : ""
                }`}
                autoFocus
              />
              {tag.trim() && isTagValid && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {availabilityStatus === "checking" && (
                    <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                  )}
                  {availabilityStatus === "available" && (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                  {availabilityStatus === "taken" && (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                  {availabilityStatus === "error" && (
                    <X className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            {availabilityMessage && !error && (
              <p className={`text-sm ${
                availabilityStatus === "available" ? "text-green-400" :
                availabilityStatus === "taken" ? "text-red-400" :
                availabilityStatus === "error" ? "text-yellow-400" :
                "text-white/60"
              }`}>
                {availabilityMessage}
              </p>
            )}
            {!error && !availabilityMessage && (
              <p className="text-xs text-white/60">
                3-30 characters, letters, numbers, and underscores only
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleConfirm}
              disabled={!tag.trim() || !!error || availabilityStatus !== "available"}
              className="flex-1 bg-white text-black hover:bg-white/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
