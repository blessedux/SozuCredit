/** Guest pizza pay uses the C or G stellar address stamped onto return_to. */
export function guestWalletAddress(raw: string | null | undefined): string | null {
  const value = raw?.trim().toUpperCase() ?? ""
  return /^[GC][A-Z0-9]{55}$/.test(value) ? value : null
}

/**
 * Hold the pay bounce-back until the smart wallet exists.
 * Signup provisions in the background; hopping with no guest (or pizza=0 on an
 * unfinished C address) dumps the payer on a dead checkout.
 */
export async function waitForGuestWalletAddress(opts: {
  readPublicKey: () => string | null | Promise<string | null>
  isProvisioning: () => boolean
  provision?: () => Promise<string | null>
  sleep?: (ms: number) => Promise<void>
  attempts?: number
  intervalMs?: number
}): Promise<string | null> {
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const attempts = opts.attempts ?? 40
  const intervalMs = opts.intervalMs ?? 500

  for (let i = 0; i < attempts; i++) {
    const stored = guestWalletAddress(await opts.readPublicKey())
    if (stored && !opts.isProvisioning()) return stored

    if (opts.provision) {
      try {
        const provisioned = guestWalletAddress(await opts.provision())
        if (provisioned && !opts.isProvisioning()) return provisioned
      } catch {
        /* retry */
      }
    }

    await sleep(intervalMs)
  }

  const last = guestWalletAddress(await opts.readPublicKey())
  return last && !opts.isProvisioning() ? last : null
}
