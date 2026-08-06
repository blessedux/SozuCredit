import { describe, expect, it, vi } from "vitest"
import { generateKeyPairSync } from "node:crypto"
import { createEtherfuseProvider } from "@/lib/ramp/etherfuse/client"
import { RampProviderError } from "@/lib/ramp/provider"

const pem = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" }).toString()

function makeProvider(fetchFn: typeof fetch) {
  return createEtherfuseProvider({
    apiKey: "api_sand:k:o",
    apiBaseUrl: "https://api.sand.etherfuse.com",
    dashboardBaseUrl: "https://sandbox.etherfuse.com",
    blockchain: "stellar",
    assetId: "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    jwtIssuer: "https://issuer.example",
    jwtKid: "kid-1",
    jwtPrivateKeyPem: pem,
    fetchFn,
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? "" : JSON.stringify(body), { status })
}

describe("createEtherfuseProvider", () => {
  it("sends the RAW api key — no Bearer prefix", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ status: "approved" }))
    await makeProvider(fetchFn as unknown as typeof fetch).getKycStatus("cid")
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe("api_sand:k:o")
  })

  it("maps a bare-string error body into RampProviderError with the call's reason", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse("Organization must be approved before adding a bank account", 409))
    const p = makeProvider(fetchFn as unknown as typeof fetch)
    await expect(
      p.registerBankAccount("cid", {
        transactionId: "t", firstName: "A", lastName: "B",
        cpf: "00000000000", pixKey: "x@y.z", pixKeyType: "email",
      }),
    ).rejects.toMatchObject({
      name: "RampProviderError",
      reason: "bank_account_registration_failed",
    })
  })

  it("falls back to the raw text body for a non-JSON (text/plain) error — sandbox E2E finding", async () => {
    const fetchFn = vi.fn(async () =>
      new Response("Organization must be approved before adding a bank account", {
        status: 409,
        headers: { "Content-Type": "text/plain" },
      }))
    const p = makeProvider(fetchFn as unknown as typeof fetch)
    await expect(
      p.registerBankAccount("cid", {
        transactionId: "t", firstName: "A", lastName: "B",
        cpf: "00000000000", pixKey: "x@y.z", pixKeyType: "email",
      }),
    ).rejects.toMatchObject({
      name: "RampProviderError",
      reason: "bank_account_registration_failed",
      message: "Organization must be approved before adding a bank account",
    })
  })

  it("never throws when a non-2xx body is neither valid JSON nor readable text", async () => {
    // A minimal Response-like stand-in whose body reading always fails —
    // simulates a genuinely broken/errored stream, distinct from the normal
    // "valid text, invalid JSON" case above. The defensive fallback must
    // still resolve to a RampProviderError, never an unhandled rejection.
    const brokenRes = {
      ok: false,
      status: 500,
      json: async () => { throw new Error("body stream errored") },
      clone: () => ({ text: async () => { throw new Error("body stream errored") } }),
    }
    const fetchFn = vi.fn(async () => brokenRes as unknown as Response)
    const p = makeProvider(fetchFn as unknown as typeof fetch)
    await expect(
      p.registerBankAccount("cid", {
        transactionId: "t", firstName: "A", lastName: "B",
        cpf: "00000000000", pixKey: "x@y.z", pixKeyType: "email",
      }),
    ).rejects.toBeInstanceOf(RampProviderError)
  })

  it("tolerates the empty 200 body of fiat_received", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 200 }))
    await expect(
      makeProvider(fetchFn as unknown as typeof fetch).simulateFiatReceived("oid"),
    ).resolves.toBeUndefined()
  })

  it("nests bank fields under account and sets claimOwnership on wallets", async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body ? JSON.parse(init.body as string) : undefined })
      if (url.includes("bank-account")) return jsonResponse({ bankAccountId: "b1" })
      return jsonResponse({ walletId: "w1" })
    })
    const p = makeProvider(fetchFn as unknown as typeof fetch)
    await p.registerBankAccount("cid", {
      transactionId: "t", firstName: "A", lastName: "B",
      cpf: "00000000000", pixKey: "x@y.z", pixKeyType: "email",
    })
    await p.registerWallet("cid", "GTREASURY")
    expect((calls[0].body as { account: unknown }).account).toBeDefined()
    expect(calls[1].body).toMatchObject({ publicKey: "GTREASURY", blockchain: "stellar", claimOwnership: true })
  })

  it("rejects an anchor off-ramp order whose memo type is not hash", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ offramp: { orderId: "o", withdrawAnchorAccount: "G...", withdrawMemo: "aaa", withdrawMemoType: "text" } }))
    await expect(
      makeProvider(fetchFn as unknown as typeof fetch).createAnchorOfframpOrder({
        orderId: "o", quoteId: "q", bankAccountId: "b", cryptoWalletId: "w",
      }),
    ).rejects.toBeInstanceOf(RampProviderError)
  })

  it("maps quote decimals exactly (floor amounts, ceil fee)", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        quoteId: "q", sourceAmount: "100",
        destinationAmount: "19.620062792064687229069147940",
        expiresAt: "2026-08-03T15:09:22.823414202Z",
        exchangeRate: "0.1959394590264675335384349581",
        feeAmount: "0.201",
      }))
    const quote = await makeProvider(fetchFn as unknown as typeof fetch).createOnrampQuote({
      customerId: "c", walletAddress: "G...", amountFiat: "100",
    })
    expect(quote.senderAmountCents).toBe(10000)
    expect(quote.receiverAmountCents).toBe(1962)
    expect(quote.flatFeeCents).toBe(21)
  })

  it("surfaces unknown order statuses as provider errors", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ orderId: "o", status: "weird" }))
    await expect(
      makeProvider(fetchFn as unknown as typeof fetch).getOrder("o"),
    ).rejects.toBeInstanceOf(RampProviderError)
  })
})
