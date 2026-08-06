import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildKycLaunchJwt } from "@/lib/ramp/etherfuse/kyc-jwt"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()

const params = {
  customerId: "11111111-2222-3333-4444-555555555555",
  email: "user@example.com",
  displayName: "Test User",
  jwtIssuer: "https://issuer.example",
  jwtKid: "kid-1",
  jwtPrivateKeyPem: pem,
  apiBaseUrl: "https://api.sand.etherfuse.com",
  dashboardBaseUrl: "https://sandbox.etherfuse.com",
}

function decodeSegment(seg: string) {
  return JSON.parse(Buffer.from(seg, "base64url").toString())
}

describe("buildKycLaunchJwt", () => {
  it("returns launch shape with dashboard action URL and /idv target", () => {
    const launch = buildKycLaunchJwt(params)
    expect(launch.actionUrl).toBe("https://sandbox.etherfuse.com/auth/launch")
    expect(launch.target).toBe("/idv")
  })

  it("emits a valid RS256 JWT with the required claims", () => {
    const launch = buildKycLaunchJwt(params)
    const [h, p, s] = launch.assertion.split(".")
    const header = decodeSegment(h)
    expect(header).toMatchObject({ alg: "RS256", typ: "JWT", kid: "kid-1" })
    const payload = decodeSegment(p)
    expect(payload).toMatchObject({
      iss: "https://issuer.example",
      sub: params.customerId,
      aud: "https://api.sand.etherfuse.com/auth/token",
      scope: "verification",
      email: "user@example.com",
      name: "Test User",
    })
    expect(payload.exp - payload.iat).toBe(300)
    expect(typeof payload.jti).toBe("string")
    const ok = createVerify("SHA256")
      .update(`${h}.${p}`)
      .verify(publicKey, Buffer.from(s, "base64url"))
    expect(ok).toBe(true)
  })

  it("accepts \\n-escaped PEMs (the .env shape)", () => {
    const escaped = { ...params, jwtPrivateKeyPem: pem.replace(/\n/g, "\\n") }
    expect(() => buildKycLaunchJwt(escaped)).not.toThrow()
  })
})
