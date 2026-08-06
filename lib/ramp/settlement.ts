import "server-only"

/**
 * Treasury hop for the Etherfuse ramp. Etherfuse only speaks classic Stellar
 * payments against G accounts; Sozu users hold USDC in C-address smart
 * accounts. This module is the only place that knows how ramp funds cross
 * that boundary (same isolation contract as lib/faucet/send-payment.ts):
 *  - on-ramp: Etherfuse pays the user's per-user ramp G; sendRampUsdcToUser
 *    forwards from that G to the user's C via SAC transfer.
 *  - off-ramp: the user's C→per-user-G leg is submitted elsewhere;
 *    sendAnchorPayment relays that per-user G → Etherfuse anchor with the
 *    order's 32-byte hash memo (wrong/absent memo = auto-refund).
 *
 * Etherfuse rejects registering the SAME classic G as the wallet for more
 * than one organization ("This wallet is claimed by another organization" —
 * proven in a live sandbox E2E). Every customer therefore gets a unique,
 * deterministically-derived G (see deriveUserRampKeypair) instead of the
 * shared treasury G.
 */

import { createHmac } from "node:crypto"
import {
  Address,
  Asset,
  Contract,
  Horizon,
  Keypair,
  Memo,
  Networks,
  NotFoundError,
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

/**
 * Deterministically derives a per-user classic Stellar G from the treasury
 * master secret + userId (HMAC-SHA256). Etherfuse rejects reusing one G
 * across organizations ("This wallet is claimed by another organization" —
 * proven in a live sandbox E2E), so every customer needs a UNIQUE wallet.
 * No per-user secret is ever stored: this function re-derives the same
 * keypair server-side, on demand, from the already-configured treasury
 * secret — so signing works without a new secrets-storage surface.
 *
 * WARNING: this makes RAMP_TREASURY_SECRET a MASTER KEY, not just a funding
 * source — every per-user G is a deterministic function of it. Rotating
 * RAMP_TREASURY_SECRET silently re-derives a DIFFERENT G for every existing
 * customer, stranding any USDC resting on their old (now unreachable)
 * per-user G. It must never be rotated without a sweep-first migration
 * (drain every known per-user G under the old secret before switching).
 */
export function deriveUserRampKeypair(userId: string): Keypair {
  const master = getRampTreasuryKeypair().rawSecretKey()
  const seed = createHmac("sha256", master).update(`sozu-ramp-g-v1:${userId}`).digest()
  return Keypair.fromRawEd25519Seed(seed)
}

/**
 * Idempotent AND concurrency-safe provisioning for a per-user ramp G:
 * Etherfuse pays USDC to (and, for off-ramp, expects a payment signed from)
 * this account, so it needs XLM for fees and a USDC trustline before it can
 * be registered as a customer's wallet. Safe to call on every
 * onboarding/order attempt — including multiple concurrent calls for the
 * SAME user racing each other. Each step self-heals on failure by
 * re-checking Horizon rather than trusting its own write: if two calls both
 * see "no account" and both try to fund, the loser's funding attempt fails
 * (testnet: friendbot answers non-2xx for an already-funded address;
 * mainnet: `op_already_exists`) but then observes the winner's account on
 * Horizon and proceeds instead of surfacing a transient error. Same pattern
 * for the trustline. Only throws if, after that re-check, the account
 * genuinely still doesn't exist / the trustline is genuinely still absent.
 */
export async function ensureUserRampAccount(userId: string): Promise<{ publicKey: string }> {
  const kp = deriveUserRampKeypair(userId)
  const publicKey = kp.publicKey()
  const stellarCfg = getStellarConfig()
  const cfg = getEtherfuseConfig()
  const horizon = new Horizon.Server(stellarCfg.horizonUrl, { allowHttp: cfg.network === "testnet" })
  const networkPassphrase = cfg.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

  async function tryLoadAccount(): Promise<Horizon.AccountResponse | null> {
    try {
      return await horizon.loadAccount(publicKey)
    } catch (e) {
      if (e instanceof NotFoundError) return null
      throw e
    }
  }

  const hasUsdcTrustline = (acc: Horizon.AccountResponse) => {
    const usdc = new Asset("USDC", cfg.usdcIssuer)
    return acc.balances.some((b) => {
      if (!("asset_code" in b) || !("asset_issuer" in b)) return false
      return b.asset_code === usdc.getCode() && b.asset_issuer === usdc.getIssuer()
    })
  }

  let account = await tryLoadAccount()

  if (!account) {
    try {
      if (cfg.network === "testnet") {
        const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`)
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          throw new Error(
            `Could not fund ramp account ${publicKey.slice(0, 8)}… via friendbot (${res.status}). ${body.slice(0, 200)}`,
          )
        }
      } else {
        const treasury = getRampTreasuryKeypair()
        const treasuryAccount = await horizon.loadAccount(treasury.publicKey())
        const fundTx = new TransactionBuilder(treasuryAccount, {
          fee: "10000",
          networkPassphrase,
        })
          .addOperation(Operation.createAccount({ destination: publicKey, startingBalance: "3" }))
          .setTimeout(300)
          .build()
        fundTx.sign(treasury)
        await horizon.submitTransaction(fundTx)
      }
    } catch (fundErr) {
      // Concurrency self-heal: a parallel ensureUserRampAccount call for the
      // SAME user may have funded this exact account between our existence
      // check above and this attempt. Re-check Horizon before surfacing what
      // would otherwise be a transient 500 — only rethrow if the account
      // genuinely isn't there.
      const reloaded = await tryLoadAccount()
      if (!reloaded) throw fundErr
    }
    account = await tryLoadAccount()
    if (!account) {
      throw new Error(`Ramp account ${publicKey.slice(0, 8)}… still missing after a funding attempt.`)
    }
  }

  if (!hasUsdcTrustline(account)) {
    try {
      const trustTx = new TransactionBuilder(account, {
        fee: "10000",
        networkPassphrase,
      })
        .addOperation(Operation.changeTrust({ asset: new Asset("USDC", cfg.usdcIssuer) }))
        .setTimeout(300)
        .build()
      trustTx.sign(kp)
      await horizon.submitTransaction(trustTx)
    } catch (trustErr) {
      // Same race, one step later: a concurrent call may have already opened
      // the trustline between our check above and this submit — re-load and
      // accept if it's there now, rather than surfacing a transient error.
      const reloaded = await tryLoadAccount()
      if (!reloaded || !hasUsdcTrustline(reloaded)) throw trustErr
    }
  }

  return { publicKey }
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

/**
 * SAC transfer per-user ramp G → user address (C or G), amount in USDC minor
 * units. The USDC being forwarded already sits on the per-user G — Etherfuse
 * settled it there directly — so the transfer's source/signer is the
 * per-user keypair, never the treasury.
 */
export async function sendRampUsdcToUser(params: {
  userId: string
  toAddress: string
  amountMinor: number
}): Promise<{ txHash: string }> {
  const network = getStellarConfig().network as "testnet" | "mainnet"
  const userKp = deriveUserRampKeypair(params.userId)
  if (network === "testnet") await ensureTestnetAccountFunded(userKp.publicKey())

  const server = new rpc.Server(getSorobanRpcUrl(network), { allowHttp: network === "testnet" })
  const account = await server.getAccount(userKp.publicKey())
  const token = new Contract(getUsdcSacContractId(network))
  const op = token.call(
    "transfer",
    Address.fromString(userKp.publicKey()).toScVal(),
    Address.fromString(params.toAddress.trim().toUpperCase()).toScVal(),
    nativeToScVal(BigInt(params.amountMinor), { type: "i128" }),
  )
  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  }).addOperation(op).setTimeout(60).build()

  const prepared = await server.prepareTransaction(rawTx)
  prepared.sign(userKp)
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

/** Classic payment per-user ramp G → Etherfuse anchor with the order's hash memo. */
export async function sendAnchorPayment(params: {
  userId: string
  anchorAccount: string
  memoBase64: string
  amountUsdcMinor: number
}): Promise<{ txHash: string }> {
  const cfg = getEtherfuseConfig()
  const stellarCfg = getStellarConfig()
  const memoBytes = decodeAnchorMemo(params.memoBase64)
  const userKp = deriveUserRampKeypair(params.userId)
  const horizon = new Horizon.Server(stellarCfg.horizonUrl, { allowHttp: cfg.network === "testnet" })
  const account = await horizon.loadAccount(userKp.publicKey())
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
  tx.sign(userKp)
  const res = await horizon.submitTransaction(tx)
  return { txHash: res.hash }
}
