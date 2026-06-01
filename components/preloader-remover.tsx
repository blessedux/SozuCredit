"use client"

import { useEffect } from "react"
import { SOZU_BOOTSTRAP_READY_EVENT } from "@/lib/app-ready"

const STATIC_PRELOADER_ID = "sozu-preloader"
const MIN_VISIBLE_MS = 100
const MAX_VISIBLE_MS = 8_000
const FADE_MS = 180

function ensureStaticPreloader(): HTMLElement {
  const existing = document.getElementById(STATIC_PRELOADER_ID)
  if (existing) return existing

  const el = document.createElement("div")
  el.id = STATIC_PRELOADER_ID
  el.style.cssText =
    "position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;"

  const img = document.createElement("img")
  img.src = "/icons/sozu_icon_192.png"
  img.alt = ""
  img.width = 64
  img.height = 64
  img.style.cssText = "border-radius:22%;opacity:0.92"
  el.appendChild(img)

  document.body.prepend(el)
  return el
}

/**
 * Manages the static #sozu-preloader injected by layout.tsx (outside React's tree).
 * Renders nothing — all DOM work happens in effects to avoid hydration mismatches.
 */
export function Preloader() {
  useEffect(() => {
    const el = ensureStaticPreloader()
    const shownAt = performance.now()
    let faded = false
    let maxTimer: ReturnType<typeof setTimeout> | undefined
    let fadeTimer: ReturnType<typeof setTimeout> | undefined
    let removeTimer: ReturnType<typeof setTimeout> | undefined

    const beginFade = () => {
      if (faded) return
      faded = true

      const elapsed = performance.now() - shownAt
      const delay = Math.max(0, MIN_VISIBLE_MS - elapsed)

      fadeTimer = setTimeout(() => {
        el.style.transition = `opacity ${FADE_MS}ms ease`
        el.style.opacity = "0"
        el.style.pointerEvents = "none"
        removeTimer = setTimeout(() => el.remove(), FADE_MS)
      }, delay)
    }

    const onReady = () => beginFade()
    // Primary: bootstrap-ready — auth routing settled and destination UI may show.
    window.addEventListener(SOZU_BOOTSTRAP_READY_EVENT, onReady, { once: true })
    maxTimer = setTimeout(beginFade, MAX_VISIBLE_MS)

    return () => {
      window.removeEventListener(SOZU_BOOTSTRAP_READY_EVENT, onReady)
      if (maxTimer) clearTimeout(maxTimer)
      if (fadeTimer) clearTimeout(fadeTimer)
      if (removeTimer) clearTimeout(removeTimer)
    }
  }, [])

  return null
}
