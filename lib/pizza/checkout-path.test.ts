import { describe, expect, it } from "vitest"
import { pizzaCheckoutPathFromPayReturn } from "@/lib/pizza/checkout-path"

describe("pizzaCheckoutPathFromPayReturn", () => {
  it("maps a pay QR return_to onto the wallet store-checkout path", () => {
    expect(
      pizzaCheckoutPathFromPayReturn("https://pay.sozu.capital/pay/qr/margherita-nfc?hopped=1"),
    ).toBe("/checkout/pizza/margherita-nfc")
  })

  it("returns null for non-pay QR paths", () => {
    expect(pizzaCheckoutPathFromPayReturn("https://pay.sozu.capital/dashboard")).toBeNull()
    expect(pizzaCheckoutPathFromPayReturn("not-a-url")).toBeNull()
  })
})
