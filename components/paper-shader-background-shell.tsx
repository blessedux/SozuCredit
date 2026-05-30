"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { deferNonCritical } from "@/lib/defer-non-critical"
import { usePageVisibility } from "@/hooks/use-page-visibility"
import { useShaderPerformanceTier } from "@/hooks/use-shader-performance-tier"
import type { ShaderTier } from "@/hooks/use-shader-performance-tier"

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
  const isVisible = usePageVisibility()
  const tier = useShaderPerformanceTier()

  useEffect(() => {
    if (!showShader) {
      setShaderReady(false)
      return
    }
    deferNonCritical(() => setShaderReady(true))
  }, [showShader])

  // Hard-unmount the shader when the page is hidden — this triggers
  // ShaderMount.dispose() on every GrainGradient canvas, cancelling all
  // rAF loops and freeing the WebGL context. On Android PWAs this is the
  // only reliable way to prevent the GPU from running in the background.
  const shaderActive = showShader && shaderReady && isVisible && tier !== "static"

  const isLedger =
    pathname === "/ledger" ||
    pathname.startsWith("/ledger/") ||
    pathname === "/credit" ||
    pathname.startsWith("/credit/")

  const variant = isLedger ? "blobs" : "orb"

  return (
    <>
      <div aria-hidden className="sozu-app-viewport sozu-app-viewport-bg pointer-events-none z-0">
        <div className="sozu-app-viewport-inner bg-black" />
      </div>
      {shaderActive ? (
        <div className="sozu-app-viewport pointer-events-none z-0">
          <AuthOrangeOrbShader
            className="sozu-app-viewport-inner"
            variant={variant}
            tier={tier}
          />
        </div>
      ) : null}
      {children}
    </>
  )
}
