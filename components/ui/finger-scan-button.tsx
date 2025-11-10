"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/liquid-glass-button"
import { Fingerprint } from "lucide-react"

interface FingerScanButtonProps {
  onScan?: () => void | Promise<void>
  scanning?: boolean
  disabled?: boolean
  className?: string
}

export function FingerScanButton({ 
  onScan, 
  scanning: controlledScanning,
  disabled = false,
  className 
}: FingerScanButtonProps) {
  const [internalScanning, setInternalScanning] = useState(false)
  const touchStartTimeRef = useRef<number | null>(null)
  const hasTriggeredRef = useRef(false)
  
  // Use controlled scanning prop if provided, otherwise use internal state
  const isScanning = controlledScanning !== undefined ? controlledScanning : internalScanning

  const handleScan = async () => {
    // Prevent multiple triggers
    if (hasTriggeredRef.current) {
      return
    }
    
    if (disabled || isScanning) {
      console.log("[FingerScan] Button disabled or already scanning")
      return
    }
    
    hasTriggeredRef.current = true
    console.log("[FingerScan] Starting scan...")
    
    if (controlledScanning === undefined) {
      setInternalScanning(true)
    }
    
    try {
      if (onScan) {
        console.log("[FingerScan] Calling onScan handler...")
        await onScan()
        console.log("[FingerScan] onScan handler completed")
      }
    } catch (error) {
      console.error("[FingerScan] Error in scan handler:", error)
      hasTriggeredRef.current = false
      throw error
    } finally {
      // Only reset internal state if not controlled
      if (controlledScanning === undefined) {
        setTimeout(() => {
          setInternalScanning(false)
          hasTriggeredRef.current = false
        }, 2000)
      } else {
        // Reset after a delay even if controlled
        setTimeout(() => {
          hasTriggeredRef.current = false
        }, 1000)
      }
    }
  }

  // Handle touch start (for tap and hold)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isScanning || hasTriggeredRef.current) {
      return
    }
    
    touchStartTimeRef.current = Date.now()
    
    // Trigger immediately on touch start (for tap and hold behavior)
    // Users expect it to work when they place their finger, just like a real fingerprint scanner
    handleScan()
    
    // Prevent click event from firing after touch (to avoid double-triggering)
    // This only affects touch devices, desktop clicks still work normally
    e.preventDefault()
    e.stopPropagation()
  }

  // Handle touch end
  const handleTouchEnd = (e: React.TouchEvent) => {
    // Prevent click event from firing after touch
    e.preventDefault()
    e.stopPropagation()
    
    // Clear touch start time
    touchStartTimeRef.current = null
  }

  // Handle touch cancel (e.g., user swipes away)
  const handleTouchCancel = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    touchStartTimeRef.current = null
    // Don't reset hasTriggeredRef here - if scan already started, let it continue
  }

  return (
    <div className={`flex items-center justify-center ${className || ""}`}>
      <div className="text-center space-y-6"> 
        <div className="relative">
          <Button
            onClick={handleScan}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            disabled={disabled || isScanning}
            className={`
              relative w-12 h-12 rounded-full border-2 transition-all duration-300
              bg-white text-black hover:bg-white/90 active:bg-white/80
              touch-manipulation select-none
              ${
                isScanning
                  ? "shadow-sm"
                  : ""
              }
            `}
          >
            <Fingerprint
              className={`
                size-24 transition-all duration-300
                ${isScanning ? "animate-pulse text-black" : "text-black"}
              `}
            />

            {isScanning && (
              <div className="absolute inset-0 rounded-full border-2 border-white animate-ping" />
            )}
          </Button>
        </div>

      </div>
    </div>
  )
}

// Export Component alias for compatibility with demo
export function Component() {
  const [isScanning, setIsScanning] = useState(false)

  const handleScan = () => {
    setIsScanning(true)
    // Simulate scanning process
    setTimeout(() => {
      setIsScanning(false)
    }, 2000)
  }

  return (
    <div className="flex items-center justify-center ">
      <div className="text-center space-y-6"> 
        <div className="relative">
          <Button
            onClick={handleScan}
            disabled={isScanning}
            className={`
              relative w-12 h-12 rounded-full border-2 transition-all duration-300
              ${
                isScanning
                  ? "shadow-sm"
                  : ""
              }
            `}
          >
            <Fingerprint
              className={`
                size-24 transition-all duration-300
                ${isScanning ? "animate-pulse" : "text-primary-foreground"}
              `}
            />

            {isScanning && <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping" />}
          </Button>

          {isScanning && (
            <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        <div className="text-xs mt-4">
          {isScanning ? "Scanning fingerprint..." : "Place your finger on the sensor"}
        </div>
      </div>
    </div>
  )
}

