import { cleanupChallenges } from "./config"

export type PasskeyPairingEntry = {
  userId: string
  username: string
  createdAt: number
}

/** In-memory pairing codes for adding a passkey from a second device (same as challenge store lifetime). */
export const passkeyPairingStore = new Map<string, PasskeyPairingEntry>()

const PAIRING_TTL_MS = 10 * 60 * 1000

function normalizePairingCode(code: string): string {
  return String(code).replace(/\s+/g, "").toUpperCase()
}

export function cleanupPairingEntries(): void {
  const cutoff = Date.now() - PAIRING_TTL_MS
  for (const [key, entry] of passkeyPairingStore.entries()) {
    if (entry.createdAt < cutoff) {
      passkeyPairingStore.delete(key)
    }
  }
}

export function createPairingCode(userId: string, username: string): string {
  cleanupChallenges()
  cleanupPairingEntries()
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  const code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()
  passkeyPairingStore.set(code, { userId, username, createdAt: Date.now() })
  return code
}

export function getPairingEntry(code: string): PasskeyPairingEntry | null {
  cleanupPairingEntries()
  const normalized = normalizePairingCode(code)
  const entry = passkeyPairingStore.get(normalized)
  if (!entry) return null
  if (Date.now() - entry.createdAt > PAIRING_TTL_MS) {
    passkeyPairingStore.delete(normalized)
    return null
  }
  return entry
}

export function revokePairingCode(code: string): void {
  passkeyPairingStore.delete(normalizePairingCode(code))
}

export function pairingTtlSeconds(): number {
  return Math.floor(PAIRING_TTL_MS / 1000)
}
