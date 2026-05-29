"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { deferNonCritical } from "@/lib/defer-non-critical"

const AuthOrangeOrbShader = dynamic(
  () =>
    import("@/components/ui/paper-design-shader-background").then((mod) => ({
      default: mod.AuthOrangeOrbShader,
    })),
  { ssr: false },
)

const SHADER_PATHS = ["/auth", "/wallet", "/home", "/settings", "/ledger", "/credit", "/sdp"]

function shouldShowPaperShader(pathname: string) {
  return SHADER_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

export function PaperShaderBackgroundShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const showShader = shouldShowPaperShader(pathname)
  const [shaderReady, setShaderReady] = useState(false)

  useEffect(() => {
    if (!showShader) {
      setShaderReady(false)
      return
    }
    deferNonCritical(() => setShaderReady(true))
  }, [showShader])

  const isLedger =
    pathname === "/ledger" ||
    pathname.startsWith("/ledger/") ||
    pathname === "/credit" ||
    pathname.startsWith("/credit/")

  return (
    <>
      {showShader && shaderReady ? (
        <AuthOrangeOrbShader
          className="pointer-events-none fixed inset-0 z-0"
          variant={isLedger ? "blobs" : "orb"}
        />
      ) : null}
      {children}
    </>
  )
}
