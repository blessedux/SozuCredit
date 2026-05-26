"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, X } from "lucide-react"

type DepositModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [address, setAddress] = useState<string>("")
  const [sozuTag, setSozuTag] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (typeof window !== "undefined") {
        setAddress(sessionStorage.getItem("stellar_public_key") ?? "")
        setSozuTag(
          sessionStorage.getItem("dev_username_display") ??
          localStorage.getItem("sozu_username") ??
          ""
        )
      }
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  const handleCopy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close deposit modal"
        className="absolute right-5 top-[max(1.25rem,env(safe-area-inset-top))] flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/40 transition hover:bg-white/15 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="text-[9px] font-light uppercase tracking-[0.3em] text-white/35">
        Deposit
      </p>

      {/* Sozu tag */}
      {sozuTag && (
        <p
          className="text-base font-light tracking-widest text-white/80"
          style={{
            transform: visible ? "translateY(0)" : "translateY(8px)",
            transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          @{sozuTag}
        </p>
      )}

      {/* QR code — no card, no background */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {address ? (
          <QRCodeSVG
            value={address}
            size={220}
            bgColor="transparent"
            fgColor="rgba(255,255,255,0.92)"
            level="M"
          />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-2xl bg-white/10" />
        )}
      </div>

      {/* Address + copy */}
      <button
        onClick={e => { e.stopPropagation(); handleCopy() }}
        className="group flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 transition hover:bg-white/[0.08]"
        style={{
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1) 0.05s",
        }}
      >
        <span className="max-w-[220px] truncate font-mono text-[10px] text-white/50">
          {address || "No wallet connected"}
        </span>
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0 text-white/25 group-hover:text-white/60" />
        )}
      </button>

      <p className="text-[9px] text-white/25">
        Send USDC on Stellar network only
      </p>
    </div>
  )
}
