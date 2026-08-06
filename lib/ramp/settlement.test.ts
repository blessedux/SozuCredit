import { describe, expect, it } from "vitest"
import { decodeAnchorMemo } from "@/lib/ramp/settlement"

describe("decodeAnchorMemo", () => {
  it("accepts exactly 32 bytes", () => {
    const b64 = Buffer.alloc(32, 7).toString("base64")
    expect(decodeAnchorMemo(b64).length).toBe(32)
  })
  it("rejects any other length — a memo-less/wrong-memo payment is auto-refunded by Etherfuse", () => {
    expect(() => decodeAnchorMemo(Buffer.alloc(31).toString("base64"))).toThrow(/32/)
    expect(() => decodeAnchorMemo(Buffer.alloc(33).toString("base64"))).toThrow(/32/)
    expect(() => decodeAnchorMemo("!!!not-base64!!!")).toThrow()
  })
})
