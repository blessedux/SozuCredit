import "server-only"

/** Standalone Sozu Faucet origin (Mode A JWT claims). */
export function getSozuFaucetUrl(): string {
  const raw =
    process.env.SOZU_FAUCET_URL?.trim() || "https://faucet.sozu.capital"
  return raw.replace(/\/$/, "")
}

/** Shared HS256 secret with sozu-faucet (`FAUCET_AUTH_SECRET`). */
export function getFaucetAuthSecret(): string {
  const secret = process.env.FAUCET_AUTH_SECRET?.trim()
  if (!secret || secret.length < 16) {
    throw new Error(
      "FAUCET_AUTH_SECRET must be set (≥16 chars) and match sozu-faucet.",
    )
  }
  return secret
}
