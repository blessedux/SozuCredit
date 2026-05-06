/** Short-lived cookies to correlate Google’s redirect with our user + exact redirect_uri. */
export const GMAIL_OAUTH_USER_COOKIE = "sozu_gmail_oauth_uid"
export const GMAIL_OAUTH_REDIRECT_COOKIE = "sozu_gmail_oauth_redirect"

export const gmailOAuthCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
}
