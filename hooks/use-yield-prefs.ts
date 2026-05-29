"use client"

import { useState, useEffect, useCallback } from "react"
import {
  loadYieldPrefs,
  saveYieldPrefs,
  type YieldPrefs,
} from "@/lib/yield/prefs-storage"

/**
 * Hook that exposes yield preferences with localStorage persistence.
 *
 * Usage:
 *   const { prefs, setStrategy, setAutoEarn } = useYieldPrefs()
 */
export function useYieldPrefs() {
  const [prefs, setPrefs] = useState<YieldPrefs>(() => ({
    strategy: "fixed",
    autoEarn: false,
  }))
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setPrefs(loadYieldPrefs())
    setLoaded(true)
  }, [])

  const update = useCallback((patch: Partial<YieldPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveYieldPrefs(next)
      return next
    })
  }, [])

  const setStrategy = useCallback(
    (strategy: YieldPrefs["strategy"]) => update({ strategy }),
    [update]
  )

  const setAutoEarn = useCallback(
    (autoEarn: boolean) => update({ autoEarn }),
    [update]
  )

  return { prefs, setStrategy, setAutoEarn, loaded }
}
