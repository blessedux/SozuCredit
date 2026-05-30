/** Hostnames where the service worker should not intercept (dev tunnels). */
export function isPwaDevTunnelHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".ngrok-free.app") ||
    hostname.endsWith(".ngrok.app") ||
    hostname.endsWith(".ngrok.io")
  )
}

export function shouldRegisterServiceWorker(): boolean {
  if (typeof window === "undefined") return false
  return !isPwaDevTunnelHost(window.location.hostname)
}
