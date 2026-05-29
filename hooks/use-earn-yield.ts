"use client"

import { useState, useCallback } from "react"
import { useYieldPrefs } from "./use-yield-prefs"

export type EarnStatus = "idle" | "signing" | "submitting" | "success" | "error"

export interface EarnYieldState {
  status: EarnStatus
  transactionHash?: string
  errorMessage?: string
  depositedAmount?: number
  withdrawnAmount?: number
}

/**
 * Hook for in-app DeFindex earn actions (deposit + withdraw).
 *
 * Delegates to the /api/wallet/defindex/deposit and /withdraw API routes
 * which handle signing via the Turnkey/passkey server-side pipeline.
 *
 * Usage:
 *   const { state, deposit, withdraw, reset } = useEarnYield()
 *   await deposit()         // deposit max depositable
 *   await deposit(50)       // deposit $50
 *   await withdraw(20)      // withdraw $20
 */
export function useEarnYield(onSuccess?: () => void) {
  const { prefs } = useYieldPrefs()
  const [state, setState] = useState<EarnYieldState>({ status: "idle" })

  const deposit = useCallback(
    async (amount?: number) => {
      setState({ status: "signing" })
      try {
        setState({ status: "submitting" })
        const res = await fetch("/api/wallet/defindex/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategyId: prefs.strategy,
            ...(amount !== undefined ? { amount } : {}),
          }),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.details ?? data.error ?? "Deposit failed")
        }

        setState({
          status: "success",
          transactionHash: data.transactionHash,
          depositedAmount: data.depositAmount,
        })
        onSuccess?.()
      } catch (err) {
        setState({
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [prefs.strategy, onSuccess]
  )

  const withdraw = useCallback(
    async (amount?: number) => {
      setState({ status: "signing" })
      try {
        setState({ status: "submitting" })
        const res = await fetch("/api/wallet/defindex/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategyId: prefs.strategy,
            ...(amount !== undefined ? { amount } : {}),
          }),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.details ?? data.error ?? "Withdraw failed")
        }

        setState({
          status: "success",
          transactionHash: data.transactionHash,
          withdrawnAmount: data.withdrawAmount,
        })
        onSuccess?.()
      } catch (err) {
        setState({
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [prefs.strategy, onSuccess]
  )

  const reset = useCallback(() => setState({ status: "idle" }), [])

  return { state, deposit, withdraw, reset }
}
