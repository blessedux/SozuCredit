import "server-only"

import { Address, xdr } from "@stellar/stellar-sdk"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { getAssetRegistry } from "@/lib/stellar/asset-registry"
import { getStellarConfig } from "@/lib/turnkey/config"
import type { StellarNetwork } from "@/lib/stellar/asset-types"

const STROOPS_PER_UNIT = 10_000_000
const EVENTS_PAGE_SIZE = 100
const MAX_EVENT_PAGES = 24
const LEDGER_LOOKBACK = 12_000

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

function scValSymbolText(val: xdr.ScVal): string {
  if (val.switch().name !== "scvSymbol") return ""
  const sym = val.sym() as string | Buffer | undefined
  if (typeof sym === "string") return sym
  if (Buffer.isBuffer(sym)) return sym.toString("utf8")
  return sym != null ? String(sym) : ""
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

/**
 * USDC transfer events involving the user's smart account (C…) from registered Soroban tokens.
 */
export async function getSorobanWalletTransactions(
  holderAddress: string,
  limit: number,
): Promise<SorobanWalletTransaction[]> {
  const holder = holderAddress.trim().toUpperCase()
  if (!holder.startsWith("C") || holder.length !== 56) return []

  const { network } = getStellarConfig()
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
  const endLedger = latest.sequence ?? 1
  const startLedger = Math.max(1, endLedger - LEDGER_LOOKBACK)

  const assetByContract = new Map(
    getAssetRegistry(network).map((a) => [a.contractId.trim().toUpperCase(), a.symbol]),
  )

  const byHash = new Map<string, SorobanWalletTransaction>()
  const seen = new Set<string>()

  for (const contractId of contractIds) {
    let cursor: string | undefined

    for (let page = 0; page < MAX_EVENT_PAGES; page++) {
      const res = cursor
        ? await server.getEvents({
            filters: [{ type: "contract", contractIds: [contractId] }],
            cursor,
            limit: EVENTS_PAGE_SIZE,
          })
        : await server.getEvents({
            startLedger,
            endLedger,
            filters: [{ type: "contract", contractIds: [contractId] }],
            limit: EVENTS_PAGE_SIZE,
          })

      const events = res?.events ?? []
      if (events.length === 0) break

      for (const ev of events) {
        if (!ev?.txHash || typeof ev.txHash !== "string") continue
        const topic = ev.topic
        if (!topic || !Array.isArray(topic) || topic.length < 3) continue

        let t0: xdr.ScVal | null = null
        let from: string | null = null
        let to: string | null = null
        try {
          t0 = coerceScVal(topic[0])
          const t1 = coerceScVal(topic[1])
          const t2 = coerceScVal(topic[2])
          if (t1?.switch().name === "scvAddress") {
            from = Address.fromScVal(t1).toString().toUpperCase()
          }
          if (t2?.switch().name === "scvAddress") {
            to = Address.fromScVal(t2).toString().toUpperCase()
          }
        } catch {
          continue
        }

        if (!t0 || scValSymbolText(t0) !== "transfer") continue
        if (!from || !to) continue
        if (from !== holder && to !== holder) continue

        const dedupeKey = `${ev.txHash}:${from}:${to}:${contractId}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)

        const val = coerceScVal(ev.value)
        const amount = val ? stroopsToAmount(scValI128ToBigInt(val)) : 0
        const asset = assetByContract.get(contractId) ?? "USDC"
        const createdAt =
          typeof ev.ledgerClosedAt === "string" && ev.ledgerClosedAt
            ? ev.ledgerClosedAt
            : new Date().toISOString()

        const existing = byHash.get(ev.txHash)
        if (existing) {
          existing.operations.push({ type: "payment", from, to, amount, asset })
          continue
        }

        byHash.set(ev.txHash, {
          id: ev.txHash,
          hash: ev.txHash,
          createdAt,
          successful: true,
          memo: null,
          operations: [{ type: "payment", from, to, amount, asset }],
        })
      }

      if (byHash.size >= limit) break

      cursor = typeof res.cursor === "string" && res.cursor.length > 0 ? res.cursor : undefined
      if (!cursor) break
    }

    if (byHash.size >= limit) break
  }

  return Array.from(byHash.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}
