import { getClpOracleQuote } from "./clp-oracle";
import { USDC_MINOR_SCALE } from "./types";

/**
 * @deprecated Use getDepositFxRateAsync for live oracle quotes.
 * Sync fallback for legacy callers / tests.
 */
export function getDepositFxRate(): number {
  const raw = process.env.DEPOSIT_FX_CLP_PER_USDC;
  const rate = raw ? parseFloat(raw) : NaN;
  if (isNaN(rate) || rate <= 0) return 950;
  return rate;
}

/** Live CLP-per-USDC rate (oracle + spread). */
export async function getDepositFxRateAsync(): Promise<{
  rate: number;
  source: string;
  spotClpPerUsdc: number;
  spreadBps: number;
  fetchedAt: string;
}> {
  const q = await getClpOracleQuote();
  return {
    rate: q.clpPerUsdc,
    source: q.source,
    spotClpPerUsdc: q.spotClpPerUsdc,
    spreadBps: q.spreadBps,
    fetchedAt: q.fetchedAt,
  };
}

/**
 * Converts a CLP amount to USDC minor units using the given rate.
 * Rounds down to avoid over-crediting.
 */
export function clpToUsdcMinor(amountClp: number, fxClpPerUsdc: number): number {
  if (fxClpPerUsdc <= 0) return 0;
  const usdc = amountClp / fxClpPerUsdc;
  return Math.floor(usdc * USDC_MINOR_SCALE);
}

/**
 * Formats USDC minor units as a human-readable string, e.g. "10.5000000".
 */
export function formatUsdcMinor(minor: number): string {
  return (minor / USDC_MINOR_SCALE).toFixed(7);
}
