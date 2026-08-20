"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadClientWalletSession } from "@/lib/client-wallet-session"
import { pizzaBalanceToShow } from "@/lib/stellar/pizza-token"
import { clearPizzaHopReturn } from "@/lib/pizza/hop-return-storage"
import {
  appendPizzaHopParams,
  type PizzaAuthContinuation,
} from "@/lib/pizza/pay-return"
import { waitForGuestWalletAddress } from "@/lib/pizza/wait-for-guest-wallet"
import { signPizzaRedeemIntent } from "@/lib/pizza/sign-redeem"
import { useWalletLanguage } from "@/lib/wallet-language"

function isWalletProvisioning(): boolean {
  try {
    return sessionStorage.getItem("wallet_sync_pending") === "1"
  } catch {
    return false
  }
}

export function PizzaAuthContinuation({
  continuation,
}: {
  continuation: Extract<PizzaAuthContinuation, { kind: "hop" | "intent" }>
}) {
  const { t } = useWalletLanguage()
  const [status, setStatus] = useState(t.pizzaAuthPreparing)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const run = useCallback(async () => {
    setError(null)
    setStatus(t.pizzaAuthPreparing)

    const guest = await waitForGuestWalletAddress({
      readPublicKey: async () => {
        const session = await loadClientWalletSession()
        return session.publicKey
      },
      isProvisioning: isWalletProvisioning,
      provision: async () => {
        const session = await loadClientWalletSession()
        const userId = session.userId
        const credentialId = session.credentialId
        if (!userId || !credentialId) return null
        const { alignWalletMaterialAfterLogin } = await import("@/lib/storage/post-login-wallet")
        const { publicKey, needsWalletSync } = await alignWalletMaterialAfterLogin(
          userId,
          credentialId,
        )
        return needsWalletSync ? null : publicKey
      },
    })

    if (!guest) {
      setError(t.pizzaAuthMissingWallet)
      return
    }

    if (continuation.kind === "hop") {
      setStatus(t.pizzaAuthWorking)
      const session = await loadClientWalletSession()
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
      clearPizzaHopReturn()
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
    clearPizzaHopReturn()
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
