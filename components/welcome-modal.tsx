/**
 * Welcome Modal Component
 *
 * Shows a welcome message to first-time visitors before authentication.
 * Copy matches the live USDC Pay + Deposit demo shell.
 */

"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Fingerprint, ShieldCheck, Wallet } from "lucide-react"
import Image from "next/image"
import { useWalletLanguage } from "@/lib/wallet-language"

const WELCOME_MODAL_KEY = "sozu_welcome_seen"

const COPY = {
  es: {
    headline: "Posee y mueve USDC con una passkey.",
    payDeposit: "Paga y deposita USDC desde tu billetera.",
    selfCustody: "Tu dinero está en tu bóveda personal — solo tú tienes las llaves.",
    passkeyTip: "Guarda tu passkey cuando se te solicite al crear la billetera, o desde Configuración.",
    start: "Comenzar",
  },
  en: {
    headline: "Own and move USDC with a passkey.",
    payDeposit: "Pay and deposit USDC from your wallet.",
    selfCustody: "Your money stays in your personal vault — only you hold the keys.",
    passkeyTip: "Save your passkey when prompted after creating a wallet, or from Settings.",
    start: "Get started",
  },
} as const

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false)
  const { language } = useWalletLanguage()
  const copy = COPY[language] ?? COPY.es

  useEffect(() => {
    if (typeof window === "undefined") return
    const hasSeenWelcome = localStorage.getItem(WELCOME_MODAL_KEY) === "true"
    if (hasSeenWelcome) return
    const timer = window.setTimeout(() => setIsOpen(true), 500)
    return () => window.clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    if (typeof window !== "undefined") {
      localStorage.setItem(WELCOME_MODAL_KEY, "true")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="bg-black/95 border-white/20 text-white max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
        onEscapeKeyDown={() => {
          handleClose()
        }}
      >
        <DialogHeader className="space-y-6">
          <div className="flex justify-center">
            <Image
              src="/sozucapital_logo_tb.png"
              alt="Sozu Wallet"
              width={120}
              height={120}
              className="object-contain"
            />
          </div>

          <DialogTitle className="text-3xl font-bold text-center text-white">
            Sozu Wallet
          </DialogTitle>

          <div className="text-center">
            <p className="text-xs text-white/50">v 0.2</p>
          </div>

          <DialogDescription className="text-white/80 text-center space-y-4 pt-4">
            <p className="text-base leading-relaxed">{copy.headline}</p>

            <div className="space-y-3 pt-2 text-left">
              <div className="flex items-start gap-3">
                <Wallet className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-white/70">{copy.payDeposit}</p>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-white/70">{copy.selfCustody}</p>
              </div>

              <div className="flex items-start gap-3">
                <Fingerprint className="w-5 h-5 text-white/60 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-white/70">{copy.passkeyTip}</p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center pt-4">
          <Button
            onClick={handleClose}
            className="bg-white text-black hover:bg-white/90 font-semibold px-8 py-2"
          >
            {copy.start}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
