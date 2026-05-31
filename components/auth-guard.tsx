"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticatedClient } from "@/lib/client-wallet-session"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()

  const checkAuth = useCallback(() => {
    if (typeof window === "undefined") return

    const userId =
      localStorage.getItem("dev_username") ?? sessionStorage.getItem("dev_username")

    if (!isAuthenticatedClient() || !userId) {
      console.log("[AuthGuard] Not authenticated, redirecting to /auth")
      router.push("/auth")
    }
  }, [router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // In dev mode, show children immediately (server will allow access)
  // Client-side check ensures redirect happens if not authenticated
  return <>{children}</>
}

