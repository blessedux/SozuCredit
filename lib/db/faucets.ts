import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import type {
  FaucetAvailability,
  FaucetClaimRow,
  FaucetClaimStatus,
  FaucetPublic,
  FaucetRow,
} from "@/lib/faucet/types";

/** Per-wallet cooldown. Override with FAUCET_USER_COOLDOWN_HOURS (0 disables — testing only). */
function userCooldownHours(): number {
  const raw = process.env.FAUCET_USER_COOLDOWN_HOURS?.trim();
  if (raw === undefined || raw === "") return 24;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 24;
}

/** Non-negative numeric env override, else the per-faucet DB value. */
function envNumberOverride(envKey: string, dbValue: number): number {
  const raw = process.env[envKey]?.trim();
  if (raw === undefined || raw === "") return dbValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : dbValue;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role not configured");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

/** Supabase returns numeric columns as strings — normalize once here. */
function parseFaucetRow(row: Record<string, unknown>): FaucetRow {
  return {
    ...(row as unknown as FaucetRow),
    lat: Number(row.lat),
    lng: Number(row.lng),
    daily_limit: Number(row.daily_limit),
    claim_amount: Number(row.claim_amount),
    cooldown_minutes: Number(row.cooldown_minutes),
  };
}

export function toPublicFaucet(row: FaucetRow): FaucetPublic {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    locationName: row.location_name,
    lat: row.lat,
    lng: row.lng,
    claimAmount: row.claim_amount,
    dailyLimit: row.daily_limit,
    status: row.status,
  };
}

export async function getFaucetBySlug(slug: string): Promise<FaucetRow | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("faucets")
    .select()
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`faucets select: ${error.message}`);
  return data ? parseFaucetRow(data) : null;
}

export async function listActiveFaucets(): Promise<FaucetRow[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("faucets")
    .select()
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`faucets list: ${error.message}`);
  return (data ?? []).map(parseFaucetRow);
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nextUtcMidnight(now: Date): Date {
  const start = startOfUtcDay(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * V1 abuse rules, evaluated in order:
 *   1. faucet inactive
 *   2. daily budget exhausted (pending + success claims count against budget)
 *   3. global faucet cooldown since last non-failed claim
 *   4. wallet/user cooldown (24h) — only when wallet/user provided
 *
 * Env overrides (testing / per-deployment tuning, take precedence over DB):
 *   FAUCET_DAILY_LIMIT, FAUCET_GLOBAL_COOLDOWN_MINUTES, FAUCET_USER_COOLDOWN_HOURS
 */
export async function computeFaucetAvailability(
  faucet: FaucetRow,
  opts: { walletAddress?: string | null; userId?: string | null } = {},
): Promise<FaucetAvailability> {
  const db = getServiceClient();
  const now = new Date();
  const dayStart = startOfUtcDay(now).toISOString();

  const dailyLimit = envNumberOverride("FAUCET_DAILY_LIMIT", faucet.daily_limit);
  const cooldownMinutes = envNumberOverride(
    "FAUCET_GLOBAL_COOLDOWN_MINUTES",
    faucet.cooldown_minutes,
  );

  if (faucet.status !== "active") {
    return { available: false, reason: "inactive", remainingToday: 0 };
  }

  // Daily budget: pending claims also reserve budget to narrow the double-spend race.
  const { data: todayClaims, error: todayErr } = await db
    .from("faucet_claims")
    .select("amount, status")
    .eq("faucet_id", faucet.id)
    .in("status", ["pending", "success"])
    .gte("claimed_at", dayStart);

  if (todayErr) throw new Error(`faucet_claims daily: ${todayErr.message}`);

  const claimedToday = (todayClaims ?? []).reduce(
    (sum, c) => sum + Number(c.amount),
    0,
  );
  const remainingToday = Math.max(0, dailyLimit - claimedToday);

  if (remainingToday < faucet.claim_amount) {
    return {
      available: false,
      reason: "empty_today",
      remainingToday,
      nextAvailableAt: nextUtcMidnight(now).toISOString(),
    };
  }

  // Global faucet cooldown.
  if (cooldownMinutes > 0) {
    const { data: lastClaim, error: lastErr } = await db
      .from("faucet_claims")
      .select("claimed_at")
      .eq("faucet_id", faucet.id)
      .in("status", ["pending", "success"])
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) throw new Error(`faucet_claims last: ${lastErr.message}`);

    if (lastClaim) {
      const readyAt =
        new Date(lastClaim.claimed_at).getTime() + cooldownMinutes * 60_000;
      if (readyAt > now.getTime()) {
        return {
          available: false,
          reason: "global_cooldown",
          remainingToday,
          nextAvailableAt: new Date(readyAt).toISOString(),
        };
      }
    }
  }

  // Wallet / user cooldown (any faucet, last N hours; 0 disables for testing).
  const cooldownHours = userCooldownHours();
  const wallet = opts.walletAddress?.trim().toUpperCase();
  const userId = opts.userId?.trim();
  if (cooldownHours > 0 && (wallet || userId)) {
    const since = new Date(
      now.getTime() - cooldownHours * 60 * 60 * 1000,
    ).toISOString();

    let query = db
      .from("faucet_claims")
      .select("claimed_at")
      .in("status", ["pending", "success"])
      .gte("claimed_at", since)
      .order("claimed_at", { ascending: false })
      .limit(1);

    query = wallet && userId
      ? query.or(`wallet_address.eq.${wallet},user_id.eq.${userId}`)
      : wallet
        ? query.eq("wallet_address", wallet)
        : query.eq("user_id", userId!);

    const { data: userClaim, error: userErr } = await query.maybeSingle();
    if (userErr) throw new Error(`faucet_claims user: ${userErr.message}`);

    if (userClaim) {
      const readyAt =
        new Date(userClaim.claimed_at).getTime() +
        cooldownHours * 60 * 60 * 1000;
      return {
        available: false,
        reason: "user_cooldown",
        remainingToday,
        nextAvailableAt: new Date(readyAt).toISOString(),
      };
    }
  }

  return { available: true, remainingToday };
}

export async function createPendingClaim(params: {
  faucetId: string;
  userId: string;
  walletAddress: string;
  amount: number;
  ipHash?: string | null;
  userAgentHash?: string | null;
}): Promise<FaucetClaimRow> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("faucet_claims")
    .insert({
      faucet_id: params.faucetId,
      user_id: params.userId,
      wallet_address: params.walletAddress.trim().toUpperCase(),
      amount: params.amount,
      status: "pending" as FaucetClaimStatus,
      ip_hash: params.ipHash ?? null,
      user_agent_hash: params.userAgentHash ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`faucet_claims insert: ${error.message}`);
  return data as FaucetClaimRow;
}

export async function finalizeClaim(params: {
  claimId: string;
  status: Exclude<FaucetClaimStatus, "pending">;
  txHash?: string | null;
}): Promise<void> {
  const db = getServiceClient();
  const { error } = await db
    .from("faucet_claims")
    .update({
      status: params.status,
      tx_hash: params.txHash ?? null,
    })
    .eq("id", params.claimId);

  if (error) throw new Error(`faucet_claims finalize: ${error.message}`);
}
