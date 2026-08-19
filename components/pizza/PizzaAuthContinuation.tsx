"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadClientWalletSession } from "@/lib/client-wallet-session"
import { pizzaBalanceToShow } from "@/lib/stellar/pizza-token"
import {
  appendPizzaHopParams,
  type PizzaAuthContinuation,
} from "@/lib/pizza/pay-return"
import { signPizzaRedeemIntent } from "@/lib/pizza/sign-redeem"
import { useWalletLanguage } from "@/lib/wallet-language"

export function PizzaAuthContinuation({
  continuation,
}: {
  continuation: Extract<PizzaAuthContinuation, { kind: "hop" | "intent" }>
}) {
  const { t } = useWalletLanguage()
  const [status, setStatus] = useState(t.pizzaAuthWorking)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const run = useCallback(async () => {
    setError(null)
    setStatus(t.pizzaAuthWorking)
    const session = await loadClientWalletSession()
    const guest = session.publicKey?.trim().toUpperCase() ?? ""
    if (!guest || !/^[GC][A-Z0-9]{55}$/.test(guest)) {
      setError(t.pizzaAuthMissingWallet)
      return
    }

    if (continuation.kind === "hop") {
      const userId = session.userId
      const qs = `?publicKey=${encodeURIComponent(guest)}`
      const res = await fetch(`/api/wallet/stellar/balance${qs}`, {
        headers: userId ? { "x-user-id": userId } : undefined,
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        tokenBalances?: Array<{ assetId?: string; symbol?: string; balance: number }>
      }
      const pizza = pizzaBalanceToShow(data.tokenBalances)
      window.location.replace(appendPizzaHopParams(continuation.returnTo, guest, pizza))
      return
    }

    setStatus(t.pizzaAuthSigning)
    const result = await signPizzaRedeemIntent({
      intentId: continuation.intentId,
      guestAddress: guest,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (continuation.returnTo) {
      window.location.replace(continuation.returnTo)
      return
    }
    setStatus(t.pizzaAuthDone)
  }, [continuation, t])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void run()
  }, [run])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black px-6 text-center">
      <p className="text-sm text-white/80">{error ?? status}</p>
      {error ? (
        <button
          type="button"
          onClick={() => {
            startedRef.current = false
            void run()
          }}
          className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          {t.pizzaAuthRetry}
        </button>
      ) : null}
    </div>
  )
}
