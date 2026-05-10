import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

const SCRYPT_KEYLEN = 64
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const

export function hashRecoveryPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin.normalize("NFKC"), salt, SCRYPT_KEYLEN, SCRYPT_OPTS)
  return `${salt.toString("base64")}:${hash.toString("base64")}`
}

export function verifyRecoveryPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== "string") return false
  const idx = stored.indexOf(":")
  if (idx < 1) return false
  const saltB64 = stored.slice(0, idx)
  const hashB64 = stored.slice(idx + 1)
  try {
    const salt = Buffer.from(saltB64, "base64")
    const expected = Buffer.from(hashB64, "base64")
    const hash = scryptSync(pin.normalize("NFKC"), salt, SCRYPT_KEYLEN, SCRYPT_OPTS)
    if (hash.length !== expected.length) return false
    return timingSafeEqual(hash, expected)
  } catch {
    return false
  }
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6,12}$/.test(pin)
}
