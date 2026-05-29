"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { signalShellReady, signalAppReady } from "@/lib/app-ready"

/**
 * Signals shell-ready on routes that don't mount MobileAppShell.
 * /home dismisses the preloader via MobileAppShell's mount effect instead.
 */
export function AppReadyFallback() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/home") return

    const timer = window.setTimeout(() => {
      signalShellReady()
      signalAppReady()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return null
}
