"use client"

import { useState, useEffect } from "react"

/**
 * Renders the full-screen preloader as a React-managed element.
 *
 * Server:          visible=true  → div is in the HTML (instant black screen with logo)
 * Client hydrate:  visible=true  → React reconciles, matches SSR HTML ✓
 * After useEffect: fades to 0 opacity, then React unmounts (no raw DOM removal)
 *
 * This avoids the hydration mismatch that occurs when the DOM is mutated
 * directly (via removeChild / style changes) outside of React's reconciler.
 */
export function Preloader() {
  const [opacity, setOpacity] = useState(1)
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    // Start fade immediately after hydration
    const fadeTimer = setTimeout(() => setOpacity(0), 80)
    // Remove from VDOM after the CSS transition completes
    const unmountTimer = setTimeout(() => setMounted(false), 580)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(unmountTimer)
    }
  }, [])

  if (!mounted) return null

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transition: "opacity 0.45s ease",
        pointerEvents: "none",
      }}
    >
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
