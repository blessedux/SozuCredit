"use client"

import { useCallback, useRef, useState } from "react"

const PULL_RESISTANCE = 0.45

export type PullToRefreshHandlers = {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: (e: React.MouseEvent) => void
}

export function usePullToRefresh({
  onRefresh,
  threshold = 76,
  maxPull = 128,
  disabled = false,
}: {
  onRefresh: () => Promise<void> | void
  threshold?: number
  maxPull?: number
  disabled?: boolean
}) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const active = useRef(false)
  const pullRef = useRef(0)

  const progress = Math.min(1, pull / threshold)

  const beginPull = useCallback(
    (clientY: number) => {
      if (disabled || refreshing) return
      startY.current = clientY
      active.current = true
    },
    [disabled, refreshing],
  )

  const movePull = useCallback(
    (clientY: number, preventDefault?: () => void) => {
      if (!active.current || startY.current === null || disabled || refreshing) return
      const dy = clientY - startY.current
      if (dy <= 0) {
        pullRef.current = 0
        setPull(0)
        return
      }
      preventDefault?.()
      const next = Math.min(maxPull, dy * PULL_RESISTANCE)
      pullRef.current = next
      setPull(next)
    },
    [disabled, maxPull, refreshing],
  )

  const endPull = useCallback(async () => {
    if (!active.current) return
    active.current = false
    startY.current = null

    const shouldRefresh = pullRef.current >= threshold && !refreshing
    pullRef.current = 0
    setPull(0)

    if (!shouldRefresh) return

    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh, refreshing, threshold])

  const handlers: PullToRefreshHandlers = {
    onTouchStart: (e) => beginPull(e.touches[0].clientY),
    onTouchMove: (e) => movePull(e.touches[0].clientY, () => e.preventDefault()),
    onTouchEnd: () => void endPull(),
    onMouseDown: (e) => {
      if (e.button !== 0) return
      beginPull(e.clientY)
    },
    onMouseMove: (e) => movePull(e.clientY),
    onMouseUp: () => void endPull(),
  }

  return { pull, progress, refreshing, isPulling: pull > 0, handlers }
}
