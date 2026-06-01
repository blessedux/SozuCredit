"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { signalBootstrapReady, signalAppReady } from "@/lib/app-ready"

/** Routes without AppBootstrapGate / MobileAppShell still dismiss the preloader. */
const BOOTSTRAP_HANDLED_PREFIXES = ["/home", "/wallet"]

export function AppReadyFallback() {
  const pathname = usePathname()

  useEffect(() => {
    if (BOOTSTRAP_HANDLED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return
    }

    const timer = window.setTimeout(() => {
      signalBootstrapReady()
      signalAppReady()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return null
}
