import "server-only"

import { createClient as createServiceClient } from "@supabase/supabase-js"
import { canTransition } from "@/lib/ramp/types"
import type { RampCustomerRow, RampDirection, RampOrderDbStatus, RampOrderRow } from "@/lib/ramp/types"

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

export async function listSettlingOrPendingOrders(provider = "etherfuse", limit = 50): Promise<RampOrderRow[]> {
  const db = getServiceClient()
  const { data, error } = await db.from("ramp_orders").select()
    .eq("provider", provider)
    .in("status", ["created", "awaiting_payment", "funded", "settling"])
    .order("created_at", { ascending: true })
    .limit(limit)
  if (error) throw new Error(`ramp_orders pending list: ${error.message}`)
  return (data ?? []) as RampOrderRow[]
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
  patch: Partial<Pick<RampOrderRow, "user_tx_hash" | "settlement_tx_hash" | "usdc_minor" | "metadata">> = {},
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
  if (error) throw new Error(`ramp_orders transition: ${error.message}`)
  return data as RampOrderRow | null
}

export function claimOrderForSettlement(id: string): Promise<RampOrderRow | null> {
  return transitionRampOrder(id, ["funded"], "settling")
}
