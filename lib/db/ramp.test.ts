import { describe, expect, it } from "vitest"
import { buildSettlementLeaseFilter } from "@/lib/db/ramp"

describe("buildSettlementLeaseFilter", () => {
  it("double-quotes the cutoff timestamp — PostgREST requires quoting or-filter values with reserved characters (: and . in an ISO timestamp)", () => {
    expect(buildSettlementLeaseFilter("2026-01-01T00:00:00.000Z")).toBe(
      'settlement_claimed_at.is.null,settlement_claimed_at.lt."2026-01-01T00:00:00.000Z"',
    )
  })
})
