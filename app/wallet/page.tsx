"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

export default function WalletPage() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname === "/wallet") {
      router.replace("/home?panel=wallet")
    }
  }, [pathname, router])

  return null
}
