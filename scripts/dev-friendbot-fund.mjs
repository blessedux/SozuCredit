/**
 * Internal QA: fund a testnet Stellar address via Friendbot (no app server).
 *
 * Usage:
 *   node scripts/dev-friendbot-fund.mjs G...YOUR56CHARPUBLICKEY
 *
 * Requires Node 18+ (global fetch).
 */

const addr = process.argv[2]
if (!addr || !/^G[A-Z0-9]{55}$/.test(addr)) {
  console.error("Usage: node scripts/dev-friendbot-fund.mjs G...56CHAR_PUBLIC_KEY")
  process.exit(1)
}

const horizon =
  (process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org").replace(/\/$/, "")
const url = `${horizon}/friendbot?addr=${encodeURIComponent(addr)}`

const res = await fetch(url, { redirect: "follow" })
const text = await res.text()
let body
try {
  body = JSON.parse(text)
} catch {
  body = text
}
console.log("HTTP", res.status, url)
console.log(typeof body === "string" ? body : JSON.stringify(body, null, 2))
if (!res.ok) process.exit(1)
