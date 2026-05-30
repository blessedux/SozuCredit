"use client"

import { useEffect } from "react"
import { installAppViewportHeightSync } from "@/lib/sync-app-viewport-height"

/** Keeps --sozu-app-height aligned with the visible viewport on mobile PWAs. */
export function ViewportHeightSync() {
  useEffect(() => installAppViewportHeightSync(), [])
  return null
}
