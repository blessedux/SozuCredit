"use client"

import { useEffect } from "react"
import { isStandalonePwa } from "@/lib/sync-app-viewport-height"

/** Lock html/body to the synced app viewport (used on full-screen shell routes). */
export function useAppViewportLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    // iOS standalone: position:fixed on html/body (app-no-scroll) shrinks innerHeight ~47px
    // and creates the bottom black strip. Shell panels handle their own overflow.
    if (isStandalonePwa()) return

    document.documentElement.classList.add("app-no-scroll")
    document.body.classList.add("app-no-scroll")
    return () => {
      document.documentElement.classList.remove("app-no-scroll")
      document.body.classList.remove("app-no-scroll")
    }
  }, [enabled])
}
