import { describe, expect, it } from "vitest"
import { decimalToCents, decimalToScaled, decimalToUsdcMinor, minorToDecimalString } from "@/lib/ramp/decimal"

describe("decimalToScaled", () => {
  it("handles the 27-digit Etherfuse tail without float drift", () => {
    expect(decimalToScaled("19.620062792064687229069147940", 7, "floor")).toBe(196200627)
    expect(decimalToScaled("19.620062792064687229069147940", 7, "ceil")).toBe(196200628)
  })
  it("scales up short fractions", () => {
    expect(decimalToScaled("100", 2, "floor")).toBe(10000)
    expect(decimalToScaled("0.2", 2, "floor")).toBe(20)
  })
  it("rejects garbage", () => {
    expect(() => decimalToScaled("abc", 2, "floor")).toThrow()
    expect(() => decimalToScaled("-1", 2, "floor")).toThrow()
    expect(() => decimalToScaled("", 2, "floor")).toThrow()
  })
  it("throws on overflow past MAX_SAFE_INTEGER", () => {
    expect(() => decimalToScaled("90071992547409920", 7, "floor")).toThrow(/exceeds safe integer range/)
  })
  it("does not round up ceil on exact values with trailing zeros", () => {
    expect(decimalToScaled("1.500000", 2, "ceil")).toBe(150)
  })
})

describe("wrappers", () => {
  it("decimalToCents floors receiver amounts", () => {
    expect(decimalToCents("100.999", "floor")).toBe(10099)
  })
  it("decimalToCents ceils fees", () => {
    expect(decimalToCents("0.201", "ceil")).toBe(21)
  })
  it("decimalToUsdcMinor at scale 7", () => {
    expect(decimalToUsdcMinor("1", "floor")).toBe(10000000)
  })
})

describe("minorToDecimalString", () => {
  it("formats with full fractional width", () => {
    expect(minorToDecimalString(10050, 2)).toBe("100.50")
    expect(minorToDecimalString(100, 2)).toBe("1.00")
    expect(minorToDecimalString(10000000, 7)).toBe("1.0000000")
  })
  it("returns integer string at scale 0 (no decimal point)", () => {
    expect(minorToDecimalString(5, 0)).toBe("5")
  })
  it("rejects non-positive-safe input", () => {
    expect(() => minorToDecimalString(-1, 2)).toThrow()
    expect(() => minorToDecimalString(1.5, 2)).toThrow()
  })
})
