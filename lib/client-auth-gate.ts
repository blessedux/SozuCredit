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

/**
 * Query markers that must keep a signed-in PWA on `/auth` (pay hop, redeem
 * sign, checkout redirect, faucet, tag switch). Used by the before-paint
 * layout script — a signed-in camera scan of pay.sozu.capital/pay/qr/qr4
 * lands on `/auth?return_to=…` and must not be yanked to `/home`.
 */
export const AUTH_ENTRY_KEEP_QUERY_MARKERS = [
  "sdpInvite=1",
  "faucet=",
  "return_to=",
  "intent=",
  "redirect=",
  "showTag=",
  "switch=",
] as const

export function authSearchKeepsAuthedUserOnAuth(search: string): boolean {
  return AUTH_ENTRY_KEEP_QUERY_MARKERS.some((marker) => search.includes(marker))
}

/**
 * Before-paint decision: send a signed-in `/auth` visit to `/home`?
 * Matches the layout IIFE (`pathname.indexOf("/auth")===0`).
 */
export function shouldBounceAuthedAuthToHome(pathname: string, search: string): boolean {
  if (!pathname.startsWith("/auth")) return false
  if (pathname.includes("add-device")) return false
  if (authSearchKeepsAuthedUserOnAuth(search)) return false
  return true
}

/** Redirect authed users away from login (client handles sdpInvite / add-device / faucet / pay hop). */
export function shouldRedirectAuthedAwayFromAuth(pathname: string, search: string): boolean {
  if (!shouldBounceAuthedAuthToHome(pathname, search)) return false
  return isClientAuthed()
}

/** Inline IIFE injected in `app/layout.tsx`. Keep in sync via AUTH_ENTRY_KEEP_QUERY_MARKERS. */
export function authRoutingInlineScript(): string {
  const keepChecks = AUTH_ENTRY_KEEP_QUERY_MARKERS.map(
    (marker) => `location.search.indexOf(${JSON.stringify(marker)})===-1`,
  ).join("&&")

  return `(function(){try{var p=location.pathname;var auth=localStorage.getItem("dev_authenticated")==="true"||sessionStorage.getItem("dev_authenticated")==="true";var uid=localStorage.getItem("dev_username")||sessionStorage.getItem("dev_username");var authed=auth&&uid&&String(uid).indexOf("dev-user-")!==0;var walletPath=p==="/home"||p==="/wallet"||p==="/settings"||p==="/ledger"||p.indexOf("/ledger/")===0||p==="/credit"||p.indexOf("/credit/")===0;if(walletPath&&!authed){location.replace("/auth"+location.search+location.hash);return}if(p.indexOf("/auth")===0&&authed&&p.indexOf("add-device")===-1&&${keepChecks}){location.replace("/home");return}}catch(e){}})();`
}
