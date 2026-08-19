import { createPrivateKey, createSign, randomUUID } from "node:crypto"
import type { KycLaunch } from "@/lib/ramp/provider"

// RS256, NOT ES256 — Etherfuse's sandbox rejects ES256 outright
// ("Disallowed signature algorithm"). `scope` must be exactly
// "verification" (anything else → invalid_scope). `email` and `name`
// are REQUIRED claims. Live-verified in troqpay-mvp
// (docs/evidence/etherfuse-sandbox-findings.md "## Launch JWT").
const KYC_LAUNCH_SCOPE = "verification"
const KYC_LAUNCH_TARGET = "/idv"
const KYC_LAUNCH_TTL_SECONDS = 300

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

export function buildKycLaunchJwt(params: {
  customerId: string
  email: string
  displayName: string
  jwtIssuer: string
  jwtKid: string
  jwtPrivateKeyPem: string
  apiBaseUrl: string
  dashboardBaseUrl: string
}): KycLaunch {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT", kid: params.jwtKid }
  const payload = {
    iss: params.jwtIssuer,
    // Anything other than the customer's own organization id registers a
    // brand-new person on Etherfuse's side.
    sub: params.customerId,
    aud: `${params.apiBaseUrl}/auth/token`,
    scope: KYC_LAUNCH_SCOPE,
    jti: randomUUID(),
    email: params.email,
    name: params.displayName,
    iat: now,
    exp: now + KYC_LAUNCH_TTL_SECONDS,
  }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  // A PEM read out of .env carries literal \n two-character sequences.
  const key = createPrivateKey(params.jwtPrivateKeyPem.replace(/\\n/g, "\n"))
  const signature = createSign("SHA256").update(signingInput).sign(key)
  return {
    actionUrl: `${params.dashboardBaseUrl}/auth/launch`,
    assertion: `${signingInput}.${b64url(signature)}`,
    target: KYC_LAUNCH_TARGET,
  }
}
