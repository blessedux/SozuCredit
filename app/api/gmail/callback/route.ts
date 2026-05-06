import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  GMAIL_OAUTH_REDIRECT_COOKIE,
  GMAIL_OAUTH_USER_COOKIE,
  gmailOAuthCookieOptions,
} from "@/lib/gmail/oauth-cookies"
import { getGoogleClientId, getGoogleClientSecret, GMAIL_OAUTH_SCOPE } from "@/lib/gmail/oauth-config"

function redirectWithCookies(
  base: string,
  path: string,
  clearCookies: boolean
): NextResponse {
  const res = NextResponse.redirect(new URL(path, base))
  if (clearCookies) {
    res.cookies.set(GMAIL_OAUTH_USER_COOKIE, "", { ...gmailOAuthCookieOptions, maxAge: 0 })
    res.cookies.set(GMAIL_OAUTH_REDIRECT_COOKIE, "", { ...gmailOAuthCookieOptions, maxAge: 0 })
  }
  return res
}

async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const clientId = getGoogleClientId()
  const clientSecret = getGoogleClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth client id or client secret")
  }
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  })
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!tokenRes.ok) {
    await tokenRes.text()
    throw new Error(`Token exchange failed (${tokenRes.status})`)
  }
  return tokenRes.json() as Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
  }>
}

async function fetchConnectedGoogleEmail(accessToken: string): Promise<string> {
  const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  let gmailDetail = ""
  if (gmailRes.ok) {
    const j = (await gmailRes.json()) as { emailAddress?: string }
    if (j.emailAddress) return j.emailAddress
  } else {
    try {
      const body = (await gmailRes.json()) as { error?: { message?: string } }
      if (body?.error?.message) gmailDetail = ` ${body.error.message}`
    } catch {
      /* ignore */
    }
  }

  const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (userinfoRes.ok) {
    const u = (await userinfoRes.json()) as { email?: string }
    if (u.email) return u.email
  }

  throw new Error(
    `Gmail profile failed (${gmailRes.status}); userinfo failed (${userinfoRes.status}).` +
      ` Enable Gmail API for this Google Cloud project for sync.` +
      gmailDetail
  )
}

export async function GET(request: Request) {
  const base = new URL(request.url).origin
  const url = new URL(request.url)
  const err = url.searchParams.get("error")
  if (err === "access_denied") {
    return redirectWithCookies(base, "/settings?gmail=denied", true)
  }
  if (err) {
    return redirectWithCookies(
      base,
      `/settings?gmail=error&msg=${encodeURIComponent(err)}`,
      true
    )
  }

  const code = url.searchParams.get("code")
  if (!code) {
    return redirectWithCookies(base, "/settings?gmail=error&msg=missing_code", true)
  }

  const cookieStore = await cookies()
  const userId = cookieStore.get(GMAIL_OAUTH_USER_COOKIE)?.value
  const redirectUri = cookieStore.get(GMAIL_OAUTH_REDIRECT_COOKIE)?.value

  if (!userId || !redirectUri) {
    return redirectWithCookies(
      base,
      `/settings?gmail=error&msg=${encodeURIComponent("session_expired_retry")}`,
      true
    )
  }

  try {
    const tokenJson = await exchangeAuthorizationCode(code, redirectUri)
    const email = await fetchConnectedGoogleEmail(tokenJson.access_token)
    const expiresAt = new Date(Date.now() + (tokenJson.expires_in ?? 3600) * 1000).toISOString()
    const scopeStored = tokenJson.scope ?? GMAIL_OAUTH_SCOPE

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Server missing Supabase configuration")
    }

    const db = createServiceClient(supabaseUrl, serviceKey)

    const { data: existing } = await db
      .from("gmail_connections")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle()

    const refresh =
      tokenJson.refresh_token ||
      (existing as { refresh_token?: string } | null)?.refresh_token ||
      ""

    const { error: upsertError } = await db.from("gmail_connections").upsert(
      {
        user_id: userId,
        google_email: email,
        access_token: tokenJson.access_token,
        refresh_token: refresh,
        scope: scopeStored,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" }
    )

    if (upsertError) {
      console.error("[gmail/callback] upsert", upsertError)
      return redirectWithCookies(
        base,
        `/settings?gmail=error&msg=${encodeURIComponent(upsertError.message)}`,
        true
      )
    }

    return redirectWithCookies(base, "/settings?gmail=linked", true)
  } catch (e) {
    console.error("[gmail/callback]", e)
    const msg = e instanceof Error ? e.message : "callback_failed"
    return redirectWithCookies(base, `/settings?gmail=error&msg=${encodeURIComponent(msg)}`, true)
  }
}
