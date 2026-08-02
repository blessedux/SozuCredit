import { describe, expect, it } from "vitest"
import {
  buildFaucetReturnWithToken,
  parseAllowlistedFaucetReturnUrl,
  parseFaucetHandoffAuthReturn,
} from "./return-allowlist"

describe("parseAllowlistedFaucetReturnUrl", () => {
  it("accepts production and local faucet origins", () => {
    expect(parseAllowlistedFaucetReturnUrl("https://faucet.sozu.capital/")?.origin).toBe(
      "https://faucet.sozu.capital",
    )
    expect(parseAllowlistedFaucetReturnUrl("http://localhost:3010/")?.origin).toBe(
      "http://localhost:3010",
    )
    expect(parseAllowlistedFaucetReturnUrl("http://127.0.0.1:3010/")?.origin).toBe(
      "http://127.0.0.1:3010",
    )
  })

  it("rejects open redirects and non-http schemes", () => {
    expect(parseAllowlistedFaucetReturnUrl("https://evil.example/")).toBeNull()
    expect(parseAllowlistedFaucetReturnUrl("javascript:alert(1)")).toBeNull()
    expect(parseAllowlistedFaucetReturnUrl("/relative")).toBeNull()
    expect(parseAllowlistedFaucetReturnUrl("http://user:pass@localhost:3010/")).toBeNull()
  })
})

describe("parseFaucetHandoffAuthReturn", () => {
  it("accepts relative handoff paths with allowlisted faucet return", () => {
    const path = parseFaucetHandoffAuthReturn(
      `/auth/faucet-handoff?return=${encodeURIComponent("http://localhost:3010/")}`,
    )
    expect(path).toBe(
      `/auth/faucet-handoff?return=${encodeURIComponent("http://localhost:3010/")}`,
    )
  })

  it("rejects handoff paths whose faucet return is not allowlisted", () => {
    expect(
      parseFaucetHandoffAuthReturn(
        `/auth/faucet-handoff?return=${encodeURIComponent("https://evil.example/")}`,
      ),
    ).toBeNull()
  })
})

describe("buildFaucetReturnWithToken", () => {
  it("sets token and preserves other query params", () => {
    const url = buildFaucetReturnWithToken(
      new URL("http://localhost:3010/?utm=1"),
      "abc.def.ghi",
    )
    const parsed = new URL(url)
    expect(parsed.searchParams.get("token")).toBe("abc.def.ghi")
    expect(parsed.searchParams.get("utm")).toBe("1")
  })
})
