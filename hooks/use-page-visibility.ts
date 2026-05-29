"use client"

import { useEffect, useState } from "react"

/**
 * Returns true when the page is visible to the user.
 *
 * Listens to:
 * - visibilitychange  (standard; fires on tab switch)
 * - pagehide          (fires on navigation, close, or Android back-gesture)
 * - freeze            (Page Lifecycle API — Chrome fires this when the page is frozen in BFCache)
 *
 * On Android PWAs the standard visibilitychange can be unreliable; the
 * pagehide + freeze combination reliably catches the "backgrounded" case.
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true
    return document.visibilityState === "visible"
  })

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible")
    }

    const onHide = () => setIsVisible(false)
    const onShow = () => {
      if (document.visibilityState === "visible") setIsVisible(true)
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", onHide)
    window.addEventListener("pageshow", onShow)
    // Page Lifecycle API (Chrome 68+) — fires before aggressive throttling
    document.addEventListener("freeze", onHide)
    document.addEventListener("resume", onShow)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", onHide)
      window.removeEventListener("pageshow", onShow)
      document.removeEventListener("freeze", onHide)
      document.removeEventListener("resume", onShow)
    }
  }, [])

  return isVisible
}
