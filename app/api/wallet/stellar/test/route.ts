import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getTurnkeyClient, isTurnkeyConfigured } from "@/lib/turnkey/client"
import { getTurnkeyConfig } from "@/lib/turnkey/config"
import { createStellarWallet } from "@/lib/turnkey/stellar-wallet"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

/**
 * Test endpoint to verify Turnkey connection and test wallet creation
 * GET /api/wallet/stellar/test - Test Turnkey configuration
 * POST /api/wallet/stellar/test - Test wallet creation (requires test userId)
 */
export async function GET(request: Request) {
  try {
    // Check if Turnkey is configured
    const isConfigured = isTurnkeyConfigured()
    if (!isConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: "Turnkey not configured",
          details: "Missing required environment variables: NEXT_PUBLIC_TURNKEY_ORG_ID, NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY, and one of: NEXT_PUBLIC_TURNKEY_API_PRIVATE_KEY, TURNKEY_API_PRIVATE_KEY, or NEXT_PRIVATE_TURNKEY_API_PRIVATE_KEY",
        },
        { status: 400, headers: corsHeaders(request as any) }
      )
    }

    const config = getTurnkeyConfig()
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get Turnkey config",
        },
        { status: 500, headers: corsHeaders(request as any) }
      )
    }

    // Test Turnkey client connection by calling whoami
    try {
      const client = getTurnkeyClient()
      const whoami = await client.getWhoami({
        organizationId: config.organizationId,
      })

      return NextResponse.json(
        {
          success: true,
          message: "Turnkey connection successful",
          config: {
            organizationId: config.organizationId,
            apiBaseUrl: config.apiBaseUrl,
            hasPublicKey: !!config.apiPublicKey,
            hasPrivateKey: !!config.apiPrivateKey,
            publicKeyLength: config.apiPublicKey?.length || 0,
            privateKeyLength: config.apiPrivateKey?.length || 0,
          },
          whoami: {
            organizationId: whoami.organizationId,
            userId: whoami.userId,
          },
        },
        { headers: corsHeaders(request as any) }
      )
    } catch (turnkeyError: any) {
      return NextResponse.json(
        {
          success: false,
          error: "Turnkey connection failed",
          details: turnkeyError?.message || String(turnkeyError),
          stack: process.env.NODE_ENV === "development" ? turnkeyError?.stack : undefined,
        },
        { status: 500, headers: corsHeaders(request as any) }
      )
    }
  } catch (error) {
    console.error("[Stellar Test] Error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Test failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "userId is required",
        },
        { status: 400, headers: corsHeaders(request as any) }
      )
    }

    // Check if Turnkey is configured
    if (!isTurnkeyConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Turnkey not configured",
        },
        { status: 400, headers: corsHeaders(request as any) }
      )
    }

    console.log("[Stellar Test] Testing wallet creation for userId:", userId)

    // Test wallet creation
    const wallet = await createStellarWallet(userId)

    return NextResponse.json(
      {
        success: true,
        message: "Wallet creation test successful",
        wallet: {
          turnkeyWalletId: wallet.turnkeyWalletId,
          publicKey: wallet.publicKey,
        },
      },
      { headers: corsHeaders(request as any) }
    )
  } catch (error) {
    console.error("[Stellar Test] Wallet creation test failed:", error)

    const isDevelopment = process.env.NODE_ENV === "development"

    return NextResponse.json(
      {
        success: false,
        error: "Wallet creation test failed",
        details: error instanceof Error ? error.message : String(error),
        stack: isDevelopment && error instanceof Error ? error.stack : undefined,
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}

