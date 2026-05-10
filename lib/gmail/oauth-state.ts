import { createHmac, timingSafeEqual } from "node:crypto"

/** Must stay in sync with short-lived OAuth cookies (~10m). */
const MAX_AGE_MS = 12 * 60 * 1000

export type GmailOAuthStatePayload = {
  uid: string
  r: string
  iat: number
}

/**
 * HMAC-signed OAuth `state` so `/api/gmail/callback` can recover user + redirect_uri
 * when httpOnly cookies are dropped (common on mobile Safari / embedded browsers).
 */
export function signGmailOAuthState(payload: GmailOAuthStatePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const sig = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifyGmailOAuthState(state: string, secret: string): GmailOAuthStatePayload | null {
  try {
    const lastDot = state.lastIndexOf(".")
    if (lastDot <= 0) return null
    const body = state.slice(0, lastDot)
    const sig = state.slice(lastDot + 1)
    if (!body || !sig) return null
    const expected = createHmac("sha256", secret).update(body).digest("base64url")
    const a = Buffer.from(sig, "utf8")
    const b = Buffer.from(expected, "utf8")
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GmailOAuthStatePayload
    if (!json.uid || !json.r || typeof json.iat !== "number") return null
    if (Date.now() - json.iat > MAX_AGE_MS) return null
    return json
  } catch {
    return null
  }
}
