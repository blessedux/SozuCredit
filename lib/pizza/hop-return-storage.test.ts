import { describe, expect, it } from "vitest"
import {
  clearPizzaHopReturn,
  peekPizzaHopReturn,
  stashPizzaHopReturn,
} from "@/lib/pizza/hop-return-storage"

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    getItem(key: string) {
      return data[key] ?? null
    },
    setItem(key: string, value: string) {
      data[key] = value
    },
    removeItem(key: string) {
      delete data[key]
    },
  }
}

const PAY = "https://pay.sozu.capital/pay/qr/qr4?hopped=1"

describe("pizza hop return stash", () => {
  it("keeps an allowlisted pay return_to so /home can finish the hop", () => {
    const store = memoryStore()
    stashPizzaHopReturn(PAY, store)
    expect(peekPizzaHopReturn(store)).toBe(PAY)
    clearPizzaHopReturn(store)
    expect(peekPizzaHopReturn(store)).toBeNull()
  })

  it("rejects open redirects", () => {
    const store = memoryStore()
    stashPizzaHopReturn("https://evil.example/pay/qr/x", store)
    expect(peekPizzaHopReturn(store)).toBeNull()
  })
})
