import { describe, expect, it } from "vitest"
import { resolveEnterAuthPath } from "./enter-auth-path"

describe("resolveEnterAuthPath", () => {
  it("prefers stored username login over capability checks", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: "alice",
        capabilities: { hasWebAuthn: true, canUsePasskeys: false },
      }),
    ).toEqual({ action: "login-stored", username: "alice" })
  })

  it("ignores placeholder stored username", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: "user",
        capabilities: { hasWebAuthn: true, canUsePasskeys: true },
      }),
    ).toEqual({ action: "create-or-login" })
  })

  it("routes first-time biometric devices to create/login — not discovery", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: null,
        capabilities: { hasWebAuthn: true, canUsePasskeys: true },
      }),
    ).toEqual({ action: "create-or-login" })
  })

  it("routes no-biometrics devices to an explicit chooser", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: null,
        capabilities: { hasWebAuthn: true, canUsePasskeys: false },
      }),
    ).toEqual({ action: "choose-path" })
  })

  it("marks missing WebAuthn as unsupported", () => {
    expect(
      resolveEnterAuthPath({
        storedUsername: null,
        capabilities: { hasWebAuthn: false, canUsePasskeys: false },
      }),
    ).toEqual({ action: "unsupported" })

    expect(
      resolveEnterAuthPath({
        storedUsername: null,
        capabilities: null,
      }),
    ).toEqual({ action: "unsupported" })
  })
})
