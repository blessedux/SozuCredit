"use client"

import { useCallback } from "react"
import { iosHapticSingle } from "@/lib/haptics/ios-switch-pulse"

/**
 * Light tap haptic for ledger UI. Call from `onClick` (not async timers) so iOS keeps user activation.
 */
export function useAppHaptics() {
  const play = useCallback(() => {
    if (typeof window === "undefined") return
    iosHapticSingle()
  }, [])

  return { play }
}
