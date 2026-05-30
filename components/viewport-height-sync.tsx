"use client"

import { useEffect } from "react"
import {
  installAppViewportHeightSync,
  isStandalonePwa,
} from "@/lib/sync-app-viewport-height"

/** Keeps --sozu-app-height synced to innerHeight on all routes. */
export function ViewportHeightSync() {
  useEffect(() => {
    const cleanup = installAppViewportHeightSync()
    if (isStandalonePwa()) {
      document.documentElement.classList.add("sozu-standalone")
    }
    return () => {
      cleanup()
      document.documentElement.classList.remove("sozu-standalone")
    }
  }, [])
  return null
}
