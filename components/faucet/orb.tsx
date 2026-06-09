"use client";

/**
 * The Sozu Faucet orb — a living object, not an illustration.
 * Uses the same GrainGradient texture as the /home orb
 * (components/ui/paper-design-shader-background.tsx), clipped to a circle,
 * while framer-motion drives the per-state breathing/glow.
 * See docs/FAUCET_motion_design_system.md.
 */

import { motion } from "framer-motion";
import { GrainGradient } from "@paper-design/shaders-react";
import {
  MOBILE_MAX_PIXEL_COUNT,
  MOBILE_MIN_PIXEL_RATIO,
} from "@/lib/shader/mobile-shader-config";
import { cn } from "@/lib/utils";
import type { OrbState } from "@/lib/faucet/types";

type OrbProps = {
  state: OrbState;
  /** CSS size of the orb core, e.g. "min(38vw, 220px)". */
  size?: string;
  className?: string;
};

/** Same palette as the /home orb texture. */
const ORB_COLORS = [
  "hsl(44,100%,62%)",
  "hsl(30,100%,52%)",
  "hsl(20,100%,44%)",
  "hsl(12,90%,32%)",
];

/** Shader internal clock per state — activating stays slow and deliberate. */
function shaderSpeed(state: OrbState): number {
  switch (state) {
    case "claiming":
      return 0.1;
    case "available":
      return 0.16;
    case "success":
      return 0.2;
    case "cooldown":
      return 0.06;
    case "empty":
      return 0.035;
    default:
      return 0.02;
  }
}

/** Dim dormant states by darkening the texture, not swapping it. */
function textureFilter(state: OrbState): string {
  switch (state) {
    case "empty":
      return "brightness(0.4) saturate(0.75)";
    case "inactive":
      return "brightness(0.22) saturate(0.5)";
    case "cooldown":
      return "brightness(0.6) saturate(0.85)";
    default:
      return "none";
  }
}

/** Per-state animation of the orb core (scale/opacity breathing). */
const coreVariants = {
  available: {
    scale: [1, 1.06, 1],
    opacity: [0.95, 1, 0.95],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" as const },
  },
  // Activating: slow, gathering energy — not frantic.
  claiming: {
    scale: [1, 0.96, 1.02, 1],
    opacity: 1,
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
  },
  success: {
    scale: [1.15, 1.18, 1.15],
    opacity: 1,
    transition: { duration: 10, repeat: Infinity, ease: "easeInOut" as const },
  },
  cooldown: {
    scale: [0.92, 0.97, 0.92],
    opacity: [0.6, 0.75, 0.6],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
  },
  empty: {
    scale: [0.88, 0.9, 0.88],
    opacity: [0.5, 0.6, 0.5],
    transition: { duration: 14, repeat: Infinity, ease: "easeInOut" as const },
  },
  inactive: {
    scale: 0.85,
    opacity: 0.35,
    transition: { duration: 1 },
  },
};

const glowVariants = {
  available: {
    scale: [1, 1.12, 1],
    opacity: [0.5, 0.75, 0.5],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" as const },
  },
  claiming: {
    scale: [1, 1.18, 1],
    opacity: [0.55, 0.8, 0.55],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
  },
  success: {
    scale: [1.4, 1.5, 1.4],
    opacity: [0.7, 0.85, 0.7],
    transition: { duration: 10, repeat: Infinity, ease: "easeInOut" as const },
  },
  cooldown: {
    scale: [0.9, 1, 0.9],
    opacity: [0.15, 0.3, 0.15],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
  },
  empty: {
    scale: 0.85,
    opacity: [0.06, 0.1, 0.06],
    transition: { duration: 14, repeat: Infinity, ease: "easeInOut" as const },
  },
  inactive: {
    scale: 0.8,
    opacity: 0.03,
    transition: { duration: 1 },
  },
};

export function Orb({ state, size = "min(38vw, 220px)", className }: OrbProps) {
  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Ambient room illumination — the screen subtly lit by the orb */}
      <motion.div
        variants={glowVariants}
        animate={state}
        className="pointer-events-none absolute rounded-full"
        style={{
          width: "260%",
          height: "260%",
          background:
            "radial-gradient(circle, rgba(251,146,60,0.28) 0%, rgba(217,119,6,0.12) 35%, rgba(0,0,0,0) 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Core: /home orb texture clipped to a circle */}
      <motion.div
        variants={coreVariants}
        animate={state}
        className="relative h-full w-full"
        style={{
          boxShadow:
            state === "empty" || state === "inactive"
              ? "0 0 40px rgba(146,64,14,0.25)"
              : "0 0 80px rgba(251,146,60,0.55), 0 0 160px rgba(217,119,6,0.35)",
          borderRadius: "50%",
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
            filter: textureFilter(state),
            transition: "filter 1.5s ease",
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
            speed={shaderSpeed(state)}
            minPixelRatio={MOBILE_MIN_PIXEL_RATIO}
            maxPixelCount={MOBILE_MAX_PIXEL_COUNT}
            colors={ORB_COLORS}
          />

          {/* Circular rim — same falloff as the /home orb */}
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
      </motion.div>

      {/* Cooldown: tiny energy particles returning to the orb */}
      {state === "cooldown" && (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="pointer-events-none absolute h-1 w-1 rounded-full bg-amber-300"
              style={{ filter: "blur(0.5px)" }}
              initial={{
                x: Math.cos((i / 5) * Math.PI * 2) * 140,
                y: Math.sin((i / 5) * Math.PI * 2) * 140,
                opacity: 0,
              }}
              animate={{ x: 0, y: 0, opacity: [0, 0.9, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.7,
                ease: "easeIn",
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
