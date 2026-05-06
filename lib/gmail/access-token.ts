import type { SupabaseClient } from "@supabase/supabase-js"
import { getGoogleClientId, getGoogleClientSecret } from "@/lib/gmail/oauth-config"

type Conn = {
  access_token: string
  refresh_token: string
  expires_at: string
}

function isExpired(iso: string, skewMs = 90_000) {
  const t = new Date(iso).getTime()
  return !Number.isFinite(t) || t < Date.now() + skewMs
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = getGoogleClientId()
  const clientSecret = getGoogleClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth client id or secret for token refresh")
  }
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  })
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!res.ok) {
    await res.text()
    throw new Error(`Token refresh failed (${res.status})`)
  }
  return res.json() as Promise<{
    access_token: string
    expires_in: number
    refresh_token?: string
  }>
}

/**
 * Returns a valid Gmail access token, refreshing and persisting when near expiry.
 */
export async function getValidGmailAccessToken(
  db: SupabaseClient,
  userId: string,
  conn: Conn
): Promise<string> {
  if (!isExpired(conn.expires_at)) {
    return conn.access_token
  }

  const json = await refreshAccessToken(conn.refresh_token)
  const expiresAt = new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString()
  const nextRefresh = json.refresh_token || conn.refresh_token

  const { error } = await db
    .from("gmail_connections")
    .update({
      access_token: json.access_token,
      refresh_token: nextRefresh,
      expires_at: expiresAt,
    })
    .eq("user_id", userId)

  if (error) {
    console.error("[gmail] failed to persist refreshed token", error.message)
  }

  return json.access_token
}
