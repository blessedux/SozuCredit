export const SOZU_APP_READY_EVENT = "sozu:app-ready"

export function signalAppReady() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SOZU_APP_READY_EVENT))
  }
}
