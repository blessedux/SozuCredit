import { describe, expect, it, vi } from "vitest"
import { mapProviderStatus, reconcileOrder } from "@/lib/ramp/reconcile"
import type { RampProvider } from "@/lib/ramp/provider"
import type { RampOrderRow } from "@/lib/ramp/types"

describe("mapProviderStatus — on-ramp", () => {
  it("awaiting_payment + provider funded → funded", () => {
    expect(mapProviderStatus("on", "awaiting_payment", "funded")).toBe("funded")
  })
  it("awaiting_payment + provider completed → funded (forward happens after the claim)", () => {
    expect(mapProviderStatus("on", "awaiting_payment", "completed")).toBe("funded")
  })
  it("terminal provider failures map to refunded/failed", () => {
    expect(mapProviderStatus("on", "awaiting_payment", "refunded")).toBe("refunded")
    expect(mapProviderStatus("on", "funded", "failed")).toBe("failed")
  })
  it("no-op when nothing changed", () => {
    expect(mapProviderStatus("on", "awaiting_payment", "created")).toBeNull()
  })
})

describe("mapProviderStatus — off-ramp", () => {
  it("settling + provider funded/completed/finalized → completed", () => {
    expect(mapProviderStatus("off", "settling", "funded")).toBe("completed")
    expect(mapProviderStatus("off", "settling", "completed")).toBe("completed")
    expect(mapProviderStatus("off", "settling", "finalized")).toBe("completed")
  })
  it("provider refund while settling → refunded", () => {
    expect(mapProviderStatus("off", "settling", "refunded")).toBe("refunded")
  })
  it("never resurrects a terminal row", () => {
    expect(mapProviderStatus("off", "completed", "refunded")).toBeNull()
  })
})

const mocks = vi.hoisted(() => ({
  transitionRampOrder: vi.fn(),
  claimOrderForSettlement: vi.fn(),
  claimSettlingRetry: vi.fn(),
  sendTreasuryUsdcToUser: vi.fn(),
}))

vi.mock("@/lib/db/ramp", () => ({
  transitionRampOrder: mocks.transitionRampOrder,
  claimOrderForSettlement: mocks.claimOrderForSettlement,
  claimSettlingRetry: mocks.claimSettlingRetry,
}))

vi.mock("@/lib/ramp/settlement", () => ({
  sendTreasuryUsdcToUser: mocks.sendTreasuryUsdcToUser,
}))

const SETTLEMENT_LEASE_MS = 5 * 60_000

const baseOrder: RampOrderRow = {
  id: "order-1",
  user_id: "user-1",
  provider: "etherfuse",
  direction: "on",
  status: "funded",
  fiat_currency: "BRL",
  fiat_amount_minor: 10_000,
  usdc_minor: 0,
  fx_rate: 5,
  fee_minor: 100,
  provider_order_id: "prov-order-1",
  user_tx_hash: null,
  settlement_tx_hash: null,
  settlement_claimed_at: null,
  destination_stellar_address: "GDESTINATIONADDR",
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

function makeProvider(status: string, amountTokens: string | null): RampProvider {
  return {
    getOrder: vi.fn().mockResolvedValue({
      orderId: baseOrder.provider_order_id,
      status,
      txHash: null,
      amountTokens,
    }),
  } as unknown as RampProvider
}

describe("reconcileOrder — funded → settling claim + forward", () => {
  it("(a) claim wins → forwards once → completed with the settlement hash", async () => {
    mocks.claimOrderForSettlement.mockReset().mockResolvedValue({
      ...baseOrder, status: "settling", settlement_claimed_at: "2026-01-01T00:00:01Z",
    })
    mocks.sendTreasuryUsdcToUser.mockReset().mockResolvedValue({ txHash: "TXHASH_A" })
    mocks.transitionRampOrder.mockReset().mockResolvedValue({
      ...baseOrder, status: "completed", settlement_tx_hash: "TXHASH_A", usdc_minor: 123_456_789,
    })
    mocks.claimSettlingRetry.mockReset()

    const provider = makeProvider("completed", "12.3456789")
    const result = await reconcileOrder(baseOrder, provider)

    expect(mocks.claimOrderForSettlement).toHaveBeenCalledTimes(1)
    expect(mocks.claimOrderForSettlement).toHaveBeenCalledWith("order-1")
    expect(mocks.sendTreasuryUsdcToUser).toHaveBeenCalledTimes(1)
    expect(mocks.sendTreasuryUsdcToUser).toHaveBeenCalledWith({
      toAddress: "GDESTINATIONADDR", amountMinor: 123_456_789,
    })
    expect(mocks.claimSettlingRetry).not.toHaveBeenCalled()
    expect(result.status).toBe("completed")
    expect(result.settlement_tx_hash).toBe("TXHASH_A")
  })

  it("(b) claim loses (race) → never sends", async () => {
    mocks.claimOrderForSettlement.mockReset().mockResolvedValue(null)
    mocks.sendTreasuryUsdcToUser.mockReset()
    mocks.transitionRampOrder.mockReset()
    mocks.claimSettlingRetry.mockReset()

    const provider = makeProvider("completed", "12.3456789")
    const result = await reconcileOrder(baseOrder, provider)

    expect(mocks.claimOrderForSettlement).toHaveBeenCalledTimes(1)
    expect(mocks.claimOrderForSettlement).toHaveBeenCalledWith("order-1")
    expect(mocks.sendTreasuryUsdcToUser).not.toHaveBeenCalled()
    expect(result.status).toBe("funded")
  })

  it("(e) send throws → row stays settling, no completed transition, no double-send in the same pass", async () => {
    const claimedRow: RampOrderRow = {
      ...baseOrder, status: "settling", settlement_claimed_at: "2026-01-01T00:00:01Z",
    }
    mocks.claimOrderForSettlement.mockReset().mockResolvedValue(claimedRow)
    mocks.sendTreasuryUsdcToUser.mockReset().mockRejectedValue(new Error("soroban rpc down"))
    mocks.transitionRampOrder.mockReset()
    // The lease `claimOrderForSettlement` just stamped is fresh, so a
    // same-pass re-claim attempt loses — this is what actually prevents the
    // double-send, not the try/catch alone.
    mocks.claimSettlingRetry.mockReset().mockResolvedValue(null)

    const provider = makeProvider("completed", "12.3456789")
    const result = await reconcileOrder(baseOrder, provider)

    expect(mocks.sendTreasuryUsdcToUser).toHaveBeenCalledTimes(1)
    expect(mocks.transitionRampOrder).not.toHaveBeenCalledWith(
      "order-1", ["settling"], "completed", expect.anything(),
    )
    expect(result.status).toBe("settling")
    expect(result.settlement_tx_hash).toBeNull()
  })
})

describe("reconcileOrder — settling retry (previously-failed forward)", () => {
  const settlingOrder: RampOrderRow = {
    ...baseOrder, status: "settling", settlement_tx_hash: null, settlement_claimed_at: null,
  }

  it("(c) claimSettlingRetry wins → forwards once → completed", async () => {
    mocks.claimSettlingRetry.mockReset().mockResolvedValue({
      ...settlingOrder, settlement_claimed_at: "2026-01-01T00:05:00Z",
    })
    mocks.sendTreasuryUsdcToUser.mockReset().mockResolvedValue({ txHash: "TXHASH_C" })
    mocks.transitionRampOrder.mockReset().mockResolvedValue({
      ...settlingOrder, status: "completed", settlement_tx_hash: "TXHASH_C", usdc_minor: 123_456_789,
    })
    mocks.claimOrderForSettlement.mockReset()

    const provider = makeProvider("completed", "12.3456789")
    const result = await reconcileOrder(settlingOrder, provider)

    expect(mocks.claimOrderForSettlement).not.toHaveBeenCalled()
    expect(mocks.claimSettlingRetry).toHaveBeenCalledTimes(1)
    expect(mocks.claimSettlingRetry).toHaveBeenCalledWith("order-1", SETTLEMENT_LEASE_MS)
    expect(mocks.sendTreasuryUsdcToUser).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("completed")
    expect(result.settlement_tx_hash).toBe("TXHASH_C")
  })

  it("(d) claimSettlingRetry loses (another owner still holds the lease) → never sends", async () => {
    mocks.claimSettlingRetry.mockReset().mockResolvedValue(null)
    mocks.sendTreasuryUsdcToUser.mockReset()
    mocks.transitionRampOrder.mockReset()
    mocks.claimOrderForSettlement.mockReset()

    const provider = makeProvider("completed", "12.3456789")
    const result = await reconcileOrder(settlingOrder, provider)

    expect(mocks.claimSettlingRetry).toHaveBeenCalledTimes(1)
    expect(mocks.claimSettlingRetry).toHaveBeenCalledWith("order-1", SETTLEMENT_LEASE_MS)
    expect(mocks.sendTreasuryUsdcToUser).not.toHaveBeenCalled()
    expect(result.status).toBe("settling")
  })
})
