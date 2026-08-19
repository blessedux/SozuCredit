import { describe, expect, it } from "vitest"
import { getDefaultAssetRegistry } from "@/lib/stellar/asset-registry-core"
import {
  CIRCLE_TESTNET_USDC_SAC_ID,
  DEFAULT_TESTNET_PIZZA_TOKEN_ID,
  PIZZA_ASSET_ID,
  PIZZA_DECIMALS,
  PIZZA_SYMBOL,
  pizzaBalanceToShow,
  pizzaHopFlag,
} from "@/lib/stellar/pizza-token"

describe("pizzaBalanceToShow", () => {
  it("hides the PIZZA row at balance 0", () => {
    expect(
      pizzaBalanceToShow([
        { assetId: PIZZA_ASSET_ID, symbol: PIZZA_SYMBOL, balance: 0 },
      ]),
    ).toBeNull()
  })

  it("hides fractional dust below 1", () => {
    expect(
      pizzaBalanceToShow([{ assetId: PIZZA_ASSET_ID, symbol: PIZZA_SYMBOL, balance: 0.0000001 }]),
    ).toBeNull()
  })

  it("shows a whole-pizza count when balance is at least 1", () => {
    expect(
      pizzaBalanceToShow([{ assetId: PIZZA_ASSET_ID, symbol: PIZZA_SYMBOL, balance: 1 }]),
    ).toBe(1)
    expect(
      pizzaBalanceToShow([{ assetId: PIZZA_ASSET_ID, symbol: PIZZA_SYMBOL, balance: 20 }]),
    ).toBe(20)
  })

  it("ignores USDC rows", () => {
    expect(
      pizzaBalanceToShow([{ assetId: "circle_usdc_sac", symbol: "USDC", balance: 12 }]),
    ).toBeNull()
  })
})

describe("pizzaHopFlag", () => {
  it("is 0 when hidden and 1 when the guest can redeem", () => {
    expect(pizzaHopFlag(pizzaBalanceToShow([]))).toBe("0")
    expect(pizzaHopFlag(1)).toBe("1")
  })
})

describe("default PizzaToken registry entry", () => {
  it("registers PIZZA on testnet with 0 decimals and not the Circle USDC SAC", () => {
    const pizza = getDefaultAssetRegistry("testnet").find((a) => a.id === PIZZA_ASSET_ID)
    expect(pizza).toBeDefined()
    expect(pizza?.symbol).toBe(PIZZA_SYMBOL)
    expect(pizza?.decimals).toBe(PIZZA_DECIMALS)
    expect(pizza?.category).toBe("sku")
    expect(pizza?.contractId).toBe(DEFAULT_TESTNET_PIZZA_TOKEN_ID)
    expect(pizza?.contractId).not.toBe(CIRCLE_TESTNET_USDC_SAC_ID)
  })

  it("does not register PIZZA on mainnet", () => {
    expect(getDefaultAssetRegistry("mainnet").some((a) => a.id === PIZZA_ASSET_ID)).toBe(false)
  })
})
