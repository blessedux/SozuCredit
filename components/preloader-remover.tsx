"use client"

import { useEffect, useState } from "react"
import { SOZU_BOOTSTRAP_READY_EVENT } from "@/lib/app-ready"

const MIN_VISIBLE_MS = 100
const MAX_VISIBLE_MS = 8_000
const FADE_MS = 180

/**
 * Full-screen preloader owned by React (SSR + client match).
 * Dismisses on sozu:bootstrap-ready, or after MAX_VISIBLE_MS as a fallback.
 */
export function Preloader() {
  const [opacity, setOpacity] = useState(1)
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
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
        setOpacity(0)
        removeTimer = setTimeout(() => setMounted(false), FADE_MS)
      }, delay)
    }

    window.addEventListener(SOZU_BOOTSTRAP_READY_EVENT, beginFade, { once: true })
    maxTimer = setTimeout(beginFade, MAX_VISIBLE_MS)

    return () => {
      window.removeEventListener(SOZU_BOOTSTRAP_READY_EVENT, beginFade)
      if (maxTimer) clearTimeout(maxTimer)
      if (fadeTimer) clearTimeout(fadeTimer)
      if (removeTimer) clearTimeout(removeTimer)
    }
  }, [])

  if (!mounted) return null

  return (
    <div
      id="sozu-preloader"
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/sozu_icon_192.png"
        alt=""
        width={64}
        height={64}
        style={{ borderRadius: "22%", opacity: 0.92 }}
      />
    </div>
  )
}
