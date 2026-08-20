"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { pizzaCheckoutPathFromPayReturn } from "@/lib/pizza/checkout-path"
import { clearPizzaHopReturn } from "@/lib/pizza/hop-return-storage"
import { type PizzaAuthContinuation } from "@/lib/pizza/pay-return"
import { useWalletLanguage } from "@/lib/wallet-language"

export function PizzaAuthContinuation({
  continuation,
}: {
  continuation: Extract<PizzaAuthContinuation, { kind: "hop" | "intent" }>
}) {
  const router = useRouter()
  const { t } = useWalletLanguage()
  const [status, setStatus] = useState(t.pizzaAuthPreparing)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const run = useCallback(() => {
    setError(null)
    setStatus(t.pizzaAuthPreparing)

    const checkoutPath = continuation.returnTo
      ? pizzaCheckoutPathFromPayReturn(continuation.returnTo)
      : null
    if (checkoutPath) {
      clearPizzaHopReturn()
      router.replace(checkoutPath)
      return
    }

    setError(t.pizzaAuthMissingWallet)
  }, [continuation, router, t])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    run()
  }, [run])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black px-6 text-center">
      <p className="text-sm text-white/80">{error ?? status}</p>
      {error ? (
        <button
          type="button"
          onClick={() => {
            startedRef.current = false
            run()
          }}
          className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          {t.pizzaAuthRetry}
        </button>
      ) : null}
    </div>
  )
}
