"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"

export default function WalletPage() {
  const router = useRouter()
  const pathname = usePathname()
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (redirectedRef.current || pathname !== "/wallet") return
    redirectedRef.current = true
    router.replace("/home?panel=home")
  }, [pathname, router])

  return null
}
