/** Schedule work after first paint / idle time — keeps landing path fast. */
export function deferNonCritical(task: () => void): void {
  if (typeof window === "undefined") return

  const run = () => {
    try {
      task()
    } catch (error) {
      console.warn("[deferNonCritical]", error)
    }
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2500 })
    return
  }

  globalThis.setTimeout(run, 0)
}
