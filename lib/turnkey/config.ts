// Turnkey configuration
export const TURNKEY_CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_TURNKEY_API_BASE_URL || "https://api.turnkey.com",
  organizationId: process.env.NEXT_PUBLIC_TURNKEY_ORG_ID || "",
  apiKeyName: process.env.NEXT_PUBLIC_TURNKEY_API_KEY_NAME || "",
  apiPrivateKey: process.env.NEXT_PUBLIC_TURNKEY_API_PRIVATE_KEY || "",
  subOrganizationId: process.env.NEXT_PUBLIC_TURNKEY_SUB_ORG_ID || "",
  rpId: typeof window !== "undefined" ? window.location.hostname : "localhost",
  rpName: "Sozu Credit Platform",
}

export function getTurnkeyConfig() {
  if (!TURNKEY_CONFIG.organizationId || !TURNKEY_CONFIG.apiKeyName || !TURNKEY_CONFIG.apiPrivateKey) {
    console.warn("⚠️  Turnkey environment variables not set. Passkey features may not work.")
    return null
  }
  return TURNKEY_CONFIG
}

