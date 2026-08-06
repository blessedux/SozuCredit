import { beforeAll, describe, expect, it } from "vitest"
import { Keypair } from "@stellar/stellar-sdk"
import { decodeAnchorMemo, deriveUserRampKeypair } from "@/lib/ramp/settlement"

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

describe("deriveUserRampKeypair", () => {
  // Dummy testnet treasury secret so getRampTreasuryKeypair() resolves —
  // never a real secret, just a random Keypair for the HMAC master key.
  beforeAll(() => {
    process.env.RAMP_TREASURY_SECRET = Keypair.random().secret()
  })

  it("is deterministic — the same userId derives the same publicKey every call", () => {
    const a = deriveUserRampKeypair("user-1").publicKey()
    const b = deriveUserRampKeypair("user-1").publicKey()
    expect(a).toBe(b)
  })

  it("derives a different publicKey for a different userId — Etherfuse rejects a shared wallet across organizations", () => {
    const a = deriveUserRampKeypair("user-1").publicKey()
    const b = deriveUserRampKeypair("user-2").publicKey()
    expect(a).not.toBe(b)
  })

  it("returns a valid classic G strkey", () => {
    const pk = deriveUserRampKeypair("user-1").publicKey()
    expect(pk).toMatch(/^G[A-Z0-9]{55}$/)
    expect(() => Keypair.fromPublicKey(pk)).not.toThrow()
  })
})
