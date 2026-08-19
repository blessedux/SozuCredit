import "server-only"
import type { RampProvider } from "@/lib/ramp/provider"
import { getEtherfuseConfig } from "@/lib/ramp/config"
import { createEtherfuseProvider } from "@/lib/ramp/etherfuse/client"

/**
 * Server-side provider registry. One implementation today; future providers
 * register here keyed by providerId and are looked up per corridor via
 * lib/ramp/registry-core.ts's RAMP_CORRIDORS.
 */
export function getRampProvider(providerId: "etherfuse" = "etherfuse"): RampProvider {
  if (providerId !== "etherfuse") throw new Error(`Unknown ramp provider: ${providerId}`)
  const cfg = getEtherfuseConfig()
  return createEtherfuseProvider({
    apiKey: cfg.apiKey,
    apiBaseUrl: cfg.apiBaseUrl,
    dashboardBaseUrl: cfg.dashboardBaseUrl,
    blockchain: "stellar",
    assetId: cfg.assetId,
    jwtIssuer: cfg.jwtIssuer,
    jwtKid: cfg.jwtKid,
    jwtPrivateKeyPem: cfg.jwtPrivateKeyPem,
  })
}
