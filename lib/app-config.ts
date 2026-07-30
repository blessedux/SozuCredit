/**
 * App-level configuration derived from environment variables.
 * Import from here instead of reading process.env directly in components.
 */

/**
 * Beta tier for feature gating.
 * "closed" = Sozu Wallet (app.sozu.capital / dev.sozu.capital) — deposit MVP enabled
 * "open" = legacy open-beta posture (credit.sozu.capital; wallet/DeFi only — deprecated)
 */
export const betaTier = (process.env.NEXT_PUBLIC_BETA_TIER ?? "closed") as "open" | "closed";

/**
 * Whether the fiat deposit rail (bank transfer + card) is available.
 * UI (client components) requires NEXT_PUBLIC_DEPOSITS_ENABLED=true at build/dev start.
 * Server routes also accept DEPOSITS_ENABLED for backwards compatibility.
 */
export const depositsEnabled =
  process.env.NEXT_PUBLIC_DEPOSITS_ENABLED === "true" ||
  process.env.DEPOSITS_ENABLED === "true";

/** CLP threshold below which the auto-release job may skip manual review (Phase 5). */
export const autoReleaseLimitClp = Number(process.env.BETA_AUTO_RELEASE_LIMIT_CLP ?? "500000");
