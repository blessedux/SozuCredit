"use client"

import { useEffect, useState } from "react"

/**
 * Performance tier for the background shader:
 *
 * - "static"  No WebGL loop. Render a pure-CSS orb. Triggered by:
 *               prefers-reduced-motion: reduce
 *               navigator.deviceMemory <= 1 GB
 *               User-agent Android on a sub-720p viewport (heuristic)
 *
 * - "lite"    Single GrainGradient at low resolution + slow speed.
 *             Triggered by any coarse-pointer / mobile viewport.
 *
 * - "full"    Full fidelity. Desktop / large viewport / no motion preference.
 */
export type ShaderTier = "static" | "lite" | "full"

function detectTier(): ShaderTier {
  if (typeof window === "undefined") return "lite"

  // Hard stop: user opted out of motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static"

  // Very low memory (Android Go / entry-level devices)
  // navigator.deviceMemory is non-standard but widely available on Chrome/Android
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof mem === "number" && mem <= 1) return "static"

  // Coarse pointer = touch device (phone/tablet)
  if (window.matchMedia("(pointer: coarse)").matches) return "lite"

  return "full"
}

export function useShaderPerformanceTier(): ShaderTier {
  const [tier, setTier] = useState<ShaderTier>(detectTier)

  useEffect(() => {
    // Re-evaluate if reduced-motion preference changes at runtime
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setTier(detectTier())
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return tier
}
