import { describe, expect, it } from "vitest"
import {
  guestWalletAddress,
  waitForGuestWalletAddress,
} from "@/lib/pizza/wait-for-guest-wallet"

const GUEST = "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

describe("guestWalletAddress", () => {
  it("accepts C/G 56-char addresses and rejects anything else", () => {
    expect(guestWalletAddress(GUEST)).toBe(GUEST)
    expect(guestWalletAddress(`  ${GUEST.toLowerCase()}  `)).toBe(GUEST)
    expect(guestWalletAddress("GDW4KDAKWDXTTXKBJ3EPUCXQ47JOURDM3QXV623QIBNFFOO7SJT2ZQ3A")).toMatch(
      /^G[A-Z0-9]{55}$/,
    )
    expect(guestWalletAddress("")).toBeNull()
    expect(guestWalletAddress("not-a-key")).toBeNull()
  })
})

describe("waitForGuestWalletAddress", () => {
  it("does not return an address while provisioning is still in flight", async () => {
    const guest = await waitForGuestWalletAddress({
      readPublicKey: () => GUEST,
      isProvisioning: () => true,
      attempts: 2,
      intervalMs: 1,
      sleep: async () => {},
    })
    expect(guest).toBeNull()
  })

  it("returns the address once provisioning finishes", async () => {
    let pending = true
    let key: string | null = null
    const guest = await waitForGuestWalletAddress({
      readPublicKey: () => key,
      isProvisioning: () => pending,
      provision: async () => {
        key = GUEST
        pending = false
        return key
      },
      attempts: 3,
      intervalMs: 1,
      sleep: async () => {},
    })
    expect(guest).toBe(GUEST)
  })
})
