"use client"

import { useEffect } from "react"

/**
 * Fades out and removes the #sozu-preloader div after React has hydrated.
 * Must be a client component so it runs only in the browser.
 */
export function PreloaderRemover() {
  useEffect(() => {
    const el = document.getElementById("sozu-preloader")
    if (!el) return
    // Kick off the CSS transition (opacity is already 1 from SSR)
    el.style.transition = "opacity 0.45s ease"
    el.style.opacity = "0"
    const t = setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el)
    }, 470)
    return () => clearTimeout(t)
  }, [])
  return null
}
