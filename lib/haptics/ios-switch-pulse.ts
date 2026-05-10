/**
 * Safari iOS haptics via hidden `<input type="checkbox" switch>` + `label.click()`.
 * Adapted from https://github.com/tijnjh/ios-haptics (see also https://codepen.io/tijnjh/pen/KwpgPqB).
 *
 * Avoids npm `ios-haptics`’s import-time `supportsHaptics` snapshot, which can stay false under Next SSR.
 */

function canUseIosSwitchTrick(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  const m = (q: string) => window.matchMedia(q).matches
  if (m("(pointer: coarse)")) return true
  if (m("(any-pointer: coarse)")) return true
  if (typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 0 && m("(hover: none)")) return true
  return false
}

function pulseOnce(): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(50)
      return
    }
    if (typeof document === "undefined") return
    if (!canUseIosSwitchTrick()) return

    const labelEl = document.createElement("label")
    labelEl.setAttribute("aria-hidden", "true")
    labelEl.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0)"

    const inputEl = document.createElement("input")
    inputEl.type = "checkbox"
    inputEl.setAttribute("switch", "")
    labelEl.appendChild(inputEl)

    document.head.appendChild(labelEl)
    labelEl.click()
    document.head.removeChild(labelEl)
  } catch {
    // ignore
  }
}

/** One tap feedback — use from `onClick` on real UI (iOS user-activation). */
export function iosHapticSingle(): void {
  pulseOnce()
}
