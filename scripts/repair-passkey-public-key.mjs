#!/usr/bin/env node
/**
 * Normalize passkeys.public_key to 65-byte base64url (fixes legacy attestation blobs).
 *
 * Usage:
 *   node scripts/repair-passkey-public-key.mjs blessedux12
 *   node scripts/repair-passkey-public-key.mjs f9d45fb0-3467-43b3-bf6b-9c226156a0eb
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

function loadEnv() {
  try {
    const text = readFileSync(".env.local", "utf8")
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) process.env[m[1]] = m[2].trim()
    }
  } catch {
    /* optional */
  }
}

const COSE_ES256_PREFIX = new Uint8Array([
  0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20,
])

function decodeBase64Flexible(stored) {
  const padded = stored.trim().replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, "base64")
}

function parsePasskeyPublicKey65(stored) {
  const raw = decodeBase64Flexible(stored)
  if (raw.length === 65 && raw[0] === 0x04) return raw
  if (raw.length > 65) {
    const tail = raw.subarray(-65)
    if (tail[0] === 0x04) return tail
    for (let i = 0; i <= raw.length - COSE_ES256_PREFIX.length; i++) {
      let match = true
      for (let j = 0; j < COSE_ES256_PREFIX.length; j++) {
        if (raw[i + j] !== COSE_ES256_PREFIX[j]) {
          match = false
          break
        }
      }
      if (match) {
        const start = i + COSE_ES256_PREFIX.length
        const x = raw.subarray(start, start + 32)
        const y = raw.subarray(start + 35, start + 67)
        const out = Buffer.alloc(65)
        out[0] = 0x04
        x.copy(out, 1)
        y.copy(out, 33)
        return out
      }
    }
  }
  throw new Error("Could not parse passkey public key")
}

function publicKeyToBase64Url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

loadEnv()

const arg = process.argv[2]?.trim()
if (!arg) {
  console.error("Usage: node scripts/repair-passkey-public-key.mjs <username|user_id>")
  process.exit(1)
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(url, key)

const isUuid = /^[0-9a-f-]{36}$/i.test(arg)
let userId = isUuid ? arg : null

if (!userId) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", arg)
    .maybeSingle()
  if (error || !profile?.id) {
    console.error("Profile not found:", arg, error?.message)
    process.exit(1)
  }
  userId = profile.id
}

const { data: rows, error: pkErr } = await supabase
  .from("passkeys")
  .select("id, public_key, credential_id")
  .eq("user_id", userId)

if (pkErr || !rows?.length) {
  console.error("No passkeys for user", userId, pkErr?.message)
  process.exit(1)
}

for (const row of rows) {
  const beforeLen = decodeBase64Flexible(row.public_key).length
  let normalized
  try {
    normalized = publicKeyToBase64Url(parsePasskeyPublicKey65(row.public_key))
  } catch (e) {
    console.error("Skip", row.id, e.message)
    continue
  }
  if (normalized === row.public_key && beforeLen === 65) {
    console.log("OK already normalized", row.credential_id?.slice(0, 12))
    continue
  }
  const { error: upd } = await supabase
    .from("passkeys")
    .update({ public_key: normalized })
    .eq("id", row.id)
  if (upd) {
    console.error("Update failed", row.id, upd.message)
    process.exit(1)
  }
  console.log("Repaired", row.credential_id?.slice(0, 12), `${beforeLen}B → 65B`)
}

console.log("Done for user", userId)
