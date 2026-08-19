import { describe, expect, it } from "vitest"
import { CIRCLE_TESTNET_USDC_SAC_ID, DEFAULT_TESTNET_PIZZA_TOKEN_ID } from "@/lib/stellar/pizza-token"
import { isPizzaAssetRow, parseWholeTokenAmount } from "@/lib/stellar/sku-send"

describe("parseWholeTokenAmount", () => {
  it("accepts 1 PIZZA and rejects USDC-style decimals", () => {
    expect(parseWholeTokenAmount("1")).toBe(1)
    expect(parseWholeTokenAmount("20")).toBe(20)
    expect(parseWholeTokenAmount("1.0")).toBeNull()
    expect(parseWholeTokenAmount("0")).toBeNull()
    expect(parseWholeTokenAmount("0.0000001")).toBeNull()
  })
})

describe("isPizzaAssetRow", () => {
  it("identifies PizzaToken and not Circle USDC", () => {
    expect(isPizzaAssetRow({ assetId: "pizza_token", contractId: DEFAULT_TESTNET_PIZZA_TOKEN_ID })).toBe(true)
    expect(
      isPizzaAssetRow({ assetId: "circle_usdc_sac", symbol: "USDC", contractId: CIRCLE_TESTNET_USDC_SAC_ID }),
    ).toBe(false)
  })
})
