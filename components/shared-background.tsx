'use client'

import { FallingPattern } from '@/components/ui/falling-pattern'
import { usePathname } from 'next/navigation'

export function SharedBackground() {
  const pathname = usePathname()

  // Show background on pages that use it
  const showBackground = pathname === '/wallet' || pathname === '/auth' || pathname === '/' || pathname?.startsWith('/wallet') || pathname?.startsWith('/auth')

  if (!showBackground) {
    return null
  }

  return (
    <div 
      className="fixed inset-0 z-[0] pointer-events-none"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
      }}
    >
      <FallingPattern 
        className="h-full w-full" 
        backgroundColor="oklch(0 0 0)"
        color="oklch(1 0 0)"
      />
    </div>
  )
}

