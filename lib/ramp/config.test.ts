import { afterEach, describe, expect, it, vi } from "vitest"

const ENV_KEYS = ["ETHERFUSE_API_KEY", "ETHERFUSE_JWT_ISSUER", "ETHERFUSE_JWT_KID", "ETHERFUSE_JWT_PRIVATE_KEY"]

function setAll() {
  process.env.ETHERFUSE_API_KEY = "api_sand:kid:org"
  process.env.ETHERFUSE_JWT_ISSUER = "https://issuer.example"
  process.env.ETHERFUSE_JWT_KID = "kid-1"
  process.env.ETHERFUSE_JWT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nx\\n-----END PRIVATE KEY-----"
}

describe("getEtherfuseConfig", () => {
  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k]
    vi.resetModules()
  })

  it("selects sandbox URLs and testnet USDC issuer on testnet", async () => {
    setAll()
    process.env.STELLAR_NETWORK = "testnet"
    const { getEtherfuseConfig } = await import("@/lib/ramp/config")
    const cfg = getEtherfuseConfig()
    expect(cfg.apiBaseUrl).toBe("https://api.sand.etherfuse.com")
    expect(cfg.dashboardBaseUrl).toBe("https://sandbox.etherfuse.com")
    expect(cfg.assetId).toBe("USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5")
  })

  it("throws listing every missing env var", async () => {
    const { getEtherfuseConfig } = await import("@/lib/ramp/config")
    expect(() => getEtherfuseConfig()).toThrow(/ETHERFUSE_API_KEY/)
    expect(() => getEtherfuseConfig()).toThrow(/ETHERFUSE_JWT_PRIVATE_KEY/)
  })

  it("rampServerConfigured is false without creds, true with", async () => {
    const { rampServerConfigured } = await import("@/lib/ramp/config")
    expect(rampServerConfigured()).toBe(false)
    setAll()
    expect(rampServerConfigured()).toBe(true)
  })
})
