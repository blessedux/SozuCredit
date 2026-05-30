/**
 * Clears all client-side session data.
 * Call this before redirecting to /auth on logout or account deletion.
 */
export function clearClientSession(): void {
  if (typeof window === "undefined") return
  // Persistent keys (localStorage)
  localStorage.removeItem("dev_authenticated")
  localStorage.removeItem("dev_username")
  localStorage.removeItem("stellar_public_key")
  localStorage.removeItem("sozu_username")
  // Ephemeral keys (sessionStorage) — also clear for a clean slate
  sessionStorage.clear()
}
