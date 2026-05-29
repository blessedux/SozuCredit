"use client"

import { memo } from "react"

type PullToRefreshIndicatorProps = {
  /** 0–1 pull progress */
  progress: number
  /** Vertical offset in px while dragging */
  pull: number
  refreshing?: boolean
}

/**
 * Circular wheel that fills and rotates with pull-down progress.
 */
export const PullToRefreshIndicator = memo(function PullToRefreshIndicator({
  progress,
  pull,
  refreshing = false,
}: PullToRefreshIndicatorProps) {
  const size = 28
  const stroke = 2.5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))
  const dashOffset = circumference * (1 - clamped)
  const rotation = clamped * 300 + (refreshing ? 360 : 0)
  const visible = pull > 2 || refreshing

  return (
    <div
      className="pointer-events-none flex justify-center overflow-hidden transition-[height,opacity] duration-200 ease-out"
      style={{
        height: visible ? Math.max(36, pull + 8) : 0,
        opacity: visible ? Math.min(1, 0.25 + clamped * 0.75) : 0,
      }}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={refreshing ? "animate-spin" : ""}
        style={{
          transform: refreshing ? undefined : `rotate(${rotation}deg)`,
          transition: refreshing ? undefined : "transform 80ms linear",
        }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={refreshing ? circumference * 0.25 : dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: refreshing ? undefined : "stroke-dashoffset 80ms linear" }}
        />
      </svg>
    </div>
  )
})
