"use client"

import { useEffect } from "react"

/** Lock html/body to the synced app viewport (used on full-screen shell routes). */
export function useAppViewportLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    document.documentElement.classList.add("app-no-scroll")
    document.body.classList.add("app-no-scroll")
    return () => {
      document.documentElement.classList.remove("app-no-scroll")
      document.body.classList.remove("app-no-scroll")
    }
  }, [enabled])
}
