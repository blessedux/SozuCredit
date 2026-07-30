/** Canonical demo faucet claim path (seeded test orb). */
export const DEMO_FAUCET_PATH =
  process.env.NEXT_PUBLIC_DEMO_FAUCET_PATH?.trim() || "/faucet/test-orb-001"

export function getDemoFaucetPath(): string {
  return DEMO_FAUCET_PATH.startsWith("/") ? DEMO_FAUCET_PATH : `/${DEMO_FAUCET_PATH}`
}
