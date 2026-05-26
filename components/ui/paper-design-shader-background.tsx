"use client"

import { cn } from "@/lib/utils"
import { GrainGradient } from "@paper-design/shaders-react"
import { useIsMobile } from "@/hooks/use-mobile"

type AuthOrangeOrbShaderProps = {
  className?: string
  /**
   * "orb"   — mobile circular orb + ambient grain (default, used on auth/wallet/home/settings)
   * "blobs" — original animated corner blobs, always, regardless of screen size (used on ledger)
   */
  variant?: "orb" | "blobs"
}

export function AuthOrangeOrbShader({ className, variant = "orb" }: AuthOrangeOrbShaderProps) {
  const isMobile = useIsMobile()

  // "blobs" variant always uses the full animated corners shader (desktop look)
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
          speed={0.3}
          colors={["hsl(14, 100%, 57%)", "hsl(45, 100%, 51%)", "hsl(340, 82%, 52%)"]}
        />
      </div>
    )
  }

  if (isMobile) {
    return (
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>

        {/* ── Ambient: 6-stop orange→black gradient rising from orb ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: [
              "linear-gradient(to top,",
              "  hsl(26,100%,18%)   0%,",   // deep warm orange right at orb
              "  hsl(24,90%,13%)  12%,",    // burnt orange
              "  hsl(22,80%,9%)   26%,",    // very dark orange
              "  hsl(18,65%,6%)   42%,",    // near-black with orange tinge
              "  hsl(14,40%,3%)   58%,",    // almost black
              "  hsl(0,0%,0%)     72%",     // pure black
              ")",
            ].join(""),
          }}
        />

        {/* ── Upper blob layer A: slow deep-orange blobs, heavier at top ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 22%, rgba(0,0,0,0.45) 52%, rgba(0,0,0,0) 74%)",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 22%, rgba(0,0,0,0.45) 52%, rgba(0,0,0,0) 74%)",
            mixBlendMode: "screen",
            opacity: 0.9,
          }}
        >
          <GrainGradient
            style={{ height: "100%", width: "100%" }}
            colorBack="hsl(0,0%,0%)"
            shape="blob"
            scale={3.2}
            offsetX={0}
            offsetY={0}
            rotation={15}
            softness={0.78}
            intensity={0.75}
            noise={0.35}
            speed={0.18}
            colors={["hsl(28,80%,28%)", "hsl(20,70%,18%)", "hsl(14,60%,11%)"]}
          />
        </div>

        {/* ── Upper blob layer B: slightly faster, offset rotation — independent motion ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.15) 62%, rgba(0,0,0,0) 78%)",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.15) 62%, rgba(0,0,0,0) 78%)",
            mixBlendMode: "screen",
            opacity: 0.75,
          }}
        >
          <GrainGradient
            style={{ height: "100%", width: "100%" }}
            colorBack="hsl(0,0%,0%)"
            shape="blob"
            scale={2.8}
            offsetX={0}
            offsetY={0}
            rotation={-20}
            softness={0.82}
            intensity={0.65}
            noise={0.28}
            speed={0.4}
            colors={["hsl(32,70%,24%)", "hsl(24,60%,15%)", "hsl(18,50%,9%)"]}
          />
        </div>

        {/* ── Orb: circle-clipped GrainGradient, animation mimics blob color-shift breathing ── */}
        <div
          style={{
            position: "absolute",
            bottom: "-28vw",
            left: "50%",
            transform: "translateX(-50%)",
            width: "110vw",
            height: "110vw",
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
            {/*
              Single animated GrainGradient driving both color AND grain.
              scale=1.8 → blobs large enough to fill the canvas; as they drift
              they blend between golden-orange, orange, deep-orange, and burnt-orange
              — the same color-shift breathing the desktop corners use.
              No CSS scale animation; the blob movement IS the breathing.
            */}
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
              noise={0.26}
              speed={0.55}
              colors={[
                "hsl(44,100%,62%)",   // golden yellow-orange
                "hsl(30,100%,52%)",   // pure orange
                "hsl(20,100%,44%)",   // deep orange
                "hsl(12,90%,32%)",    // burnt orange
              ]}
            />

            {/* Circular rim: stamps a clean black edge so the circle looks perfect */}
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

}

export function GradientBackground() {
  return <AuthOrangeOrbShader />
}
