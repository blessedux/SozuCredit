"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()

  useEffect(() => {
    // Check if we're authenticated via sessionStorage (for dev mode without Supabase)
    if (typeof window !== "undefined") {
      const isAuthenticated = sessionStorage.getItem("dev_authenticated") === "true"
      
      if (!isAuthenticated) {
        console.log("[AuthGuard] Not authenticated, redirecting to /auth")
        router.push("/auth")
      }
    }
  }, [router])

  // In dev mode, show children immediately (server will allow access)
  // Client-side check ensures redirect happens if not authenticated
  return <>{children}</>
}

