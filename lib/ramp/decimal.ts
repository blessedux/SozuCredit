/**
 * Exact decimal-string ↔ integer-minor-unit conversion for ramp providers.
 * Etherfuse amounts arrive as decimal strings, sometimes with a 27-digit tail
 * ("19.620062792064687229069147940") — a float parse would silently lose the
 * tail, so everything below is BigInt arithmetic.
 * Rounding policy: floor anything the user RECEIVES, ceil fees.
 */

function parseDecimal(value: string): { digits: bigint; scale: number } {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(value.trim())
  if (!match) {
    throw new Error(`expected a non-negative decimal string, got ${JSON.stringify(value)}`)
  }
  const fraction = match[2] ?? ""
  return { digits: BigInt(`${match[1]}${fraction}`), scale: fraction.length }
}

export function decimalToScaled(value: string, scale: number, mode: "floor" | "ceil"): number {
  const { digits, scale: valueScale } = parseDecimal(value)
  let result: bigint
  if (valueScale <= scale) {
    result = digits * BigInt("1" + "0".repeat(scale - valueScale))
  } else {
    const divisor = BigInt("1" + "0".repeat(valueScale - scale))
    const truncated = digits / divisor
    const hasRemainder = digits % divisor > BigInt(0)
    result = mode === "ceil" && hasRemainder ? truncated + BigInt(1) : truncated
  }
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Scaled value exceeds safe integer range: ${value} at scale ${scale}`)
  }
  return Number(result)
}

export function decimalToCents(value: string, mode: "floor" | "ceil"): number {
  return decimalToScaled(value, 2, mode)
}

export function decimalToUsdcMinor(value: string, mode: "floor" | "ceil"): number {
  return decimalToScaled(value, 7, mode)
}

export function minorToDecimalString(minor: number, scale: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error(`expected a non-negative integer, got ${minor}`)
  }
  if (scale === 0) return String(minor)
  const s = String(minor).padStart(scale + 1, "0")
  return `${s.slice(0, s.length - scale)}.${s.slice(s.length - scale)}`
}
