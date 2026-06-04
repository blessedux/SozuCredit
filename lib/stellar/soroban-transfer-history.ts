import "server-only"

import { Address, Horizon, xdr } from "@stellar/stellar-sdk"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { getAssetRegistry } from "@/lib/stellar/asset-registry"
import { getStellarConfig } from "@/lib/turnkey/config"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

const STROOPS_PER_UNIT = 10_000_000

export type SorobanWalletTransaction = {
  id: string
  hash: string
  createdAt: string
  successful: boolean
  memo: string | null
  operations: Array<{
    type: string
    from: string
    to: string
    amount: number
    asset: string
    assetIssuer?: string | null
  }>
}

function coerceScVal(raw: unknown): xdr.ScVal | null {
  if (raw == null) return null
  if (raw instanceof xdr.ScVal) return raw
  if (typeof raw === "string") {
    try {
      return xdr.ScVal.fromXDR(raw, "base64")
    } catch {
      return null
    }
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "switch" in raw &&
    typeof (raw as xdr.ScVal).switch === "function"
  ) {
    return raw as xdr.ScVal
  }
  return null
}

function scValI128ToBigInt(val: xdr.ScVal): bigint {
  if (val.switch().name !== "scvI128") return BigInt(0)
  const parts = val.i128()
  const lo = BigInt(parts.lo().toString())
  const hi = BigInt(parts.hi().toString())
  return (hi << BigInt(64)) + lo
}

function stroopsToAmount(stroops: bigint): number {
  return Number(stroops) / STROOPS_PER_UNIT
}

function resolveSorobanRpcUrl(network: StellarNetwork): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "mainnet"
      ? "https://soroban.stellar.org"
      : "https://soroban-testnet.stellar.org")
  )
}

type SorobanEventsRequest = {
  startLedger: number
  filters: Array<{ type: "contract"; contractIds: string[] }>
  pagination: { limit: number }
}

type SorobanEvent = {
  ledger?: number
  txHash?: string
  contractId?: string
  topic?: unknown[]
  value?: unknown
}

type SorobanEventsResponse = { events?: SorobanEvent[] }

type RpcServerWithEvents = rpc.Server & {
  getEvents: (req: SorobanEventsRequest) => Promise<SorobanEventsResponse>
}

/**
 * USDC transfer events involving the user's smart account (C…) from registered Soroban tokens.
 */
export async function getSorobanWalletTransactions(
  holderAddress: string,
  limit: number,
): Promise<SorobanWalletTransaction[]> {
  const holder = holderAddress.trim().toUpperCase()
  if (!holder.startsWith("C") || holder.length !== 56) return []

  const { network, horizonUrl } = getStellarConfig()
  const contractIds = [
    ...new Set(
      getAssetRegistry(network)
        .map((a) => a.contractId.trim().toUpperCase())
        .filter((id) => id.startsWith("C") && id.length === 56),
    ),
  ]
  if (contractIds.length === 0) return []

  const rpcUrl = resolveSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
  const latest = await server.getLatestLedger()
  const startLedger = Math.max(1, (latest.sequence ?? 1) - 4000)

  const res = await (server as unknown as RpcServerWithEvents).getEvents({
    startLedger,
    filters: [{ type: "contract", contractIds }],
    pagination: { limit: Math.min(200, Math.max(40, limit * 12)) },
  })

  const events = res?.events ?? []
  const horizon = new Horizon.Server(horizonUrl, { allowHttp: network === "testnet" })
  const dateCache = new Map<string, string>()
  const assetByContract = new Map(
    getAssetRegistry(network).map((a) => [a.contractId.trim().toUpperCase(), a.symbol]),
  )

  const byHash = new Map<string, SorobanWalletTransaction>()
  const seen = new Set<string>()

  for (const ev of events) {
    if (!ev?.txHash || typeof ev.txHash !== "string") continue
    if (!ev?.topic || !Array.isArray(ev.topic) || ev.topic.length < 3) continue

    let t0: xdr.ScVal | null = null
    let from: string | null = null
    let to: string | null = null
    try {
      t0 = coerceScVal(ev.topic[0])
      const t1 = coerceScVal(ev.topic[1])
      const t2 = coerceScVal(ev.topic[2])
      if (t1?.switch().name === "scvAddress") from = Address.fromScVal(t1).toString().toUpperCase()
      if (t2?.switch().name === "scvAddress") to = Address.fromScVal(t2).toString().toUpperCase()
    } catch {
      continue
    }

    if (!t0 || t0.switch().name !== "scvSymbol" || t0.sym() !== "transfer") continue
    if (!from || !to) continue
    if (from !== holder && to !== holder) continue

    const dedupeKey = `${ev.txHash}:${from}:${to}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const val = coerceScVal(ev.value)
    const amount = val ? stroopsToAmount(scValI128ToBigInt(val)) : 0
    const contractId = (ev.contractId ?? "").trim().toUpperCase()
    const asset = assetByContract.get(contractId) ?? "USDC"

    let createdAt = dateCache.get(ev.txHash) ?? ""
    if (!createdAt) {
      try {
        const tx = (await horizon.transactions().transaction(ev.txHash).call()) as {
          created_at?: string
        }
        createdAt = String(tx?.created_at ?? new Date().toISOString())
      } catch {
        createdAt = new Date().toISOString()
      }
      dateCache.set(ev.txHash, createdAt)
    }

    const existing = byHash.get(ev.txHash)
    if (existing) {
      existing.operations.push({
        type: "payment",
        from,
        to,
        amount,
        asset,
      })
      continue
    }

    byHash.set(ev.txHash, {
      id: ev.txHash,
      hash: ev.txHash,
      createdAt,
      successful: true,
      memo: null,
      operations: [
        {
          type: "payment",
          from,
          to,
          amount,
          asset,
        },
      ],
    })

    if (byHash.size >= limit * 2) break
  }

  return Array.from(byHash.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
