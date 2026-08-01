import "server-only"

import { createHmac } from "node:crypto"
import { getFaucetAuthSecret } from "@/lib/sozu-faucet/config"

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

/**
 * Mint a short-lived Mode A JWT for Sozu Faucet.
 * Shape must match sozu-faucet `lib/auth.ts`: `{ sub, wallet, iat, exp }` HS256.
 */
export function mintSozuFaucetToken(params: {
  userId: string
  walletAddress: string
  expiresInSeconds?: number
}): string {
  const secret = getFaucetAuthSecret()
  const wallet = params.walletAddress.trim().toUpperCase()
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (params.expiresInSeconds ?? 300)

  const header = base64url(JSON.stringify({ alg: "HS256" }))
  const payload = base64url(
    JSON.stringify({
      wallet,
      sub: params.userId,
      iat: now,
      exp,
    }),
  )
  const data = `${header}.${payload}`
  const sig = base64url(createHmac("sha256", secret).update(data).digest())
  return `${data}.${sig}`
}
