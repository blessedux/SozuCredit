import "server-only";

import { fetchFxRateToUsd } from "@/lib/ledger/fx-fetch";

export type ClpOracleQuote = {
  /** CLP per 1 USDC (after optional spread). */
  clpPerUsdc: number;
  /** Raw spot before spread. */
  spotClpPerUsdc: number;
  source: string;
  fetchedAt: string;
  spreadBps: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { quote: ClpOracleQuote; expiresAt: number } | null = null;

function envFallbackRate(): number {
  const raw = process.env.DEPOSIT_FX_CLP_PER_USDC;
  const rate = raw ? parseFloat(raw) : NaN;
  return !isNaN(rate) && rate > 0 ? rate : 950;
}

function spreadBps(): number {
  const raw = process.env.DEPOSIT_FX_SPREAD_BPS;
  const bps = raw ? parseInt(raw, 10) : 100;
  return Number.isFinite(bps) && bps >= 0 ? bps : 100;
}

function applySpread(spot: number, bps: number): number {
  return spot * (1 + bps / 10_000);
}

/** Chile central-bank style USD observation (CLP per USD). */
async function fetchMindicadorClpPerUsd(): Promise<number> {
  const res = await fetch("https://mindicador.cl/api/dolar", {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`mindicador ${res.status}`);
  const data = (await res.json()) as { valor?: number };
  if (typeof data.valor !== "number" || data.valor <= 0) {
    throw new Error("mindicador parse error");
  }
  return data.valor;
}

async function fetchSpotClpPerUsdc(): Promise<{ spot: number; source: string }> {
  // 1) Frankfurter (ECB) — CLP may be unsupported; try first when available.
  try {
    const { rate, source } = await fetchFxRateToUsd("CLP");
    if (rate > 0) {
      return { spot: 1 / rate, source: `${source}:CLP/USD` };
    }
  } catch {
    // fall through
  }

  // 2) mindicador.cl — primary for Chile deployments.
  try {
    const spot = await fetchMindicadorClpPerUsd();
    return { spot, source: "mindicador.cl:dolar" };
  } catch {
    // fall through
  }

  // 3) Static ops override.
  const fallback = envFallbackRate();
  return { spot: fallback, source: "env:DEPOSIT_FX_CLP_PER_USDC" };
}

/**
 * Live CLP/USDC quote for deposit quoting.
 * USDC ≈ USD. Cached 5 minutes; spread applied via DEPOSIT_FX_SPREAD_BPS (default 100 = 1%).
 */
export async function getClpOracleQuote(forceRefresh = false): Promise<ClpOracleQuote> {
  const now = Date.now();
  if (!forceRefresh && cache && cache.expiresAt > now) {
    return cache.quote;
  }

  const bps = spreadBps();
  const { spot, source } = await fetchSpotClpPerUsdc();
  const quote: ClpOracleQuote = {
    spotClpPerUsdc: spot,
    clpPerUsdc: applySpread(spot, bps),
    source,
    fetchedAt: new Date().toISOString(),
    spreadBps: bps,
  };

  cache = { quote, expiresAt: now + CACHE_TTL_MS };
  return quote;
}

/** Invalidate cache after ops manually bumps DEPOSIT_FX_CLP_PER_USDC (tests). */
export function clearClpOracleCache(): void {
  cache = null;
}
