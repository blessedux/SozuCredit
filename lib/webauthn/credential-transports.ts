/**
 * Builds `transports` for WebAuthn `allowCredentials`.
 *
 * Older clients always stored `["internal"]` at registration, which makes browsers
 * assume the credential is platform-only and hides "Use another device" / QR (hybrid).
 * Omitting transports in that case lets the RP try all transports the user-agent supports.
 */
export function allowCredentialTransportsForRequest(
  stored: string[] | null | undefined
): AuthenticatorTransport[] | undefined {
  if (!stored || stored.length === 0) return undefined
  if (stored.length === 1 && stored[0] === "internal") return undefined
  return stored as AuthenticatorTransport[]
}
