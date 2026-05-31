"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

type OnboardingOverlayContextValue = {
  isOnboardingOverlayOpen: boolean
  setOnboardingOverlayOpen: (open: boolean) => void
}

const OnboardingOverlayContext = createContext<OnboardingOverlayContextValue | null>(null)

export function OnboardingOverlayProvider({ children }: { children: ReactNode }) {
  const [isOnboardingOverlayOpen, setOnboardingOverlayOpen] = useState(false)

  const value = useMemo(
    () => ({
      isOnboardingOverlayOpen,
      setOnboardingOverlayOpen,
    }),
    [isOnboardingOverlayOpen],
  )

  return (
    <OnboardingOverlayContext.Provider value={value}>{children}</OnboardingOverlayContext.Provider>
  )
}

export function useOnboardingOverlay(): OnboardingOverlayContextValue {
  const ctx = useContext(OnboardingOverlayContext)
  if (!ctx) {
    return {
      isOnboardingOverlayOpen: false,
      setOnboardingOverlayOpen: () => {},
    }
  }
  return ctx
}

/** Optional hook for components that only need the setter. */
export function useSetOnboardingOverlayOpen(): (open: boolean) => void {
  const { setOnboardingOverlayOpen } = useOnboardingOverlay()
  return useCallback((open: boolean) => setOnboardingOverlayOpen(open), [setOnboardingOverlayOpen])
}
