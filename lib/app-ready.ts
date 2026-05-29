export const SOZU_APP_READY_EVENT = "sozu:app-ready"

/** Fired as soon as the app shell has painted — preloader listens to this, not data-ready. */
export const SOZU_SHELL_READY_EVENT = "sozu:shell-ready"

let shellReadySignaled = false

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
