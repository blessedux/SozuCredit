"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()

  const checkAuth = useCallback(() => {
    // Check if we're authenticated via sessionStorage (for dev mode without Supabase)
    if (typeof window !== "undefined") {
      const isAuthenticated = sessionStorage.getItem("dev_authenticated") === "true"
      
      if (!isAuthenticated) {
        console.log("[AuthGuard] Not authenticated, redirecting to /auth")
        router.push("/auth")
      }
    }
  }, [router])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // In dev mode, show children immediately (server will allow access)
  // Client-side check ensures redirect happens if not authenticated
  return <>{children}</>
}

