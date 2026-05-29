"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { signalAppReady } from "@/lib/app-ready"

/**
 * Signals app-ready on routes that don't mount MobileAppShell (/home waits for the shell).
 */
export function AppReadyFallback() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/home") return

    const timer = window.setTimeout(signalAppReady, 80)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return null
}
