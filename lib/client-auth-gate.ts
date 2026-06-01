/**
 * Client-side session gate for routes that use sessionStorage/localStorage auth
 * (middleware intentionally skips Supabase checks on these paths).
 */

export function isClientAuthed(): boolean {
  if (typeof window === "undefined") return false

  const isAuthenticated =
    localStorage.getItem("dev_authenticated") === "true" ||
    sessionStorage.getItem("dev_authenticated") === "true"

  const rawUserId =
    localStorage.getItem("dev_username") ?? sessionStorage.getItem("dev_username")

  if (typeof rawUserId === "string" && rawUserId.startsWith("dev-user-")) {
    return false
  }

  return isAuthenticated && !!rawUserId
}

export function isWalletBootstrapPath(pathname: string): boolean {
  return (
    pathname === "/home" ||
    pathname === "/wallet" ||
    pathname === "/settings" ||
    pathname === "/ledger" ||
    pathname.startsWith("/ledger/") ||
    pathname === "/credit" ||
    pathname.startsWith("/credit/")
  )
}

export function isAuthEntryPath(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/")
}

/** Paths that must never render wallet UI until passkey session exists. */
export function requiresClientAuth(pathname: string): boolean {
  return isWalletBootstrapPath(pathname)
}

/** Redirect authed users away from login (client handles sdpInvite / add-device). */
export function shouldRedirectAuthedAwayFromAuth(pathname: string, search: string): boolean {
  if (!isAuthEntryPath(pathname)) return false
  if (pathname.includes("add-device")) return false
  if (search.includes("sdpInvite=1")) return false
  return isClientAuthed()
}
