import { NextResponse } from "next/server"
import { resolveUserId } from "@/lib/auth/resolve-user"
import { mintSozuFaucetToken } from "@/lib/sozu-faucet/mint-token"
import {
  buildFaucetReturnWithToken,
  parseAllowlistedFaucetReturnUrl,
} from "@/lib/sozu-faucet/return-allowlist"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"

export const dynamic = "force-dynamic"

type HandoffBody = {
  return?: string
  /** Optional client C… hint when DB still has a legacy G. */
  to?: string
}

function isSmartAccount(addr: string): boolean {
  return /^C[A-Z0-9]{55}$/.test(addr)
}

/**
 * POST /api/wallet/sozu-faucet/handoff
 * Mint a ~5m Mode A JWT and return the allowlisted faucet redirect URL with ?token=.
 */
export async function POST(request: Request) {
  const auth = await resolveUserId(request)
  if (auth.error) return auth.error
  const { userId } = auth

  let body: HandoffBody = {}
  try {
    body = (await request.json()) as HandoffBody
  } catch {
    body = {}
  }

  const returnUrl = parseAllowlistedFaucetReturnUrl(body.return)
  if (!returnUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid return URL.",
        reason: "invalid_return",
      },
      { status: 400 },
    )
  }

  try {
    const wallet = await getStellarWallet(userId, true).catch(() => null)
    const dbAddress = wallet?.publicKey?.trim().toUpperCase() ?? null
    const requested = body.to?.trim().toUpperCase() ?? null

    let walletAddress: string | null = null
    if (dbAddress && isSmartAccount(dbAddress)) {
      walletAddress = dbAddress
    } else if (requested && isSmartAccount(requested)) {
      // Prefer explicit C… from the client when DB still has a legacy G / missing row.
      walletAddress = requested
    }

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Setup Incomplete. Finish setting up your smart account (C…), then try Login with Sozu again.",
          reason: "setup_incomplete",
        },
        { status: 422 },
      )
    }

    let token: string
    try {
      token = mintSozuFaucetToken({
        userId,
        walletAddress,
        expiresInSeconds: 300,
      })
    } catch (err) {
      console.error("[sozu-faucet/handoff] mint", err)
      return NextResponse.json(
        {
          success: false,
          error: "Faucet auth is not configured on this deployment.",
          reason: "misconfigured",
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      success: true,
      redirectUrl: buildFaucetReturnWithToken(returnUrl, token),
      walletAddress,
    })
  } catch (err) {
    console.error("[POST /api/wallet/sozu-faucet/handoff]", err)
    return NextResponse.json(
      {
        success: false,
        error: "Could not complete faucet login. Try again in a moment.",
        reason: "handoff_failed",
      },
      { status: 502 },
    )
  }
}
