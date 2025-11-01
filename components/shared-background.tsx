'use client'

import { FallingPattern } from '@/components/ui/falling-pattern'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function SharedBackground() {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)

  // Keep background visible during route transitions
  useEffect(() => {
    setIsVisible(true)
    
    // Small delay to ensure smooth transition
    const timer = setTimeout(() => {
      // Background stays visible
    }, 0)

    return () => clearTimeout(timer)
  }, [pathname])

  // Show background on pages that use it
  const showBackground = pathname === '/wallet' || pathname === '/auth' || pathname === '/'

  if (!showBackground) {
    return null
  }

  return (
    <div 
      className="fixed inset-0 z-0 pointer-events-none"
    >
      <FallingPattern 
        className="h-full w-full" 
        backgroundColor="oklch(0 0 0)"
        color="oklch(1 0 0)"
        key={pathname} // Re-key on route change to maintain animation
      />
    </div>
  )
}

