/** Sync CSS --sozu-app-height to the visible viewport (fixes iOS PWA bottom gap). */
export function syncAppViewportHeight() {
  if (typeof window === "undefined") return
  const height = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty("--sozu-app-height", `${Math.round(height)}px`)
}

export function installAppViewportHeightSync() {
  syncAppViewportHeight()

  const onChange = () => syncAppViewportHeight()
  window.visualViewport?.addEventListener("resize", onChange)
  window.visualViewport?.addEventListener("scroll", onChange)
  window.addEventListener("resize", onChange)
  window.addEventListener("orientationchange", onChange)

  return () => {
    window.visualViewport?.removeEventListener("resize", onChange)
    window.visualViewport?.removeEventListener("scroll", onChange)
    window.removeEventListener("resize", onChange)
    window.removeEventListener("orientationchange", onChange)
  }
}
