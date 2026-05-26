"use client"

import { usePathname } from "next/navigation"
import { AuthOrangeOrbShader } from "@/components/ui/paper-design-shader-background"

const SHADER_PATHS = ["/auth", "/wallet", "/home", "/settings", "/ledger"]

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

  const isLedger = pathname === "/ledger" || pathname.startsWith("/ledger/")

  return (
    <>
      {showShader ? (
        <AuthOrangeOrbShader
          className="pointer-events-none fixed inset-0 z-0"
          variant={isLedger ? "blobs" : "orb"}
        />
      ) : null}
      {children}
    </>
  )
}
