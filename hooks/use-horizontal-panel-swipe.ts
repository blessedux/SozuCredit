import { useRef, useCallback } from "react"

const SWIPE_THRESHOLD = 35
const AXIS_LOCK_RATIO = 1.5

export type PanelSwipeHandlers = {
  // Touch
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
  // Mouse (drag-to-swipe for desktop simulation)
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: (e: React.MouseEvent) => void
  onMouseLeave: (e: React.MouseEvent) => void
}

export function useHorizontalPanelSwipe({
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
}: {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  disabled?: boolean
}): PanelSwipeHandlers {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const lastX = useRef<number | null>(null)
  const lockedAxis = useRef<"horizontal" | "vertical" | null>(null)
  const isDragging = useRef(false)

  const reset = useCallback(() => {
    startX.current = null
    startY.current = null
    lastX.current = null
    lockedAxis.current = null
    isDragging.current = false
  }, [])

  const settle = useCallback(() => {
    if (startX.current === null || lastX.current === null || lockedAxis.current !== "horizontal") {
      reset()
      return
    }
    const dx = lastX.current - startX.current
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      if (dx < 0) onSwipeLeft()
      else onSwipeRight()
    }
    reset()
  }, [reset, onSwipeLeft, onSwipeRight])

  // ── Touch ──────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || e.touches.length !== 1) return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    lastX.current = e.touches[0].clientX
    lockedAxis.current = null
  }, [disabled])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || startX.current === null || startY.current === null) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    lastX.current = e.touches[0].clientX
    if (!lockedAxis.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      lockedAxis.current =
        Math.abs(dx) > Math.abs(dy) * AXIS_LOCK_RATIO ? "horizontal" : "vertical"
    }
    if (lockedAxis.current === "horizontal") e.preventDefault()
  }, [disabled])

  const onTouchEnd = useCallback((_e: React.TouchEvent) => {
    settle()
  }, [settle])

  // ── Mouse (drag simulation) ─────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled || e.button !== 0) return
    startX.current = e.clientX
    startY.current = e.clientY
    lastX.current = e.clientX
    lockedAxis.current = null
    isDragging.current = true
  }, [disabled])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (disabled || !isDragging.current || startX.current === null || startY.current === null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    lastX.current = e.clientX
    if (!lockedAxis.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      lockedAxis.current =
        Math.abs(dx) > Math.abs(dy) * AXIS_LOCK_RATIO ? "horizontal" : "vertical"
    }
  }, [disabled])

  const onMouseUp = useCallback((_e: React.MouseEvent) => {
    if (!isDragging.current) return
    settle()
  }, [settle])

  const onMouseLeave = useCallback((_e: React.MouseEvent) => {
    if (!isDragging.current) return
    settle()
  }, [settle])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  }
}
