#!/usr/bin/env node
/**
 * Probe a smart account contract to determine its type, signing path, and registered key data.
 *
 * Usage: node scripts/probe-wallet.mjs <C...> [G...]
 */
import { readFileSync } from "fs"
import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { Networks, xdr } from "@stellar/stellar-sdk"

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8")
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) process.env[m[1]] = m[2].trim()
    }
  } catch { /* ignore */ }
}

loadEnv()

const contractId = process.argv[2]?.trim().toUpperCase()
const signerG = process.argv[3]?.trim().toUpperCase()
if (!contractId?.startsWith("C")) {
  console.error("Usage: node scripts/probe-wallet.mjs <C...> [G...]")
  process.exit(1)
}

const rpc =
  process.env.SOROBAN_RPC_URL?.trim() ||
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
  "https://soroban-testnet.stellar.org"
const pp = process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET

async function sim(label, fn) {
  try {
    const assembled = await (await fn()).simulate()
    console.log(label, "OK")
    return { ok: true, assembled }
  } catch (e) {
    console.log(label, "FAIL", String(e).slice(0, 200))
    return { ok: false }
  }
}

const client = new SmartAccountClient({
  contractId,
  networkPassphrase: pp,
  rpcUrl: rpc,
  allowHttp: true,
})

console.log("contract:", contractId)
console.log("rpc:", rpc)
console.log()

const { ok: contextRulesOk } = await sim("get_context_rules", () =>
  client.get_context_rules({
    context_rule_type: { tag: "Default", values: undefined },
  }),
)

const { ok: rule0ok, assembled: rule0assembled } = await sim("get_context_rule(0)", () =>
  client.get_context_rule({ context_rule_id: 0 }),
)

console.log()
console.log("recommendedPath:", contextRulesOk ? "oz_kit" : "factory_or_legacy")

// Fetch key data from the resolve-key-data API if the app is running locally
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3001"
try {
  const kdRes = await fetch(`${appUrl}/api/smart-accounts/resolve-key-data?contractId=${contractId}`)
  if (kdRes.ok) {
    const kdBody = await kdRes.json()
    if (kdBody.keyDataBase64) {
      const bytes = Buffer.from(kdBody.keyDataBase64, "base64")
      console.log("keyData length:", bytes.length, "bytes")
      console.log("  pubkey hex (first 10b):", bytes.slice(0, 10).toString("hex") + "...")
      if (bytes.length > 65) {
        const credSuffix = bytes.slice(65)
        console.log("  cred suffix (base64url):", credSuffix.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, ""))
      }
    }
  }
} catch {
  // App not running locally — skip key data resolution
}

if (signerG?.startsWith("G")) {
  const factoryId = process.env.SMART_ACCOUNT_FACTORY_ID?.trim()
  const view = process.env.SMART_ACCOUNT_GET_ADDRESS_VIEW?.trim()
  console.log("\nfactory configured:", Boolean(factoryId && view))
}

console.log()
if (contextRulesOk) {
  console.log("✅ This is an OZ smart account. Use signMethod=oz_passkey (kit.signAuthEntry).")
} else {
  console.log("⚠️  get_context_rules not available. Check if this is a factory wallet.")
}
