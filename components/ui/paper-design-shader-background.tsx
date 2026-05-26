"use client"

import { cn } from "@/lib/utils"
import { GrainGradient } from "@paper-design/shaders-react"

type AuthOrangeOrbShaderProps = {
  className?: string
}

export function AuthOrangeOrbShader({ className }: AuthOrangeOrbShaderProps) {
  return (
    <div aria-hidden className={cn("h-full w-full", className)}>
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="hsl(0, 0%, 0%)"
        softness={0.76}
        intensity={0.45}
        noise={0}
        shape="corners"
        offsetX={0}
        offsetY={-0.3}
        scale={1}
        rotation={125}
        speed={1}
        colors={["hsl(14, 100%, 57%)", "hsl(45, 100%, 51%)", "hsl(340, 82%, 52%)"]}
      />
    </div>
  )
}

export function GradientBackground() {
  return <AuthOrangeOrbShader />
}
