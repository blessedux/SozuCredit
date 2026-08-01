import type { DeviceCapabilities } from "@/lib/webauthn/device-detection"

/**
 * Decides what Enter on the lock screen should do before any WebAuthn ceremony.
 *
 * Discovery `credentials.get` with empty allowCredentials triggers the OS
 * "scan with another device" sheet when no local passkey exists — even on
 * biometric devices. First-time / no-stored-username users with biometrics
 * should go to create/login UI instead.
 */
export type EnterAuthPath =
  | { action: "login-stored"; username: string }
  | { action: "create-or-login" }
  | { action: "choose-path" }
  | { action: "unsupported" }

export function resolveEnterAuthPath(opts: {
  storedUsername: string | null
  capabilities: Pick<DeviceCapabilities, "hasWebAuthn" | "canUsePasskeys"> | null
}): EnterAuthPath {
  const username = opts.storedUsername?.trim()
  if (username && username !== "user") {
    return { action: "login-stored", username }
  }

  if (!opts.capabilities?.hasWebAuthn) {
    return { action: "unsupported" }
  }

  if (opts.capabilities.canUsePasskeys) {
    return { action: "create-or-login" }
  }

  return { action: "choose-path" }
}
