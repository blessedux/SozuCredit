import type { TreasuryProjection } from "./types"

export type PurchasingPowerPoint = {
  day: number
  /** Short x-axis label */
  label: string
  /** Cumulative purchasing-power gain in reference fiat */
  total: number
  yield: number
  inflation: number
  fx: number
  /** Daily increment (local fiat) */
  dailyDelta: number
  /** Cumulative gain as % of starting local balance */
  totalPct: number
}

function axisLabel(day: number, periodDays: number, showAllDays: boolean): string {
  if (day === 0) return "Hoy"
  if (day === periodDays) return `+${day}d`
  if (showAllDays) return `+${day}d`
  if (periodDays <= 14) return day % 2 === 0 || day === periodDays ? `+${day}d` : ""
  if (periodDays <= 30) return day % 5 === 0 || day === periodDays ? `+${day}d` : ""
  return day % 10 === 0 || day === periodDays ? `+${day}d` : ""
}

/** Deterministic seed from projection inputs — stable wiggles per wallet/window. */
function seriesSeed(projection: TreasuryProjection): number {
  const { balanceUsdc, spotFxRate } = projection.audit
  return (
    Math.abs(Math.sin(balanceUsdc * 12.9898 + spotFxRate * 78.233)) * 43758.5453
  ) % 1
}

/** Small organic daily variation; returns multiplier ~0.92–1.08 */
function dailyVariation(day: number, seed: number): number {
  if (day <= 0) return 1
  const a = Math.sin(day * 0.85 + seed * 6.283) * 0.045
  const b = Math.cos(day * 1.65 + seed * 3.17) * 0.035
  const c = Math.sin(day * 2.35 + seed * 9.11) * 0.02
  return 1 + a + b + c
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(n * factor) / factor
}

function decimalsForBalance(balanceLocal: number): number {
  return balanceLocal >= 1000 ? 0 : 2
}

/** Layer values at day N using compound yield + curved FX accrual. */
function layersAtDay(
  day: number,
  periodDays: number,
  balanceUsdc: number,
  balanceLocal: number,
  spotFxRate: number,
  merchantApy: number,
  annualInflationPct: number,
  fxChangePeriodPct: number,
) {
  const dailyYieldRate = merchantApy / 100 / 365
  const yieldUsd =
    day <= 0 ? 0 : balanceUsdc * (Math.pow(1 + dailyYieldRate, day) - 1)
  const yieldLocal = yieldUsd * spotFxRate

  const inflationLocal =
    balanceLocal * (annualInflationPct / 100) * (day / 365)

  const fxProgress = periodDays > 0 ? Math.pow(day / periodDays, 1.12) : 0
  const fxLocal = balanceLocal * (fxChangePeriodPct / 100) * fxProgress

  return { yieldLocal, inflationLocal, fxLocal }
}

/** Daily cumulative purchasing-power PNL with realistic micro-structure. */
export function buildPurchasingPowerSeries(projection: TreasuryProjection): PurchasingPowerPoint[] {
  const { periodDays, merchantApy, audit, total } = projection
  const { balanceUsdc, spotFxRate, annualInflationPct, fxChangePeriodPct } = audit
  const balanceLocal = balanceUsdc * spotFxRate
  const dec = decimalsForBalance(balanceLocal)
  const showAllDays = periodDays <= 14
  const seed = seriesSeed(projection)

  const base: PurchasingPowerPoint[] = []

  for (let day = 0; day <= periodDays; day++) {
    const { yieldLocal, inflationLocal, fxLocal } = layersAtDay(
      day,
      periodDays,
      balanceUsdc,
      balanceLocal,
      spotFxRate,
      merchantApy,
      annualInflationPct,
      fxChangePeriodPct,
    )
    const layerTotal = yieldLocal + inflationLocal + fxLocal

    base.push({
      day,
      label: axisLabel(day, periodDays, showAllDays),
      total: round(layerTotal, dec),
      yield: round(yieldLocal, dec),
      inflation: round(inflationLocal, dec),
      fx: round(fxLocal, dec),
      dailyDelta: 0,
      totalPct: balanceLocal > 0 ? round((layerTotal / balanceLocal) * 100, 2) : 0,
    })
  }

  if (periodDays <= 1) {
    if (base[1]) base[1].dailyDelta = base[1].total
    return normalizeSeriesEnd(base, total.amountLocal, dec, balanceLocal)
  }

  // Organic daily deltas that preserve the projection endpoint.
  const rawDeltas: number[] = []
  for (let day = 1; day <= periodDays; day++) {
    const prev = base[day - 1].total
    const curr = base[day].total
    rawDeltas.push(curr - prev)
  }

  const noisyDeltas = rawDeltas.map((delta, idx) => {
    const day = idx + 1
    return delta * dailyVariation(day, seed)
  })

  const targetGain = total.amountLocal
  const noisySum = noisyDeltas.reduce((sum, d) => sum + d, 0)
  const scale = noisySum !== 0 ? targetGain / noisySum : 1

  const points: PurchasingPowerPoint[] = [base[0]]
  let cumulative = 0

  for (let day = 1; day <= periodDays; day++) {
    const delta = round(noisyDeltas[day - 1] * scale, dec)
    cumulative = round(cumulative + delta, dec)

    const basePoint = base[day]
    const ratio = basePoint.total > 0 ? cumulative / basePoint.total : 1

    points.push({
      day,
      label: axisLabel(day, periodDays, showAllDays),
      total: cumulative,
      yield: round(basePoint.yield * ratio, dec),
      inflation: round(basePoint.inflation * ratio, dec),
      fx: round(basePoint.fx * ratio, dec),
      dailyDelta: delta,
      totalPct: balanceLocal > 0 ? round((cumulative / balanceLocal) * 100, 2) : 0,
    })
  }

  return points
}

function normalizeSeriesEnd(
  points: PurchasingPowerPoint[],
  targetTotal: number,
  dec: number,
  balanceLocal: number,
): PurchasingPowerPoint[] {
  if (points.length === 0) return points
  const last = points[points.length - 1]
  if (last.total === targetTotal) return points

  const ratio = last.total > 0 ? targetTotal / last.total : 1
  return points.map((p, idx) => ({
    ...p,
    total: idx === points.length - 1 ? round(targetTotal, dec) : round(p.total * ratio, dec),
    yield: round(p.yield * ratio, dec),
    inflation: round(p.inflation * ratio, dec),
    fx: round(p.fx * ratio, dec),
    totalPct: balanceLocal > 0 ? round(((idx === points.length - 1 ? targetTotal : p.total * ratio) / balanceLocal) * 100, 2) : 0,
  }))
}
