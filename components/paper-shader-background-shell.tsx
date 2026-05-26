"use client"

import { usePathname } from "next/navigation"
import { AuthOrangeOrbShader } from "@/components/ui/paper-design-shader-background"

const SHADER_PATHS = ["/auth", "/wallet"]

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

  return (
    <>
      {showShader ? (
        <AuthOrangeOrbShader className="pointer-events-none fixed inset-0 z-0" />
      ) : null}
      {children}
    </>
  )
}
