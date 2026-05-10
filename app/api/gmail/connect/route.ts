import { NextResponse } from "next/server"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import {
  GMAIL_OAUTH_REDIRECT_COOKIE,
  GMAIL_OAUTH_USER_COOKIE,
  gmailOAuthCookieOptions,
} from "@/lib/gmail/oauth-cookies"
import { getGoogleClientId, getGoogleClientSecret, GMAIL_OAUTH_SCOPE, resolveGoogleRedirectUri } from "@/lib/gmail/oauth-config"
import { signGmailOAuthState } from "@/lib/gmail/oauth-state"

/**
 * Returns Google OAuth URL (gmail.readonly). Sets short-lived httpOnly cookies so
 * `/api/gmail/callback` can associate the code with the user and redirect_uri.
 * When `GOOGLE_CLIENT_SECRET` is set, also embeds an HMAC-signed `state` so mobile
 * browsers that drop cookies on the Google round-trip can still complete linking.
 */
export async function POST(request: Request) {
  const ctx = await getApiUserClient(request)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const clientId = getGoogleClientId()
  const redirectUri = resolveGoogleRedirectUri(request)

  if (!clientId) {
    return NextResponse.json({
      status: "not_configured",
      message:
        "Add GOOGLE_OAUTH_CLIENT_ID (or GOOGLE_CLIENT_ID). For the callback, set GOOGLE_CLIENT_SECRET and optionally GOOGLE_REDIRECT_URI (must match the Google Cloud OAuth client).",
      authUrl: null as string | null,
    })
  }

  const secret = getGoogleClientSecret()
  const state = secret
    ? signGmailOAuthState({ uid: ctx.userId, r: redirectUri, iat: Date.now() }, secret)
    : globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  const scope = encodeURIComponent(GMAIL_OAUTH_SCOPE)
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}` +
    `&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`

  const res = NextResponse.json({ status: "ready", authUrl })
  res.cookies.set(GMAIL_OAUTH_USER_COOKIE, ctx.userId, gmailOAuthCookieOptions)
  res.cookies.set(GMAIL_OAUTH_REDIRECT_COOKIE, redirectUri, gmailOAuthCookieOptions)
  return res
}
