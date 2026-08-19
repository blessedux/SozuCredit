import { describe, expect, it } from "vitest"
import { isUsdcSpendableCategory } from "@/lib/stellar/asset-types"
import {
  canCoverSendAmount,
  maxSingleTokenBalance,
  pickTokenRowForSend,
  totalSpendableFromPayload,
  type ApiTokenBalanceRow,
} from "@/lib/stellar/spendable-balance-client"
import { CIRCLE_TESTNET_USDC_SAC_ID, DEFAULT_TESTNET_PIZZA_TOKEN_ID } from "@/lib/stellar/pizza-token"

const sac: ApiTokenBalanceRow = {
  assetId: "circle_usdc_sac",
  contractId: CIRCLE_TESTNET_USDC_SAC_ID,
  symbol: "USDC",
  displayName: "Circle USDC",
  decimals: 7,
  balance: 5,
  category: "stablecoin",
  sendPriority: 5,
}

const pizza: ApiTokenBalanceRow = {
  assetId: "pizza_token",
  contractId: DEFAULT_TESTNET_PIZZA_TOKEN_ID,
  symbol: "PIZZA",
  displayName: "Pizza",
  decimals: 0,
  balance: 20,
  category: "sku",
  sendPriority: 90,
}

describe("PIZZA vs USDC spendable", () => {
  it("does not treat sku as a USDC send rail", () => {
    expect(isUsdcSpendableCategory("sku")).toBe(false)
    expect(isUsdcSpendableCategory("stablecoin")).toBe(true)
  })

  it("does not add PIZZA into USDC spendable totals", () => {
    const payload = { tokenBalances: [sac, pizza] }
    expect(totalSpendableFromPayload(payload)).toBe(5)
    expect(maxSingleTokenBalance(payload)).toBe(5)
  })

  it("does not auto-pick PIZZA when sending 1 USDC", () => {
    const picked = pickTokenRowForSend([sac, pizza], 1)
    expect(picked?.contractId).toBe(CIRCLE_TESTNET_USDC_SAC_ID)
    expect(picked?.contractId).not.toBe(DEFAULT_TESTNET_PIZZA_TOKEN_ID)
  })

  it("will not cover a USDC send from PIZZA alone", () => {
    const cover = canCoverSendAmount({ tokenBalances: [pizza] }, 1)
    expect(cover.ok).toBe(false)
  })

  it("picks PIZZA only when the caller names the contract", () => {
    const picked = pickTokenRowForSend([sac, pizza], 1, DEFAULT_TESTNET_PIZZA_TOKEN_ID)
    expect(picked?.symbol).toBe("PIZZA")
    expect(picked?.contractId).not.toBe(CIRCLE_TESTNET_USDC_SAC_ID)
  })
})
