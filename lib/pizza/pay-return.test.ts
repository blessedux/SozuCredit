import { describe, expect, it } from "vitest"
import { CIRCLE_TESTNET_USDC_SAC_ID } from "@/lib/stellar/pizza-token"
import {
  appendPizzaHopParams,
  isAllowedPayReturnTo,
  resolvePizzaAuthSearch,
} from "@/lib/pizza/pay-return"

const PAY = "https://pay.sozu.capital/pay/qr/margherita-nfc"
const GUEST = "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

describe("isAllowedPayReturnTo", () => {
  it("allows pay.sozu.capital /pay paths and local pay, rejects open redirects", () => {
    expect(isAllowedPayReturnTo(`${PAY}?hopped=1`)).toBe(true)
    expect(isAllowedPayReturnTo("http://localhost:3000/pay/qr/margherita-nfc?hopped=1")).toBe(true)
    expect(isAllowedPayReturnTo("https://evil.example/pay/qr/x")).toBe(false)
    expect(isAllowedPayReturnTo("https://pay.sozu.capital/dashboard")).toBe(false)
  })
})

describe("appendPizzaHopParams", () => {
  it("stamps guest and pizza=0|1 onto the pay bounce-back", () => {
    const zero = new URL(appendPizzaHopParams(`${PAY}?hopped=1`, GUEST, null))
    expect(zero.searchParams.get("guest")).toBe(GUEST)
    expect(zero.searchParams.get("pizza")).toBe("0")
    expect(zero.searchParams.get("hopped")).toBe("1")

    const one = new URL(appendPizzaHopParams(`${PAY}?hopped=1`, GUEST, 1))
    expect(one.searchParams.get("pizza")).toBe("1")
    expect(one.toString()).not.toContain(CIRCLE_TESTNET_USDC_SAC_ID)
  })
})

describe("resolvePizzaAuthSearch", () => {
  it("reads hop vs intent from /auth query params", () => {
    expect(
      resolvePizzaAuthSearch(new URLSearchParams("return_to=" + encodeURIComponent(`${PAY}?hopped=1`))),
    ).toEqual({ kind: "hop", returnTo: `${PAY}?hopped=1` })

    const intent = resolvePizzaAuthSearch(
      new URLSearchParams(
        "intent=intent-1&return_to=" + encodeURIComponent(`${PAY}?intent=intent-1`),
      ),
    )
    expect(intent).toEqual({
      kind: "intent",
      intentId: "intent-1",
      returnTo: `${PAY}?intent=intent-1`,
    })
  })
})
