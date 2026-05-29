/**
 * useTreasuryProjection
 *
 * Fetches a treasury purchasing power projection from the API and keeps
 * it in sync when balance or preferences change.
 *
 * Also listens for localStorage changes so the Settings panel can update
 * prefs and the wallet screen reflects them without a full reload.
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { TreasuryProjection, TreasuryPrefs } from "@/lib/treasury/types"
import { loadTreasuryPrefs, saveTreasuryPrefs } from "@/lib/treasury/prefs-storage"
import { getUserId } from "@/lib/wallet-utils"
import { deferNonCritical } from "@/lib/defer-non-critical"

interface UseTreasuryProjectionResult {
  projection: TreasuryProjection | null
  loading: boolean
  error: string | null
  prefs: TreasuryPrefs
  updatePrefs: (next: Partial<TreasuryPrefs>) => void
  refresh: () => void
}

export function useTreasuryProjection(balanceUsdc: number): UseTreasuryProjectionResult {
  const [prefs, setPrefs] = useState<TreasuryPrefs>(() => loadTreasuryPrefs())
  const [projection, setProjection] = useState<TreasuryProjection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchProjection = useCallback(
    async (currentBalance: number, currentPrefs: TreasuryPrefs) => {
      if (currentBalance <= 0) {
        setProjection(null)
        setLoading(false)
        setError(null)
        return
      }

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      setLoading(true)
      setError(null)

      try {
        const userId = getUserId()
        const params = new URLSearchParams({
          balance: currentBalance.toString(),
          referenceFiat: currentPrefs.referenceFiat,
          mode: currentPrefs.mode,
          holdingDays: currentPrefs.holdingDays.toString(),
        })

        const res = await fetch(`/api/wallet/treasury/projection?${params}`, {
          cache: "no-store",
          signal: ctrl.signal,
          headers: userId ? { "x-user-id": userId } : undefined,
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
        }

        const json = (await res.json()) as { success: boolean; projection: TreasuryProjection }
        if (json.success && json.projection && json.projection.protocolApy > 0) {
          setProjection(json.projection)
        } else {
          setProjection(null)
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Unknown error")
        setProjection(null)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Re-fetch whenever balance or prefs change (defer first paint on landing)
  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      void fetchProjection(balanceUsdc, prefs)
    }

    deferNonCritical(run)
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [balanceUsdc, prefs, fetchProjection])

  // React to preference changes coming from the Settings panel (same tab)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== "sozu_treasury_prefs:v1" || !e.newValue) return
      try {
        const next = JSON.parse(e.newValue) as TreasuryPrefs
        setPrefs(next)
      } catch {
        // malformed value — ignore
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const updatePrefs = useCallback((next: Partial<TreasuryPrefs>) => {
    setPrefs((prev) => {
      const updated = { ...prev, ...next }
      saveTreasuryPrefs(updated)
      return updated
    })
  }, [])

  const refresh = useCallback(() => {
    void fetchProjection(balanceUsdc, prefs)
  }, [balanceUsdc, prefs, fetchProjection])

  return { projection, loading, error, prefs, updatePrefs, refresh }
}
