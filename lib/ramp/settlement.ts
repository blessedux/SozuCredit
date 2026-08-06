import "server-only"

/**
 * Treasury hop for the Etherfuse ramp. Etherfuse only speaks classic Stellar
 * payments against G accounts; Sozu users hold USDC in C-address smart
 * accounts. This module is the only place that knows how ramp funds cross
 * that boundary (same isolation contract as lib/faucet/send-payment.ts):
 *  - on-ramp: Etherfuse pays the treasury G; sendTreasuryUsdcToUser forwards
 *    to the user's C via SAC transfer.
 *  - off-ramp: the user's C→treasury leg is submitted elsewhere;
 *    sendAnchorPayment relays treasury G → Etherfuse anchor with the
 *    order's 32-byte hash memo (wrong/absent memo = auto-refund).
 */

import {
  Address,
  Asset,
  Contract,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk"
import { Api } from "@stellar/stellar-sdk/rpc"
import { getAssetById, getBlendUsdcAsset } from "@/lib/stellar/asset-registry"
import { ensureTestnetAccountFunded } from "@/lib/stellar/soroban-fee-payer"
import { getStellarConfig } from "@/lib/turnkey/config"
import { getEtherfuseConfig } from "@/lib/ramp/config"
import { minorToDecimalString } from "@/lib/ramp/decimal"

export function getRampTreasuryKeypair(): Keypair {
  const secret =
    process.env.RAMP_TREASURY_SECRET?.trim() ||
    process.env.FAUCET_TREASURY_SECRET?.trim() ||
    process.env.STELLAR_FUNDER_SECRET?.trim()
  if (!secret) {
    throw new Error("Ramp treasury not configured. Set RAMP_TREASURY_SECRET (or FAUCET_TREASURY_SECRET / STELLAR_FUNDER_SECRET).")
  }
  try {
    return Keypair.fromSecret(secret)
  } catch {
    throw new Error("RAMP_TREASURY_SECRET is not a valid Stellar secret key.")
  }
}

export function decodeAnchorMemo(memoBase64: string): Buffer {
  const bytes = Buffer.from(memoBase64, "base64")
  // Round-trip check: Buffer.from silently tolerates garbage.
  if (bytes.toString("base64") !== memoBase64.replace(/=+$/, "") + "=".repeat((4 - (memoBase64.replace(/=+$/, "").length % 4)) % 4)) {
    throw new Error("withdrawMemo is not valid base64")
  }
  if (bytes.length !== 32) {
    throw new Error(`withdrawMemo must decode to exactly 32 bytes, got ${bytes.length}`)
  }
  return bytes
}

function getSorobanRpcUrl(network: "testnet" | "mainnet"): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "testnet" ? "https://soroban-testnet.stellar.org" : "https://soroban.stellar.org")
  )
}

/** Circle USDC SAC contract for the network — same resolution the off-ramp order build uses. */
export function getUsdcSacContractId(network: "testnet" | "mainnet"): string {
  const circle = getAssetById("circle_usdc_sac", network)
  if (circle) return circle.contractId
  return getBlendUsdcAsset(network).contractId
}

async function waitForSorobanResult(server: rpc.Server, hash: string, maxAttempts = 45): Promise<"SUCCESS" | "FAILED" | "PENDING"> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const tx = await server.getTransaction(hash)
      if (tx.status === Api.GetTransactionStatus.SUCCESS) return "SUCCESS"
      if (tx.status === Api.GetTransactionStatus.FAILED) return "FAILED"
    } catch { /* NOT_FOUND — keep polling */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return "PENDING"
}

/** SAC transfer treasury G → user address (C or G), amount in USDC minor units. */
export async function sendTreasuryUsdcToUser(params: { toAddress: string; amountMinor: number }): Promise<{ txHash: string }> {
  const network = getStellarConfig().network as "testnet" | "mainnet"
  const treasury = getRampTreasuryKeypair()
  if (network === "testnet") await ensureTestnetAccountFunded(treasury.publicKey())

  const server = new rpc.Server(getSorobanRpcUrl(network), { allowHttp: network === "testnet" })
  const account = await server.getAccount(treasury.publicKey())
  const token = new Contract(getUsdcSacContractId(network))
  const op = token.call(
    "transfer",
    Address.fromString(treasury.publicKey()).toScVal(),
    Address.fromString(params.toAddress.trim().toUpperCase()).toScVal(),
    nativeToScVal(BigInt(params.amountMinor), { type: "i128" }),
  )
  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  }).addOperation(op).setTimeout(60).build()

  const prepared = await server.prepareTransaction(rawTx)
  prepared.sign(treasury)
  const sent = await server.sendTransaction(prepared)
  if (sent.status === "ERROR" || !sent.hash) {
    throw new Error("Ramp settlement transfer rejected by Soroban RPC")
  }
  const outcome = await waitForSorobanResult(server, sent.hash)
  if (outcome !== "SUCCESS") {
    throw new Error(`Ramp settlement transfer ${outcome.toLowerCase()} (tx ${sent.hash.slice(0, 8)}…)`)
  }
  return { txHash: sent.hash }
}

/** Classic payment treasury G → Etherfuse anchor with the order's hash memo. */
export async function sendAnchorPayment(params: {
  anchorAccount: string
  memoBase64: string
  amountUsdcMinor: number
}): Promise<{ txHash: string }> {
  const cfg = getEtherfuseConfig()
  const stellarCfg = getStellarConfig()
  const memoBytes = decodeAnchorMemo(params.memoBase64)
  const treasury = getRampTreasuryKeypair()
  const horizon = new Horizon.Server(stellarCfg.horizonUrl, { allowHttp: cfg.network === "testnet" })
  const account = await horizon.loadAccount(treasury.publicKey())
  const tx = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: cfg.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(Operation.payment({
      destination: params.anchorAccount,
      asset: new Asset("USDC", cfg.usdcIssuer),
      amount: minorToDecimalString(params.amountUsdcMinor, 7),
    }))
    .addMemo(Memo.hash(memoBytes.toString("hex")))
    .setTimeout(300)
    .build()
  tx.sign(treasury)
  const res = await horizon.submitTransaction(tx)
  return { txHash: res.hash }
}
