const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly"
/** Lets us read the signed-in email via OAuth userinfo if Gmail API returns 403 (e.g. API not enabled). */
const USERINFO_EMAIL = "https://www.googleapis.com/auth/userinfo.email"

export const GMAIL_OAUTH_SCOPE = `${GMAIL_READONLY} ${USERINFO_EMAIL}`

export function resolveGoogleRedirectUri(request: Request): string {
  const fromEnv = (process.env.GOOGLE_REDIRECT_URI || "").trim()
  if (fromEnv) return fromEnv
  const proto = request.headers.get("x-forwarded-proto") || "http"
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000"
  return `${proto}://${host}/api/gmail/callback`
}

export function getGoogleClientId(): string | undefined {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  return id?.trim() || undefined
}

export function getGoogleClientSecret(): string | undefined {
  const s = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  return s?.trim() || undefined
}
