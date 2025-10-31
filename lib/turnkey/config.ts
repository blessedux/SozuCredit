// Turnkey configuration
export const TURNKEY_CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL || "https://api.turnkey.com",
  organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || "",
  apiPublicKey: process.env.NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY || "",
  // Use server-only env var for private key (without NEXT_PUBLIC_ prefix for security)
  // Also check for NEXT_PRIVATE_ prefix as fallback
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY || process.env.NEXT_PRIVATE_TURNKEY_API_PRIVATE_KEY || "",
  subOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_SUB_ORG_ID || "",
  rpId: typeof window !== "undefined" ? window.location.hostname : "localhost",
  rpName: "Sozu Credit Platform",
}

// Stellar configuration
export const STELLAR_CONFIG = {
  network: (process.env.STELLAR_NETWORK || "testnet") as "testnet" | "mainnet",
  horizonUrl:
    process.env.STELLAR_HORIZON_URL ||
    (process.env.STELLAR_NETWORK === "mainnet"
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org"),
}

export function getTurnkeyConfig() {
  // Debug: Log which env vars are present (in dev mode only)
  if (process.env.NODE_ENV === "development") {
    console.log("[Turnkey Config] Environment check:", {
      hasOrgId: !!TURNKEY_CONFIG.organizationId,
      hasPublicKey: !!TURNKEY_CONFIG.apiPublicKey,
      hasPrivateKey: !!TURNKEY_CONFIG.apiPrivateKey,
      orgIdLength: TURNKEY_CONFIG.organizationId?.length || 0,
      publicKeyLength: TURNKEY_CONFIG.apiPublicKey?.length || 0,
      privateKeyLength: TURNKEY_CONFIG.apiPrivateKey?.length || 0,
      rawEnvVars: {
        NEXT_PUBLIC_TURNKEY_ORG_ID: !!process.env.NEXT_PUBLIC_TURNKEY_ORG_ID,
        NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY,
        TURNKEY_API_PRIVATE_KEY: !!process.env.TURNKEY_API_PRIVATE_KEY,
        NEXT_PRIVATE_TURNKEY_API_PRIVATE_KEY: !!process.env.NEXT_PRIVATE_TURNKEY_API_PRIVATE_KEY,
      },
    })
  }

  if (!TURNKEY_CONFIG.organizationId || !TURNKEY_CONFIG.apiPublicKey || !TURNKEY_CONFIG.apiPrivateKey) {
    const missing = []
    if (!TURNKEY_CONFIG.organizationId) missing.push("NEXT_PUBLIC_TURNKEY_ORG_ID")
    if (!TURNKEY_CONFIG.apiPublicKey) missing.push("NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY")
    if (!TURNKEY_CONFIG.apiPrivateKey) missing.push("TURNKEY_API_PRIVATE_KEY or NEXT_PRIVATE_TURNKEY_API_PRIVATE_KEY")
    
    console.warn("⚠️  Turnkey environment variables not set. Passkey features may not work.")
    console.warn("⚠️  Missing variables:", missing.join(", "))
    return null
  }
  return TURNKEY_CONFIG
}

export function getStellarConfig() {
  return STELLAR_CONFIG
}

