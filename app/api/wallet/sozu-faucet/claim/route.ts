import { NextResponse } from "next/server"
import { resolveUserId } from "@/lib/auth/resolve-user"
import { getSozuFaucetUrl } from "@/lib/sozu-faucet/config"
import { mintSozuFaucetToken } from "@/lib/sozu-faucet/mint-token"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type ClaimBody = {
  to?: string
}

type FaucetClaimJson = {
  success?: boolean
  amount?: number
  to?: string
  txHash?: string
  error?: string
  reason?: string
  nextAvailableAt?: string
  asset?: string
  network?: string
}

function isValidStellarAddress(addr: string): boolean {
  return /^[CG][A-Z0-9]{55}$/.test(addr)
}

/**
 * POST /api/wallet/sozu-faucet/claim
 * One-click testnet Circle USDC via standalone Sozu Faucet (Mode A JWT).
 */
export async function POST(request: Request) {
  const auth = await resolveUserId(request)
  if (auth.error) return auth.error
  const { userId } = auth

  const stellar = getStellarConfig()
  if (stellar.network !== "testnet") {
    return NextResponse.json(
      {
        success: false,
        error: "Sozu Faucet is only available on testnet.",
        reason: "mainnet_refused",
      },
      { status: 403 },
    )
  }

  let body: ClaimBody = {}
  try {
    body = (await request.json()) as ClaimBody
  } catch {
    body = {}
  }

  try {
    const wallet = await getStellarWallet(userId, true).catch(() => null)
    const dbAddress = wallet?.publicKey?.trim().toUpperCase() ?? null
    const requested = body.to?.trim().toUpperCase() ?? null

    let walletAddress = dbAddress
    if (!walletAddress && requested && isValidStellarAddress(requested)) {
      walletAddress = requested
    }
    if (
      walletAddress &&
      requested &&
      isValidStellarAddress(requested) &&
      requested !== walletAddress
    ) {
      // Prefer explicit C… from the client when DB still has a legacy G.
      if (requested.startsWith("C") && walletAddress.startsWith("G")) {
        walletAddress = requested
      } else if (requested !== walletAddress) {
        return NextResponse.json(
          {
            success: false,
            error: "Recipient must match your Sozu wallet address.",
            reason: "unauthorized",
          },
          { status: 403 },
        )
      }
    }

    if (!walletAddress || !isValidStellarAddress(walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: "No Stellar wallet found. Finish setup, then try again.",
          reason: "wallet_missing",
        },
        { status: 422 },
      )
    }

    let token: string
    try {
      token = mintSozuFaucetToken({ userId, walletAddress })
    } catch (err) {
      console.error("[sozu-faucet/claim] mint", err)
      return NextResponse.json(
        {
          success: false,
          error: "Faucet auth is not configured on this deployment.",
          reason: "misconfigured",
        },
        { status: 503 },
      )
    }

    const faucetBase = getSozuFaucetUrl()
    const claimRes = await fetch(`${faucetBase}/api/v1/faucet/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: walletAddress }),
      cache: "no-store",
    })

    const claimBody = (await claimRes.json().catch(() => ({}))) as FaucetClaimJson

    if (!claimRes.ok || !claimBody.success) {
      return NextResponse.json(
        {
          success: false,
          amount: claimBody.amount ?? 20,
          error:
            claimBody.error ??
            `Faucet claim failed (${claimRes.status}). Try again shortly.`,
          reason: claimBody.reason ?? "payment_failed",
          nextAvailableAt: claimBody.nextAvailableAt,
          to: walletAddress,
        },
        { status: claimRes.status >= 400 ? claimRes.status : 502 },
      )
    }

    return NextResponse.json({
      success: true,
      amount: claimBody.amount ?? 20,
      asset: claimBody.asset ?? "circle_usdc_sac",
      network: "testnet",
      to: claimBody.to ?? walletAddress,
      txHash: claimBody.txHash,
      nextAvailableAt: claimBody.nextAvailableAt,
    })
  } catch (err) {
    console.error("[POST /api/wallet/sozu-faucet/claim]", err)
    return NextResponse.json(
      {
        success: false,
        error: "Could not reach Sozu Faucet. Try again in a moment.",
        reason: "payment_failed",
      },
      { status: 502 },
    )
  }
}
