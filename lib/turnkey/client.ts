import { ApiKeyStamper } from "@turnkey/api-key-stamper"
import { TurnkeyClient } from "@turnkey/http"
import { getTurnkeyConfig } from "./config"

let turnkeyClient: TurnkeyClient | null = null

/**
 * Initialize and return Turnkey HTTP client
 * Uses API key authentication from environment variables
 */
export function getTurnkeyClient(): TurnkeyClient {
  if (turnkeyClient) {
    return turnkeyClient
  }

  const config = getTurnkeyConfig()
  if (!config) {
    throw new Error(
      "Turnkey configuration not found. Please set NEXT_PUBLIC_TURNKEY_ORG_ID, NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY, and TURNKEY_API_PRIVATE_KEY (or NEXT_PRIVATE_TURNKEY_API_PRIVATE_KEY) environment variables."
    )
  }

  // Create API key stamper for authentication
  // Requires both public and private keys from the API key pair
  const stamper = new ApiKeyStamper({
    apiPublicKey: config.apiPublicKey,
    apiPrivateKey: config.apiPrivateKey,
  })

  // Initialize Turnkey client
  turnkeyClient = new TurnkeyClient(
    {
      baseUrl: config.apiBaseUrl,
    },
    stamper
  )

  return turnkeyClient
}

/**
 * Check if Turnkey client can be initialized
 * Returns true if configuration is available
 */
export function isTurnkeyConfigured(): boolean {
  try {
    const config = getTurnkeyConfig()
    return config !== null
  } catch {
    return false
  }
}

