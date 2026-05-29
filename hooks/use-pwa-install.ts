"use client"

import { useEffect, useRef, useState } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false
  // Standard iOS devices
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true
  // iPadOS 13+ reports as "MacIntel" but has touch
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true
  return false
}

function detectStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  )
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setIsInstalled(detectStandalone())
    setIsIos(detectIos())

    const handler = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    // If already installed via standalone, hide the prompt
    const mq = window.matchMedia("(display-mode: standalone)")
    const onMqChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true)
    }
    mq.addEventListener("change", onMqChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      mq.removeEventListener("change", onMqChange)
    }
  }, [])

  const triggerInstall = async (): Promise<boolean> => {
    if (!promptRef.current) return false
    await promptRef.current.prompt()
    const { outcome } = await promptRef.current.userChoice
    promptRef.current = null
    if (outcome === "accepted") {
      setCanInstall(false)
      setIsInstalled(true)
    }
    return outcome === "accepted"
  }

  return { canInstall, triggerInstall, isIos, isInstalled }
}
