import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { formatUsdcMinor } from "@/lib/deposits/quote";
import type { DepositIntent, DepositIntentPublic, DepositMethod, DepositStatus } from "@/lib/deposits/types";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role not configured");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export function toPublic(row: DepositIntent): DepositIntentPublic {
  return {
    id: row.id,
    method: row.method,
    amount_clp: row.amount_clp,
    usdc_amount: formatUsdcMinor(row.quoted_usdc_minor),
    fx_clp_per_usdc: Number(row.fx_clp_per_usdc),
    status: row.status,
    bank_reference: row.bank_reference,
    stellar_tx_hash: row.stellar_tx_hash,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function createDepositIntent(params: {
  userId: string;
  method: DepositMethod;
  amountClp: number;
  quotedUsdcMinor: number;
  fxClpPerUsdc: number;
  destinationStellarAddress: string;
  bankReference: string | null;
  sumupCheckoutId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<DepositIntent> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("deposit_intents")
    .insert({
      user_id: params.userId,
      method: params.method,
      amount_clp: params.amountClp,
      quoted_usdc_minor: params.quotedUsdcMinor,
      fx_clp_per_usdc: params.fxClpPerUsdc,
      status: "awaiting_payment" as DepositStatus,
      destination_stellar_address: params.destinationStellarAddress,
      bank_reference: params.bankReference,
      sumup_checkout_id: params.sumupCheckoutId ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw new Error(`deposit_intents insert: ${error.message}`);
  return data as DepositIntent;
}

export async function getDepositIntentBySumupCheckoutId(
  checkoutId: string,
): Promise<DepositIntent | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("deposit_intents")
    .select()
    .eq("sumup_checkout_id", checkoutId)
    .maybeSingle();

  if (error) throw new Error(`deposit_intents sumup lookup: ${error.message}`);
  return (data as DepositIntent | null);
}

export async function markDepositPaymentReceived(params: {
  intentId: string;
  sumupTransactionId?: string | null;
  metadataPatch?: Record<string, unknown>;
  nextStatus?: DepositStatus;
}): Promise<DepositIntent | null> {
  const db = getServiceClient();
  const nextStatus = params.nextStatus ?? "payment_received";

  const { data: row, error: readErr } = await db
    .from("deposit_intents")
    .select("metadata, status")
    .eq("id", params.intentId)
    .maybeSingle();

  if (readErr) throw new Error(`deposit_intents read: ${readErr.message}`);
  if (!row) return null;

  const currentStatus = row.status as DepositStatus;
  if (currentStatus !== "awaiting_payment" && currentStatus !== "created") {
    return null;
  }

  const merged = {
    ...(row.metadata as Record<string, unknown> ?? {}),
    ...(params.metadataPatch ?? {}),
  };

  const { data, error } = await db
    .from("deposit_intents")
    .update({
      status: nextStatus,
      sumup_transaction_id: params.sumupTransactionId ?? null,
      metadata: merged,
    })
    .eq("id", params.intentId)
    .select()
    .single();

  if (error) throw new Error(`deposit_intents payment update: ${error.message}`);
  return data as DepositIntent;
}

export async function attachSumUpCheckout(
  intentId: string,
  userId: string,
  sumupCheckoutId: string,
  metadataPatch?: Record<string, unknown>,
): Promise<DepositIntent> {
  const db = getServiceClient();

  const { data: row, error: readErr } = await db
    .from("deposit_intents")
    .select("metadata")
    .eq("id", intentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) throw new Error(`deposit_intents read: ${readErr.message}`);
  if (!row) throw new Error("Intent not found");

  const merged = {
    ...(row.metadata as Record<string, unknown> ?? {}),
    ...(metadataPatch ?? {}),
  };

  const { data, error } = await db
    .from("deposit_intents")
    .update({
      sumup_checkout_id: sumupCheckoutId,
      metadata: merged,
    })
    .eq("id", intentId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`deposit_intents sumup attach: ${error.message}`);
  return data as DepositIntent;
}

export async function getDepositIntentById(
  id: string,
  userId: string,
): Promise<DepositIntent | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("deposit_intents")
    .select()
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`deposit_intents select: ${error.message}`);
  return (data as DepositIntent | null);
}

export async function listDepositIntentsByUser(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<DepositIntent[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("deposit_intents")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`deposit_intents list: ${error.message}`);
  return (data ?? []) as DepositIntent[];
}

/** Append arbitrary metadata (e.g. user-submitted proof reference). Keeps existing keys. */
export async function mergeDepositIntentMetadata(
  id: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const db = getServiceClient();

  // Read current metadata first so we can merge.
  const { data: row, error: readErr } = await db
    .from("deposit_intents")
    .select("metadata")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "awaiting_payment")
    .maybeSingle();

  if (readErr) throw new Error(`deposit_intents read: ${readErr.message}`);
  if (!row) throw new Error("Intent not found or not in awaiting_payment state");

  const merged = { ...(row.metadata as Record<string, unknown> ?? {}), ...patch };

  const { error: updateErr } = await db
    .from("deposit_intents")
    .update({ metadata: merged })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "awaiting_payment");

  if (updateErr) throw new Error(`deposit_intents update: ${updateErr.message}`);
}
