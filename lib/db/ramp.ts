import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import { canTransition } from "@/lib/ramp/types"
import type { RampCustomerRow, RampDirection, RampOrderDbStatus, RampOrderRow } from "@/lib/ramp/types"

/**
 * Thrown by `transitionRampOrder` when the UPDATE itself fails a DB
 * constraint (as opposed to simply matching zero rows, which returns null).
 * `code` is the Postgres SQLSTATE (e.g. `23505` unique_violation) — callers
 * use it to distinguish "someone reused this envelope's tx hash" from a
 * generic DB failure.
 */
export class RampDbConflictError extends Error {
  constructor(message: string, public readonly code: string | undefined) {
    super(message)
    this.name = "RampDbConflictError"
  }
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role not configured")
  return createServiceClient(url, key, { auth: { persistSession: false } })
}

export async function getRampCustomer(userId: string, provider = "etherfuse"): Promise<RampCustomerRow | null> {
  const db = getServiceClient()
  const { data, error } = await db.from("ramp_customers").select()
    .eq("user_id", userId).eq("provider", provider).maybeSingle()
  if (error) throw new Error(`ramp_customers select: ${error.message}`)
  return data as RampCustomerRow | null
}

export async function upsertRampCustomer(params: {
  userId: string; provider?: string; customerId: string; kycEmail: string; displayName: string
}): Promise<RampCustomerRow> {
  const db = getServiceClient()
  const { data, error } = await db.from("ramp_customers")
    .upsert({
      user_id: params.userId,
      provider: params.provider ?? "etherfuse",
      customer_id: params.customerId,
      kyc_email: params.kycEmail,
      display_name: params.displayName,
    }, { onConflict: "user_id,provider", ignoreDuplicates: true })
    .select().maybeSingle()
  if (error) throw new Error(`ramp_customers upsert: ${error.message}`)
  // ignoreDuplicates returns null when the row already existed — re-read.
  if (data) return data as RampCustomerRow
  const existing = await getRampCustomer(params.userId, params.provider ?? "etherfuse")
  if (!existing) throw new Error("ramp_customers upsert: row vanished")
  return existing
}

export async function setRampCustomerBankAccount(userId: string, provider: string, bankAccountId: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from("ramp_customers")
    .update({ bank_account_id: bankAccountId })
    .eq("user_id", userId).eq("provider", provider)
  if (error) throw new Error(`ramp_customers bank update: ${error.message}`)
}

export async function setRampCustomerWallet(userId: string, provider: string, walletId: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from("ramp_customers")
    .update({ wallet_id: walletId })
    .eq("user_id", userId).eq("provider", provider)
  if (error) throw new Error(`ramp_customers wallet update: ${error.message}`)
}

export async function createRampOrder(params: {
  userId: string; provider?: string; direction: RampDirection; status: RampOrderDbStatus
  fiatCurrency?: string; fiatAmountMinor: number; usdcMinor: number; fxRate: number; feeMinor: number
  providerOrderId: string; destinationStellarAddress?: string | null; metadata?: Record<string, unknown>
}): Promise<RampOrderRow> {
  const db = getServiceClient()
  const { data, error } = await db.from("ramp_orders").insert({
    user_id: params.userId,
    provider: params.provider ?? "etherfuse",
    direction: params.direction,
    status: params.status,
    fiat_currency: params.fiatCurrency ?? "BRL",
    fiat_amount_minor: params.fiatAmountMinor,
    usdc_minor: params.usdcMinor,
    fx_rate: params.fxRate,
    fee_minor: params.feeMinor,
    provider_order_id: params.providerOrderId,
    destination_stellar_address: params.destinationStellarAddress ?? null,
    metadata: params.metadata ?? {},
  }).select().single()
  if (error) throw new Error(`ramp_orders insert: ${error.message}`)
  return data as RampOrderRow
}

export async function getRampOrder(id: string, userId: string): Promise<RampOrderRow | null> {
  const db = getServiceClient()
  const { data, error } = await db.from("ramp_orders").select()
    .eq("id", id).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(`ramp_orders select: ${error.message}`)
  return data as RampOrderRow | null
}

/**
 * Rows newer than this are still worth polling even before any money has
 * moved (`created`/`awaiting_payment`); older abandoned intake rows (e.g. a
 * user who re-quoted an off-ramp order several times without ever signing)
 * are dropped from the sweep rather than crowding out real settlement work.
 */
const STALE_INTAKE_CUTOFF_MS = 48 * 60 * 60_000

export async function listSettlingOrPendingOrders(provider = "etherfuse", limit = 50): Promise<RampOrderRow[]> {
  const db = getServiceClient()
  // Active settlement rows are real in-flight money movements — fetch them
  // first, unbounded by age, so a backlog of abandoned created/
  // awaiting_payment rows (oldest-first) can never starve them out of a
  // capped sweep.
  const { data: active, error: activeError } = await db.from("ramp_orders").select()
    .eq("provider", provider)
    .in("status", ["funded", "settling"])
    .order("created_at", { ascending: true })
    .limit(limit)
  if (activeError) throw new Error(`ramp_orders pending list (active): ${activeError.message}`)
  const activeRows = (active ?? []) as RampOrderRow[]

  const remaining = limit - activeRows.length
  if (remaining <= 0) return activeRows

  const cutoffIso = new Date(Date.now() - STALE_INTAKE_CUTOFF_MS).toISOString()
  const { data: intake, error: intakeError } = await db.from("ramp_orders").select()
    .eq("provider", provider)
    .in("status", ["created", "awaiting_payment"])
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(remaining)
  if (intakeError) throw new Error(`ramp_orders pending list (intake): ${intakeError.message}`)

  return [...activeRows, ...((intake ?? []) as RampOrderRow[])]
}

/**
 * Guarded, atomic status transition — the settlement idempotency primitive.
 * Returns the updated row, or null when the row was not in `fromStatuses`
 * (someone else already moved it). Uses a conditional UPDATE so two
 * concurrent reconcilers can never both claim the same transition.
 */
export async function transitionRampOrder(
  id: string,
  fromStatuses: RampOrderDbStatus[],
  toStatus: RampOrderDbStatus,
  patch: Partial<Pick<RampOrderRow, "user_tx_hash" | "settlement_tx_hash" | "settlement_claimed_at" | "usdc_minor" | "metadata">> = {},
): Promise<RampOrderRow | null> {
  for (const from of fromStatuses) {
    if (!canTransition(from, toStatus)) {
      throw new Error(`illegal ramp transition ${from} → ${toStatus}`)
    }
  }
  const db = getServiceClient()
  const { data, error } = await db.from("ramp_orders")
    .update({ status: toStatus, ...patch })
    .eq("id", id)
    .in("status", fromStatuses)
    .select()
    .maybeSingle()
  if (error) {
    if (error.code === "23505") {
      throw new RampDbConflictError(`ramp_orders transition: ${error.message}`, error.code)
    }
    throw new Error(`ramp_orders transition: ${error.message}`)
  }
  return data as RampOrderRow | null
}

/**
 * Replay guard lookup: is this Soroban tx hash already recorded against some
 * order? Checked BEFORE ever calling `submitSignedSorobanEnvelope` so a
 * resubmitted envelope is rejected without a second on-chain submit attempt
 * (Soroban RPC treats a resubmitted already-applied tx as a success,
 * returning the same hash — the DB's unique index on `user_tx_hash` is the
 * authoritative guard; this is the early, network-call-avoiding half of it).
 */
export async function findRampOrderByUserTxHash(userTxHash: string): Promise<RampOrderRow | null> {
  const db = getServiceClient()
  const { data, error } = await db.from("ramp_orders").select()
    .eq("user_tx_hash", userTxHash).maybeSingle()
  if (error) throw new Error(`ramp_orders find by user_tx_hash: ${error.message}`)
  return data as RampOrderRow | null
}

export function claimOrderForSettlement(id: string): Promise<RampOrderRow | null> {
  return transitionRampOrder(id, ["funded"], "settling", { settlement_claimed_at: new Date().toISOString() })
}

/**
 * Re-claims a `settling` row with no settlement tx hash for a retry of the
 * treasury forward — the lease that makes the retry path concurrency-safe.
 * `canTransition`/`transitionRampOrder` can't express this: settling→settling
 * isn't a state change in `FORWARD`, it's a lease renewal, so this issues its
 * own guarded conditional UPDATE. Wins only when the row is unclaimed
 * (`settlement_claimed_at IS NULL`) or the previous claimant's lease is older
 * than `leaseMs` (presumed crashed) — otherwise another reconciler still owns
 * the in-flight send and this returns null.
 */
/**
 * Builds the `.or()` filter string for `claimSettlingRetry`. Exported and
 * pure so the PostgREST-quoting contract is pinned by a test: filter values
 * containing reserved characters (`,` `.` `:` `()`) MUST be double-quoted,
 * and an ISO-8601 timestamp contains both `:` and `.` — an unquoted value
 * makes PostgREST fail to parse the filter, silently disabling the retry
 * claim (fails closed, but defeats the whole retry mechanism).
 */
export function buildSettlementLeaseFilter(cutoffIso: string): string {
  return `settlement_claimed_at.is.null,settlement_claimed_at.lt."${cutoffIso}"`
}

export async function claimSettlingRetry(id: string, leaseMs: number): Promise<RampOrderRow | null> {
  const db = getServiceClient()
  const cutoffIso = new Date(Date.now() - leaseMs).toISOString()
  const { data, error } = await db.from("ramp_orders")
    .update({ settlement_claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "settling")
    .is("settlement_tx_hash", null)
    .or(buildSettlementLeaseFilter(cutoffIso))
    .select()
    .maybeSingle()
  if (error) throw new Error(`ramp_orders claim settling retry: ${error.message}`)
  return data as RampOrderRow | null
}

/** Records the treasury→anchor payment hash once sendAnchorPayment succeeds. Row must still be 'settling'. */
export async function setRampOrderSettlementTx(id: string, txHash: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from("ramp_orders")
    .update({ settlement_tx_hash: txHash })
    .eq("id", id).eq("status", "settling")
  if (error) throw new Error(`ramp_orders settlement tx update: ${error.message}`)
}
