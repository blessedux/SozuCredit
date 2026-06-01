import "server-only"

import * as rpc from "@stellar/stellar-sdk/rpc"
import { Keypair } from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"
import { resolveSorobanRpcUrl } from "@/lib/stellar/soroban-env"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

/** Classic G that pays Soroban fees (STELLAR_FUNDER_SECRET). */
export function getConfiguredFunderPublicKey(): string | null {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim()
  if (!secret) return null
  try {
    return Keypair.fromSecret(secret).publicKey()
  } catch {
    return null
  }
}

/** Server keypair for co-signing Soroban envelopes whose `source` is the funder G. */
export function getFunderKeypair(): Keypair | null {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim()
  if (!secret) return null
  try {
    return Keypair.fromSecret(secret)
  } catch {
    return null
  }
}

async function sorobanAccountExists(publicKey: string, network: StellarNetwork): Promise<boolean> {
  const rpcUrl = resolveSorobanRpcUrl()
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  try {
    await server.getAccount(publicKey.trim().toUpperCase())
    return true
  } catch {
    return false
  }
}

/** Fund a testnet G via Friendbot when it has no on-chain account yet. */
export async function ensureTestnetAccountFunded(publicKey: string): Promise<void> {
  const pk = publicKey.trim().toUpperCase()
  if (!pk.startsWith("G") || pk.length !== 56) {
    throw new Error("Invalid G address for Friendbot funding.")
  }

  if (await sorobanAccountExists(pk, "testnet")) {
    return
  }

  const cfg = getStellarConfig()
  if (cfg.network !== "testnet") {
    throw new Error(
      `Account ${pk.slice(0, 8)}… is not active on the network. Fund it with XLM before sending.`,
    )
  }

  const friendbotUrl = `${cfg.horizonUrl.replace(/\/$/, "")}/friendbot?addr=${encodeURIComponent(pk)}`
  const res = await fetch(friendbotUrl, { redirect: "follow" })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `Could not fund passkey signer ${pk.slice(0, 8)}… on testnet (Friendbot ${res.status}). ${body.slice(0, 200)}`,
    )
  }

  if (!(await sorobanAccountExists(pk, "testnet"))) {
    throw new Error(
      `Friendbot returned success but account ${pk.slice(0, 8)}… is still missing. Retry in a few seconds.`,
    )
  }
}

/**
 * Soroban txs need a funded classic G as `source` (fee payer).
 * OZ smart accounts (C) authorize via passkey; signer G does not need USDC.
 *
 * - Default: use STELLAR_FUNDER_SECRET G when configured (passkey G may be unfunded).
 * - Factory G-signer path: must use passkey G as source → fund on testnet if needed.
 */
export async function resolveSorobanFeePayer(params: {
  signerPublicKey: string
  network: StellarNetwork
  requireSignerAsSource?: boolean
}): Promise<{ feePayer: string; usedFunder: boolean }> {
  const signer = params.signerPublicKey.trim().toUpperCase()
  if (!signer.startsWith("G") || signer.length !== 56) {
    throw new Error("Passkey signer (G…) is required for Soroban payments.")
  }

  if (params.requireSignerAsSource) {
    if (params.network === "testnet") {
      await ensureTestnetAccountFunded(signer)
    } else if (!(await sorobanAccountExists(signer, params.network))) {
      throw new Error(
        `Signer account ${signer.slice(0, 8)}… is not on ${params.network}. Fund it with XLM first.`,
      )
    }
    return { feePayer: signer, usedFunder: false }
  }

  const funder = getConfiguredFunderPublicKey()
  if (funder) {
    if (!(await sorobanAccountExists(funder, params.network))) {
      throw new Error(
        `STELLAR_FUNDER_SECRET account ${funder.slice(0, 8)}… is not on ${params.network}. Fund the funder or fix .env.local.`,
      )
    }
    return { feePayer: funder, usedFunder: true }
  }

  if (params.network === "testnet") {
    await ensureTestnetAccountFunded(signer)
  } else if (!(await sorobanAccountExists(signer, params.network))) {
    throw new Error(
      `No STELLAR_FUNDER_SECRET configured and signer ${signer.slice(0, 8)}… is not on mainnet.`,
    )
  }

  return { feePayer: signer, usedFunder: false }
}
