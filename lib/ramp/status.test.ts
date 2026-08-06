import { describe, expect, it } from "vitest"
import { canTransition } from "@/lib/ramp/types"

describe("canTransition", () => {
  it("allows the forward on-ramp path", () => {
    expect(canTransition("awaiting_payment", "funded")).toBe(true)
    expect(canTransition("funded", "settling")).toBe(true)
    expect(canTransition("settling", "completed")).toBe(true)
  })
  it("allows failure/refund from non-terminal states only", () => {
    expect(canTransition("awaiting_payment", "refunded")).toBe(true)
    expect(canTransition("completed", "refunded")).toBe(false)
    expect(canTransition("failed", "completed")).toBe(false)
  })
  it("never moves backwards", () => {
    expect(canTransition("funded", "awaiting_payment")).toBe(false)
    expect(canTransition("completed", "settling")).toBe(false)
  })
})
