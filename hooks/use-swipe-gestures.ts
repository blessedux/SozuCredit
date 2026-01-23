/**
 * Custom hook for swipe gesture handling
 * Handles touch events for opening/closing profile sheet
 */

import { useRef, useCallback } from "react"

const MIN_SWIPE_DISTANCE = 30

export function useSwipeGestures(
  isProfileSheetOpen: boolean,
  onOpenSheet: () => void,
  onCloseSheet: () => void
) {
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchEndY = useRef<number | null>(null)

  const resetTouchPositions = useCallback(() => {
    touchStartX.current = null
    touchEndX.current = null
    touchStartY.current = null
    touchEndY.current = null
  }, [])

  // Swipe gesture handlers for opening menu (swipe right to left on main content)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isProfileSheetOpen) return
    if (e.targetTouches.length !== 1) return
    
    touchStartX.current = e.targetTouches[0].clientX
    touchStartY.current = e.targetTouches[0].clientY
    touchEndX.current = null
    touchEndY.current = null
  }, [isProfileSheetOpen])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartX.current || isProfileSheetOpen || e.targetTouches.length !== 1) return
    
    touchEndX.current = e.targetTouches[0].clientX
    touchEndY.current = e.targetTouches[0].clientY
    
    // Prevent scrolling up - only allow scrolling down
    if (touchStartY.current && touchEndY.current) {
      const scrollDelta = touchEndY.current - touchStartY.current
      if (scrollDelta < 0) {
        e.preventDefault()
        return
      }
    }
    
    // Prevent default scrolling if horizontal swipe is detected
    if (touchStartX.current && touchEndX.current) {
      const distanceX = Math.abs(touchEndX.current - touchStartX.current)
      const distanceY = touchEndY.current && touchStartY.current 
        ? Math.abs(touchEndY.current - touchStartY.current) 
        : 0
      
      if (distanceX > distanceY && distanceX > 10) {
        e.preventDefault()
      }
    }
  }, [isProfileSheetOpen])

  const onTouchEnd = useCallback((e?: React.TouchEvent) => {
    if (!touchStartX.current || !touchEndX.current || !touchStartY.current || isProfileSheetOpen) {
      resetTouchPositions()
      return
    }
    
    const distanceX = touchEndX.current - touchStartX.current
    const absDistanceX = Math.abs(distanceX)
    const absDistanceY = touchEndY.current && touchStartY.current 
      ? Math.abs(touchEndY.current - touchStartY.current) 
      : 0
    
    // Only trigger swipe if horizontal movement is significant and more than vertical
    if (absDistanceX > MIN_SWIPE_DISTANCE && absDistanceX > absDistanceY * 1.2) {
      if (distanceX < 0) {
        // Swipe right to left - open menu
        console.log("[Swipe] Opening menu - swipe right to left detected")
        onOpenSheet()
      }
    }
    
    resetTouchPositions()
  }, [isProfileSheetOpen, onOpenSheet, resetTouchPositions])

  // Swipe gesture handlers for closing menu (swipe left to right on sheet content)
  const onSheetTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isProfileSheetOpen) return
    if (e.targetTouches.length !== 1) return
    
    touchStartX.current = e.targetTouches[0].clientX
    touchStartY.current = e.targetTouches[0].clientY
    touchEndX.current = null
    touchEndY.current = null
  }, [isProfileSheetOpen])

  const onSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartX.current || !isProfileSheetOpen || e.targetTouches.length !== 1) return
    
    touchEndX.current = e.targetTouches[0].clientX
    touchEndY.current = e.targetTouches[0].clientY
    
    // Prevent default scrolling if horizontal swipe is detected
    if (touchStartX.current && touchEndX.current) {
      const distanceX = Math.abs(touchEndX.current - touchStartX.current)
      const distanceY = touchEndY.current && touchStartY.current 
        ? Math.abs(touchEndY.current - touchStartY.current) 
        : 0
      
      if (distanceX > distanceY && distanceX > 10) {
        e.preventDefault()
      }
    }
  }, [isProfileSheetOpen])

  const onSheetTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current || !touchStartY.current || !isProfileSheetOpen) {
      resetTouchPositions()
      return
    }
    
    const distanceX = touchEndX.current - touchStartX.current
    const absDistanceX = Math.abs(distanceX)
    const absDistanceY = touchEndY.current && touchStartY.current 
      ? Math.abs(touchEndY.current - touchStartY.current) 
      : 0
    
    // Swipe left to right to close
    if (absDistanceX > MIN_SWIPE_DISTANCE && absDistanceX > absDistanceY * 1.2 && distanceX > 0) {
      console.log("[Swipe] Closing menu - swipe left to right detected")
      onCloseSheet()
    }
    
    resetTouchPositions()
  }, [isProfileSheetOpen, onCloseSheet, resetTouchPositions])

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onSheetTouchStart,
    onSheetTouchMove,
    onSheetTouchEnd,
  }
}
