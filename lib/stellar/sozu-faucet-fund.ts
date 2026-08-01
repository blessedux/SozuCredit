/**
 * Client helper: one-click testnet Circle USDC via Sozu Faucet (wallet API proxy).
 */

"use client"

import { getUserId } from "@/lib/wallet-utils"

export type SozuFaucetFundResult =
  | {
      ok: true
      amount: number
      to: string
      txHash?: string
    }
  | {
      ok: false
      error: string
      reason?: string
      nextAvailableAt?: string
    }

/**
 * Claim testnet USDC for the signed-in wallet through `/api/wallet/sozu-faucet/claim`.
 */
export async function fundViaSozuFaucet(
  receiveAddress?: string | null,
): Promise<SozuFaucetFundResult> {
  const userId = getUserId()
  if (!userId) {
    return { ok: false, error: "Sign in to claim testnet USDC.", reason: "unauthorized" }
  }

  const to = receiveAddress?.trim().toUpperCase() || undefined

  try {
    const res = await fetch("/api/wallet/sozu-faucet/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify(to ? { to } : {}),
      cache: "no-store",
    })

    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean
      amount?: number
      to?: string
      txHash?: string
      error?: string
      reason?: string
      nextAvailableAt?: string
    }

    if (res.ok && body.success && body.to) {
      return {
        ok: true,
        amount: typeof body.amount === "number" ? body.amount : 20,
        to: body.to,
        txHash: body.txHash,
      }
    }

    return {
      ok: false,
      error: body.error ?? `Claim failed (${res.status}).`,
      reason: body.reason,
      nextAvailableAt: body.nextAvailableAt,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reach Sozu Faucet.",
      reason: "payment_failed",
    }
  }
}
