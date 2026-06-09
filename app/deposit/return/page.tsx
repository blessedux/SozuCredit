"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import type { DepositIntentPublic } from "@/lib/deposits/types"
import { getUserId } from "@/lib/wallet-utils"

function DepositReturnContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const intentId = searchParams.get("intent")?.trim() ?? ""
  const [deposit, setDeposit] = useState<DepositIntentPublic | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!intentId) {
      setError("Missing deposit reference")
      return
    }

    const load = async () => {
      const userId = getUserId()
      try {
        const res = await fetch(`/api/deposits/${intentId}`, {
          headers: userId ? { "x-user-id": userId } : {},
          credentials: "include",
        })
        const data = await res.json().catch(() => ({})) as { deposit?: DepositIntentPublic; error?: string }
        if (!res.ok) {
          setError(data.error ?? "Could not load deposit status")
          return
        }
        setDeposit(data.deposit ?? null)
      } catch {
        setError("Network error")
      }
    }

    void load()
    const interval = setInterval(() => void load(), 3000)
    return () => clearInterval(interval)
  }, [intentId])

  useEffect(() => {
    if (!deposit) return
    const done = ["completed", "payment_received", "pending_admin_review", "approved", "usdc_released"].includes(
      deposit.status,
    )
    if (done) {
      const t = setTimeout(() => router.replace("/"), 4000)
      return () => clearTimeout(t)
    }
  }, [deposit, router])

  if (error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <p className="text-sm text-rose-300/90">{error}</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="text-xs text-white/50 underline"
        >
          Back to wallet
        </button>
      </main>
    )
  }

  if (!deposit) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <p className="text-[10px] uppercase tracking-wider text-white/40">Card deposit</p>
      <p className="text-lg font-medium">
        {Number(deposit.amount_clp).toLocaleString("es-CL")} CLP → {deposit.usdc_amount} USDC
      </p>
      <p className="text-sm text-white/60">Status: {deposit.status.replace(/_/g, " ")}</p>
      <p className="text-xs text-white/35">Returning to your wallet…</p>
    </main>
  )
}

export default function DepositReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center text-white">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </main>
      }
    >
      <DepositReturnContent />
    </Suspense>
  )
}
