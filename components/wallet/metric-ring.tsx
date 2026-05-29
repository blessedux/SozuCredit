"use client"

import { memo } from "react"

type MetricRingProps = {
  /** 0–1 fill amount */
  progress: number
  value: string
  label: string
  sublabel?: string
  accent?: string
  trackColor?: string
  size?: number
}

export const MetricRing = memo(function MetricRing({
  progress,
  value,
  label,
  sublabel,
  accent = "rgba(52,211,153,0.95)",
  trackColor = "rgba(255,255,255,0.08)",
  size = 84,
}: MetricRingProps) {
  const stroke = 3.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, progress))
  const dashOffset = circumference * (1 - clamped)

  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 480ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-1">
          <span className="text-[10px] font-semibold leading-tight tabular-nums text-white/90">{value}</span>
        </div>
      </div>
      <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/45">{label}</span>
      {sublabel ? (
        <span className="max-w-[5.5rem] text-[8px] leading-snug text-white/30">{sublabel}</span>
      ) : null}
    </div>
  )
})
