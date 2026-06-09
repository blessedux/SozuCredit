'use client'

import { useEffect, useRef } from 'react'
import { shouldRegisterServiceWorker } from '@/lib/pwa-host'
import { markPwaInstalled } from '@/lib/pwa/standalone'

export function PWARegister() {
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // ngrok / localhost: skip SW so failed tunnel fetches don't show plain "Offline"
    if (!shouldRegisterServiceWorker()) {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister()
        })
      })
      return
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope)
          
          // Check for updates periodically
          updateIntervalRef.current = setInterval(() => {
            registration.update()
          }, 60000) // Check every minute
        })
        .catch((error) => {
          console.log('[PWA] Service Worker registration failed:', error)
        })
    }

    // Handle PWA install prompt
    let deferredPrompt: any = null

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      deferredPrompt = e
      
      // Show custom install button or notification if needed
      console.log('[PWA] Install prompt available')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully')
      markPwaInstalled()
      deferredPrompt = null
    })

    // iOS Safari has no appinstalled event — user may already have the PWA.
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      markPwaInstalled()
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      // Clean up interval
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [])

  return null
}

