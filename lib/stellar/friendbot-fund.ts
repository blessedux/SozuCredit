/**
 * Testnet Friendbot funding (Horizon). Friendbot only funds classic G accounts.
 * For smart accounts (C…), fund the passkey-derived signer G.
 */

"use client"

import { getStellarConfig } from "@/lib/turnkey/config"
import { getUserId } from "@/lib/wallet-utils"

export type FriendbotFundResult =
  | { ok: true; fundedAddress: string; alreadyFunded?: boolean }
  | { ok: false; error: string }

async function resolveFundableGAddress(
  receiveAddress?: string | null,
): Promise<string | null> {
  const addr = receiveAddress?.trim().toUpperCase()
  if (addr?.startsWith("G") && addr.length === 56) return addr

  const userId = getUserId()
  if (!userId) return null

  const credId =
    sessionStorage.getItem("credential_id") ?? localStorage.getItem("credential_id") ?? null

  try {
    const { derivePrimaryPasskeySignerG } = await import("@/lib/stellar/ensure-passkey-signer")
    const derived = await derivePrimaryPasskeySignerG(userId, credId)
    if (derived?.publicKey.startsWith("G")) return derived.publicKey
  } catch {
    /* fall through */
  }

  try {
    const res = await fetch("/api/wallet/stellar/address", {
      headers: { "x-user-id": userId },
      cache: "no-store",
    })
    if (res.ok) {
      const data = (await res.json()) as { signerPublicKey?: string | null }
      const signer = data.signerPublicKey?.trim().toUpperCase()
      if (signer?.startsWith("G") && signer.length === 56) return signer
    }
  } catch {
    /* fall through */
  }

  return null
}

/**
 * Fund a testnet G via Friendbot. Resolves signer G when `receiveAddress` is a C….
 */
export async function fundViaFriendbot(
  receiveAddress?: string | null,
): Promise<FriendbotFundResult> {
  const cfg = getStellarConfig()
  if (cfg.network !== "testnet") {
    return { ok: false, error: "Friendbot is only available on testnet." }
  }

  const g = await resolveFundableGAddress(receiveAddress)
  if (!g) {
    return {
      ok: false,
      error: "No classic account (G…) to fund. Finish wallet setup, then try again.",
    }
  }

  const horizon = cfg.horizonUrl.replace(/\/$/, "")
  const friendbotUrl = `${horizon}/friendbot?addr=${encodeURIComponent(g)}`

  try {
    const res = await fetch(friendbotUrl, { redirect: "follow" })
    if (res.ok) {
      return { ok: true, fundedAddress: g }
    }

    const body = await res.text().catch(() => "")
    // Already funded is a common 400 from Friendbot — treat as success.
    if (
      res.status === 400 &&
      (/op_already_exists|already|create_account/i.test(body) || body.includes("existing"))
    ) {
      return { ok: true, fundedAddress: g, alreadyFunded: true }
    }

    return {
      ok: false,
      error: `Friendbot failed (${res.status}). ${body.slice(0, 160)}`,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not reach Friendbot.",
    }
  }
}
