"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Loader2, Fingerprint } from "lucide-react"
import { useWalletLanguage } from "@/lib/wallet-language"

export interface TagInputModalProps {
  isOpen: boolean
  onClose: () => void
  /** Reserved name → create account (passkey registration). */
  onRegister: (tag: string) => void
  /** Taken name → passkey authentication. */
  onLoginPasskey: (tag: string) => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>
  /** After passkey cancel: reopen on sign-in step with this tag. */
  resumeWithTag?: string | null
  /** After register cancel: reopen name step with this tag. */
  prefillTag?: string | null
}

type AvailabilityStatus = "idle" | "checking" | "available" | "taken" | "error"

type Step = "tag" | "signin"

export function TagInputModal({
  isOpen,
  onClose,
  onRegister,
  onLoginPasskey,
  resumeWithTag,
  prefillTag,
}: TagInputModalProps) {
  const { t, language } = useWalletLanguage()
  const [step, setStep] = useState<Step>("tag")
  const [tag, setTag] = useState("")
  const [error, setError] = useState("")
  const [learnOpen, setLearnOpen] = useState(false)
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("idle")
  const [availabilityMessage, setAvailabilityMessage] = useState("")
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  const validateTag = (value: string): boolean => {
    if (value.length < 3 || value.length > 30) {
      setError(t.authTagLengthError)
      setAvailabilityStatus("idle")
      return false
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setError(t.authTagCharsError)
      setAvailabilityStatus("idle")
      return false
    }
    setError("")
    return true
  }

  const checkUsernameAvailability = useCallback(async (username: string) => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, lang: language }),
      })
      const data = await response.json()

      if (data.available) {
        setAvailabilityStatus("available")
        setAvailabilityMessage(typeof data.message === "string" ? data.message : t.authUsernameFree)
      } else {
        setAvailabilityStatus("taken")
        setAvailabilityMessage(typeof data.message === "string" ? data.message : "")
      }
    } catch {
      setAvailabilityStatus("error")
      setAvailabilityMessage(t.authCouldNotCheck)
    }
  }, [language, t.authCouldNotCheck, t.authUsernameFree])

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    const trimmedTag = tag.trim()
    if (!trimmedTag) {
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      return
    }

    const isValidFormat =
      trimmedTag.length >= 3 && trimmedTag.length <= 30 && /^[a-zA-Z0-9_]+$/.test(trimmedTag)

    if (!isValidFormat) {
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      void checkUsernameAvailability(trimmedTag)
    }, 400)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [tag, checkUsernameAvailability])

  useEffect(() => {
    if (!isOpen) {
      setTag("")
      setError("")
      setLearnOpen(false)
      setAvailabilityStatus("idle")
      setAvailabilityMessage("")
      setPasskeyBusy(false)
      setStep("tag")
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      return
    }
    if (resumeWithTag) {
      const resumeTag = resumeWithTag.replace(/^\$/, "").trim()
      setTag(resumeTag)
      setStep("signin")
      setError("")
      void checkUsernameAvailability(resumeTag)
    } else if (prefillTag) {
      const prefill = prefillTag.replace(/^\$/, "").trim()
      setTag(prefill)
      setStep("tag")
      setError("")
      void checkUsernameAvailability(prefill)
    }
  }, [isOpen, resumeWithTag, prefillTag, checkUsernameAvailability])

  const trimmed = tag.trim()
  const isTagValid =
    trimmed.length >= 3 && trimmed.length <= 30 && /^[a-zA-Z0-9_]+$/.test(trimmed) && !error

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "")
    setTag(value)
    if (error && value.trim().length >= 3) setError("")
  }

  const handlePrimaryTagStep = () => {
    if (!validateTag(trimmed)) return
    if (availabilityStatus === "available") {
      onRegister(trimmed)
      return
    }
    if (availabilityStatus === "taken") {
      setStep("signin")
      setError("")
    }
  }

  const handlePasskey = async () => {
    if (!validateTag(trimmed)) return
    setPasskeyBusy(true)
    setError("")
    try {
      const result = await onLoginPasskey(trimmed)
      if (!result.ok) {
        if (result.cancelled) {
          setError("")
          setStep("signin")
        } else {
          setError(result.error || t.authCouldNotSignIn)
        }
      }
    } finally {
      setPasskeyBusy(false)
    }
  }

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handlePrimaryTagStep()
    }
  }

  const canProceedTag =
    isTagValid && (availabilityStatus === "available" || availabilityStatus === "taken")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-black/95 border-white/10 text-white max-w-sm shadow-none"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">
          {step === "tag" ? t.authChooseName : t.authSignIn}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {step === "tag" ? t.authRegisterOnInternet : trimmed}
        </DialogDescription>
        {step === "tag" ? (
          <div className="space-y-8 pt-1 pb-2">
            <div className="space-y-1 text-center">
              <p className="text-[15px] font-light tracking-wide text-white/90">{t.authChooseName}</p>
              <p className="text-[13px] font-extralight tracking-wide text-white/55">{t.authRegisterOnInternet}</p>
              <button
                type="button"
                onClick={() => setLearnOpen((v) => !v)}
                className="mt-2 text-[10px] tracking-[0.2em] uppercase text-white/35 hover:text-white/50 transition-colors"
              >
                {t.authLearnMore}
              </button>
              {learnOpen && (
                <p className="text-left text-[11px] leading-relaxed text-white/45 pt-2 px-1 border-t border-white/5 mt-3">
                  {t.authLearnMoreBody}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Input
                type="text"
                value={tag}
                onChange={handleChange}
                onKeyDown={handleKeyDownTag}
                placeholder={t.authTagPlaceholder}
                className={`h-11 bg-transparent border-0 border-b rounded-none text-center text-lg font-light tracking-[0.15em] text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:border-b-white/40 px-0 ${
                  availabilityStatus === "available"
                    ? "border-b-emerald-500/40"
                    : availabilityStatus === "taken"
                      ? "border-b-white/25"
                      : "border-b-white/15"
                }`}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
              />
              <div className="min-h-[1.25rem] flex items-center justify-center gap-2">
                {trimmed.length >= 3 && isTagValid && availabilityStatus === "checking" && (
                  <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
                )}
                {trimmed.length >= 3 && isTagValid && availabilityStatus === "available" && (
                  <Check className="w-3.5 h-3.5 text-emerald-600/80" aria-hidden />
                )}
                {availabilityMessage && (
                  <p
                    className={`text-[11px] font-light ${
                      availabilityStatus === "available"
                        ? "text-emerald-600/70"
                        : availabilityStatus === "taken"
                          ? "text-white/40"
                          : availabilityStatus === "error"
                            ? "text-amber-500/80"
                            : "text-white/30"
                    }`}
                  >
                    {availabilityMessage}
                  </p>
                )}
              </div>
              {error && <p className="text-center text-[11px] text-amber-500/90">{error}</p>}
            </div>

            <Button
              type="button"
              onClick={handlePrimaryTagStep}
              disabled={!canProceedTag}
              className="w-full h-11 rounded-full bg-white/95 text-black text-sm font-normal tracking-widest hover:bg-white disabled:opacity-30"
            >
              {availabilityStatus === "taken" ? t.authSignIn : t.authRegister}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 pt-1 pb-2">
            <div className="text-center space-y-1">
              <p className="text-[11px] tracking-[0.25em] uppercase text-white/35">{t.authSignIn}</p>
              <p className="text-base font-light text-white/90 tracking-wide">{trimmed}</p>
              <p className="text-[10px] text-white/35 pt-1">{t.authPasskeyCaption}</p>
            </div>

            {error && <p className="text-center text-[11px] text-amber-500/90">{error}</p>}

            <Button
              type="button"
              onClick={() => void handlePasskey()}
              disabled={passkeyBusy}
              className="w-full h-11 rounded-full bg-white/95 text-black text-sm font-normal tracking-widest hover:bg-white disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {passkeyBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="w-4 h-4 opacity-70" />
                  {t.authPasskey}
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep("tag")
                setError("")
              }}
              className="w-full text-[10px] tracking-[0.2em] uppercase text-white/30 hover:text-white/45 pt-2"
            >
              {t.authBack}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
