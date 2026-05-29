/**
 * Mock annual CPI inflation rates by reference fiat.
 *
 * Phase 1 (mock): static values representing approximate recent annual rates.
 * Phase 2 (live): replace getInflationRate() with a live CPI API call.
 *   Sources: BCCh for CLP, INDEC for ARS, IBGE for BRL, DANE for COP,
 *            or a curated monthly CPI feed (e.g. IMF WEO).
 */

import type { ReferenceFiat } from "./types"

/** Annual inflation rate as a percent (e.g. 4.5 = 4.5%) */
const MOCK_INFLATION: Record<ReferenceFiat, number> = {
  CLP: 4.5,   // Banco Central de Chile target range
  ARS: 80.0,  // Argentina — high-frequency devaluation environment
  BRL: 4.0,   // Banco do Brasil target range
  COP: 5.0,   // Banco de la República Colombia
}

/**
 * Return annual inflation percent for a reference fiat.
 *
 * @phase2 — replace with live CPI API fetch; keep this as fallback.
 */
export function getInflationRate(fiat: ReferenceFiat): number {
  return MOCK_INFLATION[fiat] ?? 4.5
}
