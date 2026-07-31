/**
 * App-level configuration derived from environment variables.
 * Import from here instead of reading process.env directly in components.
 *
 * Deployment model (one GitHub repo, one Vercel project):
 *   Staging    → `dev`  → https://dev.sozu.capital
 *   Production → `main` → https://app.sozu.capital  (closed beta)
 *
 * Closed beta is NOT a separate Vercel project. It is Production (and Staging)
 * with deposit rails enabled via env flags. See docs/vercel-consolidation.md.
 */

/** Vercel deployment target: production | preview | development */
export const vercelEnv = (process.env.VERCEL_ENV ??
  (process.env.NODE_ENV === "production" ? "production" : "development")) as
  | "production"
  | "preview"
  | "development"

/**
 * Product posture.
 * "closed" = Sozu Wallet closed beta (deposits / P2P ramp available when enabled)
 * "open" = legacy credit.sozu.capital wallet-only posture (deprecated)
 */
export const betaTier = (process.env.NEXT_PUBLIC_BETA_TIER ?? "closed") as "open" | "closed"

/**
 * Whether the fiat deposit rail (bank transfer + card) is available.
 * UI requires NEXT_PUBLIC_DEPOSITS_ENABLED=true at build/dev start.
 * Server routes also accept DEPOSITS_ENABLED for backwards compatibility.
 *
 * Staging and Production closed beta should both set this true.
 * Preview may leave it false unless testing deposit UI.
 */
export const depositsEnabled =
  process.env.NEXT_PUBLIC_DEPOSITS_ENABLED === "true" ||
  process.env.DEPOSITS_ENABLED === "true"

/** CLP threshold below which the auto-release job may skip manual review (Phase 5). */
export const autoReleaseLimitClp = Number(process.env.BETA_AUTO_RELEASE_LIMIT_CLP ?? "500000")

/** Public app origin (no trailing slash). Used for callbacks and health diagnostics. */
export const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "")

/** WebAuthn RP ID — must match the hostname users see in the browser. */
export const rpId = process.env.NEXT_PUBLIC_RP_ID ?? "localhost"

/** True when this build is the closed-beta wallet product (default). */
export const isClosedBeta = betaTier === "closed"
