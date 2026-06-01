export const SOZU_APP_READY_EVENT = "sozu:app-ready"

/** @deprecated Prefer sozu:bootstrap-ready — fired when auth routing is settled and UI may show. */
export const SOZU_SHELL_READY_EVENT = "sozu:shell-ready"

/** Preloader dismisses on this — after auth decision and destination shell can paint. */
export const SOZU_BOOTSTRAP_READY_EVENT = "sozu:bootstrap-ready"

let shellReadySignaled = false
let bootstrapReadySignaled = false

export function signalBootstrapReady() {
  if (typeof window === "undefined" || bootstrapReadySignaled) return
  bootstrapReadySignaled = true
  window.dispatchEvent(new Event(SOZU_BOOTSTRAP_READY_EVENT))
  signalShellReady()
}

export function signalShellReady() {
  if (typeof window === "undefined" || shellReadySignaled) return
  shellReadySignaled = true
  window.dispatchEvent(new Event(SOZU_SHELL_READY_EVENT))
}

export function signalAppReady() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SOZU_APP_READY_EVENT))
  }
}
