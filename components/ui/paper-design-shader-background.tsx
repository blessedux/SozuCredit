"use client"

import { cn } from "@/lib/utils"
import { GrainGradient } from "@paper-design/shaders-react"
import { useIsMobile } from "@/hooks/use-mobile"
import type { ShaderTier } from "@/hooks/use-shader-performance-tier"
import {
  MOBILE_MAX_PIXEL_COUNT,
  DESKTOP_MAX_PIXEL_COUNT,
  MOBILE_MIN_PIXEL_RATIO,
  DESKTOP_MIN_PIXEL_RATIO,
  ORB_SPEED_LITE,
  ORB_SPEED_FULL,
  CORNERS_SPEED_LITE,
  CORNERS_SPEED_FULL,
} from "@/lib/shader/mobile-shader-config"

type AuthOrangeOrbShaderProps = {
  className?: string
  /**
   * "orb"   — mobile circular orb + ambient grain (default, used on auth/wallet/home/settings)
   * "blobs" — original animated corner blobs, always, regardless of screen size (used on ledger)
   */
  variant?: "orb" | "blobs"
  /** Performance tier — passed down from PaperShaderBackgroundShell */
  tier?: ShaderTier
}

export function AuthOrangeOrbShader({
  className,
  variant = "orb",
  tier = "lite",
}: AuthOrangeOrbShaderProps) {
  const isMobile = useIsMobile()

  // ── Desktop / ledger: animated corner blobs ──────────────────────────────
  if (variant === "blobs" || !isMobile) {
    return (
      <div aria-hidden className={cn("h-full w-full", className)}>
        <GrainGradient
          style={{ height: "100%", width: "100%" }}
          colorBack="hsl(0, 0%, 0%)"
          shape="corners"
          scale={1}
          offsetX={0}
          offsetY={-0.3}
          rotation={125}
          softness={0.76}
          intensity={0.45}
          noise={0}
          speed={tier === "lite" ? CORNERS_SPEED_LITE : CORNERS_SPEED_FULL}
          maxPixelCount={tier === "lite" ? MOBILE_MAX_PIXEL_COUNT : DESKTOP_MAX_PIXEL_COUNT}
          minPixelRatio={tier === "lite" ? MOBILE_MIN_PIXEL_RATIO : DESKTOP_MIN_PIXEL_RATIO}
          colors={["hsl(14, 100%, 57%)", "hsl(45, 100%, 51%)", "hsl(340, 82%, 52%)"]}
        />
      </div>
    )
  }

  // ── Mobile orb: static CSS-only fallback (tier === "static") ─────────────
  // No WebGL at all — pure radial gradients that match the orb visual.
  if (tier === "static") {
    return (
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
        {/* Ambient gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: [
              "linear-gradient(to top,",
              "  hsl(26,100%,18%)   0%,",
              "  hsl(24,90%,13%)  12%,",
              "  hsl(22,80%,9%)   26%,",
              "  hsl(18,65%,6%)   42%,",
              "  hsl(14,40%,3%)   58%,",
              "  hsl(0,0%,0%)     72%",
              ")",
            ].join(""),
          }}
        />
        {/* Static orb circle */}
        <div
          style={{
            position: "absolute",
            bottom: "-28vw",
            left: "50%",
            transform: "translateX(-50%)",
            width: "110vw",
            height: "110vw",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, hsl(30,100%,50%) 0%, hsl(20,100%,40%) 30%, hsl(12,90%,28%) 58%, rgba(0,0,0,0.5) 76%, rgba(0,0,0,1) 92%)",
          }}
        />
      </div>
    )
  }

  // ── Mobile orb: single WebGL canvas (lite/full) ───────────────────────────
  //
  // Previous design used THREE full-viewport GrainGradient instances.
  // We now use ONE orb-clipped canvas. The upper atmosphere is reproduced
  // with cheap CSS gradients (static) + a slow CSS opacity animation on a
  // warm-tinted mask layer (orbital-breathe keyframes in globals.css).
  //
  const orbSpeed = tier === "full" ? ORB_SPEED_FULL : ORB_SPEED_LITE

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>

      {/* ── Ambient: 6-stop orange→black gradient (pure CSS, zero GPU cost) ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            "linear-gradient(to top,",
            "  hsl(26,100%,18%)   0%,",
            "  hsl(24,90%,13%)  12%,",
            "  hsl(22,80%,9%)   26%,",
            "  hsl(18,65%,6%)   42%,",
            "  hsl(14,40%,3%)   58%,",
            "  hsl(0,0%,0%)     72%",
            ")",
          ].join(""),
        }}
      />

      {/*
        ── Atmosphere overlay: CSS-animated warm glow ───────────────────────
        A second masked gradient that slowly breathes opacity (via the
        `ambient-drift` keyframe defined in globals.css). This gives the
        upper screen that "alive" warmth that was previously supplied by
        the two extra WebGL blob layers, but costs zero rAF/GPU frames.
      */}
      <div
        className="sozu-ambient-drift"
        style={{
          position: "absolute",
          inset: 0,
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.15) 58%, rgba(0,0,0,0) 74%)",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.15) 58%, rgba(0,0,0,0) 74%)",
          background:
            "radial-gradient(ellipse 120% 60% at 50% -10%, hsl(28,80%,22%) 0%, hsl(18,60%,10%) 55%, transparent 100%)",
        }}
      />

      {/* ── Orb: single circle-clipped GrainGradient ─────────────────────── */}
      {/*
        The orb wrapper uses a slow CSS scale breath (`orb-breathe` keyframe)
        so the circle has organic life even when the shader is moving slowly.
        `will-change: transform` promotes it to its own compositor layer,
        keeping the CSS animation entirely on the GPU without JS involvement.
      */}
      <div
        className="sozu-orb-breathe"
        style={{
          position: "absolute",
          bottom: "-28vw",
          left: "50%",
          transform: "translateX(-50%)",
          width: "110vw",
          height: "110vw",
          willChange: "transform",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            isolation: "isolate",
          }}
        >
          <GrainGradient
            style={{ position: "absolute", inset: 0, height: "100%", width: "100%" }}
            colorBack="hsl(0,0%,0%)"
            shape="blob"
            scale={1.8}
            offsetX={0}
            offsetY={0}
            rotation={0}
            softness={0.72}
            intensity={0.7}
            noise={0.18}
            speed={orbSpeed}
            minPixelRatio={MOBILE_MIN_PIXEL_RATIO}
            maxPixelCount={MOBILE_MAX_PIXEL_COUNT}
            colors={[
              "hsl(44,100%,62%)",
              "hsl(30,100%,52%)",
              "hsl(20,100%,44%)",
              "hsl(12,90%,32%)",
            ]}
          />

          {/* Circular rim */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, transparent 58%, rgba(0,0,0,0.5) 76%, rgba(0,0,0,1) 92%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

    </div>
  )
}

export function GradientBackground() {
  return <AuthOrangeOrbShader />
}
