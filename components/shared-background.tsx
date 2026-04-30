'use client'

import { FallingPattern } from '@/components/ui/falling-pattern'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function SharedBackground() {
  const pathname = usePathname()
  const [showBackground, setShowBackground] = useState(false)
  const videoSrc = process.env.NEXT_PUBLIC_BG_VIDEO_SRC

  useEffect(() => {
    const shouldShow =
      pathname === '/wallet' ||
      pathname === '/auth' ||
      pathname === '/' ||
      pathname?.startsWith('/wallet') ||
      pathname?.startsWith('/auth')

    if (!shouldShow) {
      setShowBackground(false)
      return
    }

    // Defer mounting until after first paint so critical UI renders first
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void, opts?: object) => number })
        .requestIdleCallback(() => setShowBackground(true), { timeout: 800 })
      return () => {
        (window as Window & { cancelIdleCallback: (id: number) => void })
          .cancelIdleCallback(id)
      }
    } else {
      // Fallback: small timeout
      const t = setTimeout(() => setShowBackground(true), 50)
      return () => clearTimeout(t)
    }
  }, [pathname])

  if (!showBackground) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[0] pointer-events-none">
      <FallingPattern
        className="h-full w-full"
        backgroundColor="oklch(0 0 0)"
        color="oklch(1 0 0)"
        useVideoFallback
        videoSrc={videoSrc}
      />
    </div>
  )
}
