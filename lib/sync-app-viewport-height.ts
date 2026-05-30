/** Sync CSS viewport vars for full-bleed PWA layout (no bottom black strip). */
export function syncAppViewportHeight() {
  if (typeof window === "undefined") return

  // Layout viewport — full screen height. visualViewport.height under-counts on
  // iOS standalone PWAs and creates a consistent black gap at the bottom.
  const layoutHeight = window.innerHeight
  document.documentElement.style.setProperty("--sozu-app-height", `${layoutHeight}px`)

  const vv = window.visualViewport
  if (vv) {
    document.documentElement.style.setProperty(
      "--sozu-visual-viewport-height",
      `${Math.round(vv.height)}px`,
    )
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function installAppViewportHeightSync() {
  syncAppViewportHeight()

  const onChange = () => syncAppViewportHeight()
  window.addEventListener("resize", onChange)
  window.addEventListener("orientationchange", onChange)
  // visualViewport resize = keyboard; keep layout height on innerHeight, refresh visual var only
  window.visualViewport?.addEventListener("resize", onChange)

  return () => {
    window.removeEventListener("resize", onChange)
    window.removeEventListener("orientationchange", onChange)
    window.visualViewport?.removeEventListener("resize", onChange)
  }
}
