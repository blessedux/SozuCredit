import "server-only"
import { getStellarConfig } from "@/lib/turnkey/config"

/** Circle USDC issuers — must match what Etherfuse settles (verified in troqpay sandbox evidence). */
const USDC_ISSUER_TESTNET = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const USDC_ISSUER_MAINNET = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

export interface EtherfuseConfig {
  apiKey: string
  apiBaseUrl: string
  dashboardBaseUrl: string
  /** CODE:ISSUER of the settlement asset on this network. */
  assetId: string
  usdcIssuer: string
  jwtIssuer: string
  jwtKid: string
  jwtPrivateKeyPem: string
  network: "testnet" | "mainnet"
}

function readEnv() {
  return {
    apiKey: process.env.ETHERFUSE_API_KEY?.trim(),
    jwtIssuer: process.env.ETHERFUSE_JWT_ISSUER?.trim(),
    jwtKid: process.env.ETHERFUSE_JWT_KID?.trim(),
    jwtPrivateKeyPem: process.env.ETHERFUSE_JWT_PRIVATE_KEY?.trim(),
  }
}

export function rampServerConfigured(): boolean {
  const e = readEnv()
  return Boolean(e.apiKey && e.jwtIssuer && e.jwtKid && e.jwtPrivateKeyPem)
}

/** Maps `readEnv()` keys to their `ETHERFUSE_*` env var names, for the missing-vars error message. */
const ENV_VAR_NAMES: Record<keyof ReturnType<typeof readEnv>, string> = {
  apiKey: "ETHERFUSE_API_KEY",
  jwtIssuer: "ETHERFUSE_JWT_ISSUER",
  jwtKid: "ETHERFUSE_JWT_KID",
  jwtPrivateKeyPem: "ETHERFUSE_JWT_PRIVATE_KEY",
}

export function getEtherfuseConfig(): EtherfuseConfig {
  const e = readEnv()
  const missing = Object.entries(e)
    .filter(([, v]) => !v)
    .map(([k]) => ENV_VAR_NAMES[k as keyof ReturnType<typeof readEnv>])
  if (missing.length > 0) {
    throw new Error(
      `Etherfuse ramp not configured. Missing: ETHERFUSE_API_KEY, ETHERFUSE_JWT_ISSUER, ETHERFUSE_JWT_KID, ETHERFUSE_JWT_PRIVATE_KEY (unset: ${missing.length}).`,
    )
  }
  const network = getStellarConfig().network as "testnet" | "mainnet"
  const usdcIssuer = network === "mainnet" ? USDC_ISSUER_MAINNET : USDC_ISSUER_TESTNET
  return {
    apiKey: e.apiKey!,
    jwtIssuer: e.jwtIssuer!,
    jwtKid: e.jwtKid!,
    jwtPrivateKeyPem: e.jwtPrivateKeyPem!,
    apiBaseUrl: network === "mainnet" ? "https://api.etherfuse.com" : "https://api.sand.etherfuse.com",
    dashboardBaseUrl: network === "mainnet" ? "https://app.etherfuse.com" : "https://sandbox.etherfuse.com",
    assetId: `USDC:${usdcIssuer}`,
    usdcIssuer,
    network,
  }
}
