/** Sync CSS viewport vars for full-bleed PWA layout (no bottom black strip). */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iOS standalone: layout viewport (innerHeight) can be shorter than the physical screen. */
export function getStandaloneViewportGap(): number {
  if (typeof window === "undefined" || !isStandalonePwa()) return 0
  return Math.max(0, window.screen.height - window.innerHeight)
}

/** Full-bleed height including the iOS standalone home-indicator band when present. */
export function getAppViewportHeight(): number {
  if (typeof window === "undefined") return 0
  return window.innerHeight + getStandaloneViewportGap()
}

const GAP_FILL_ID = "sozu-viewport-gap-fill"

function syncViewportGapFill(gap: number, layoutHeight: number) {
  if (typeof document === "undefined") return

  const existing = document.getElementById(GAP_FILL_ID)

  if (gap <= 0) {
    existing?.remove()
    return
  }

  const el = existing ?? document.createElement("div")
  el.id = GAP_FILL_ID
  el.setAttribute("aria-hidden", "true")
  el.style.cssText = [
    "position:fixed",
    "left:0",
    "right:0",
    `top:${layoutHeight}px`,
    `height:${gap}px`,
    "z-index:0",
    "pointer-events:none",
    "background:linear-gradient(to top,hsl(26,100%,18%) 0%,hsl(22,90%,14%) 100%)",
  ].join(";")

  if (!existing) document.body.appendChild(el)
}

export function syncAppViewportHeight() {
  if (typeof window === "undefined") return

  const layoutHeight = window.innerHeight
  const gap = getStandaloneViewportGap()
  const totalHeight = layoutHeight + gap

  document.documentElement.style.setProperty("--sozu-layout-height", `${layoutHeight}px`)
  document.documentElement.style.setProperty("--sozu-viewport-gap", `${gap}px`)
  document.documentElement.style.setProperty("--sozu-app-height", `${totalHeight}px`)

  syncViewportGapFill(gap, layoutHeight)

  const vv = window.visualViewport
  if (vv) {
    document.documentElement.style.setProperty(
      "--sozu-visual-viewport-height",
      `${Math.round(vv.height)}px`,
    )
  }
}

export function installAppViewportHeightSync() {
  syncAppViewportHeight()

  const onChange = () => syncAppViewportHeight()
  window.addEventListener("resize", onChange)
  window.addEventListener("orientationchange", onChange)
  window.visualViewport?.addEventListener("resize", onChange)

  return () => {
    window.removeEventListener("resize", onChange)
    window.removeEventListener("orientationchange", onChange)
    window.visualViewport?.removeEventListener("resize", onChange)
    document.getElementById(GAP_FILL_ID)?.remove()
  }
}
