import { describe, expect, it } from "vitest"
import {
  AUTH_ENTRY_KEEP_QUERY_MARKERS,
  authRoutingInlineScript,
  shouldBounceAuthedAuthToHome,
} from "@/lib/client-auth-gate"

const QR4_HOP_SEARCH =
  "?return_to=" + encodeURIComponent("https://pay.sozu.capital/pay/qr/qr4?hopped=1")

function runAuthRouting(opts: {
  pathname: string
  search: string
  authed: boolean
}): string | null {
  let replaced: string | null = null
  const location = {
    pathname: opts.pathname,
    search: opts.search,
    hash: "",
    replace(url: string) {
      replaced = url
    },
  }
  const store = {
    getItem(key: string) {
      if (!opts.authed) return null
      if (key === "dev_authenticated") return "true"
      if (key === "dev_username") return "user-abc"
      return null
    },
  }
  const run = new Function(
    "location",
    "localStorage",
    "sessionStorage",
    authRoutingInlineScript(),
  )
  run(location, store, store)
  return replaced
}

describe("shouldBounceAuthedAuthToHome", () => {
  it("bounces a bare signed-in /auth visit to home", () => {
    expect(shouldBounceAuthedAuthToHome("/auth", "")).toBe(true)
    expect(shouldBounceAuthedAuthToHome("/auth", "?")).toBe(true)
  })

  it("keeps the qr4 pizza hop on /auth instead of sending the PWA to /home", () => {
    expect(shouldBounceAuthedAuthToHome("/auth", QR4_HOP_SEARCH)).toBe(false)
  })

  it("keeps redeem intent and checkout redirect", () => {
    expect(shouldBounceAuthedAuthToHome("/auth", "?intent=abc_intent_01")).toBe(false)
    expect(shouldBounceAuthedAuthToHome("/auth", "?redirect=/checkout/cs_test")).toBe(false)
  })

  it("still keeps faucet, SDP invite, and add-device", () => {
    expect(shouldBounceAuthedAuthToHome("/auth", "?faucet=1")).toBe(false)
    expect(shouldBounceAuthedAuthToHome("/auth", "?sdpInvite=1")).toBe(false)
    expect(shouldBounceAuthedAuthToHome("/auth/add-device", "")).toBe(false)
  })
})

describe("authRoutingInlineScript", () => {
  it("embeds every keep-on-auth query marker", () => {
    const script = authRoutingInlineScript()
    for (const marker of AUTH_ENTRY_KEEP_QUERY_MARKERS) {
      expect(script).toContain(JSON.stringify(marker))
    }
  })

  it("does not replace /home when a signed-in PWA opens the qr4 pay hop", () => {
    expect(
      runAuthRouting({
        pathname: "/auth",
        search: QR4_HOP_SEARCH,
        authed: true,
      }),
    ).toBeNull()
  })

  it("still sends a signed-in bare /auth visit to /home", () => {
    expect(runAuthRouting({ pathname: "/auth", search: "", authed: true })).toBe("/home")
  })

  it("sends an unauthenticated wallet path to /auth with search intact", () => {
    expect(
      runAuthRouting({
        pathname: "/home",
        search: QR4_HOP_SEARCH,
        authed: false,
      }),
    ).toBe(`/auth${QR4_HOP_SEARCH}`)
  })
})
