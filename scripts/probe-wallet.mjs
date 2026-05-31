#!/usr/bin/env node
/**
 * Usage: node scripts/probe-wallet.mjs CBNHZ... GAQH...
 */
import { readFileSync } from "fs"
import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import { Networks } from "@stellar/stellar-sdk"

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8")
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) process.env[m[1]] = m[2].trim()
    }
  } catch {
    /* ignore */
  }
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
    await (await fn()).simulate()
    console.log(label, "OK")
    return true
  } catch (e) {
    console.log(label, "FAIL", String(e).slice(0, 200))
    return false
  }
}

const client = new SmartAccountClient({
  contractId,
  networkPassphrase: pp,
  rpcUrl: rpc,
  allowHttp: true,
})

await sim("get_context_rules", () =>
  client.get_context_rules({
    context_rule_type: { tag: "Default", values: undefined },
  }),
)

const rule0ok = await sim("get_context_rule(0)", () =>
  client.get_context_rule({ context_rule_id: 0 }),
)

if (rule0ok) {
  try {
    const tx = await client.get_context_rule({ context_rule_id: 0 })
    await tx.simulate()
    const rule = tx.result
    const signers = rule?.signers ?? []
    console.log("rule0 name", rule?.name)
    for (const s of signers) {
      if (s.tag === "External") {
        const kd = s.values?.[1]
        const len = kd?.length ?? 0
        console.log(" External keyData len", len, "verifier", s.values?.[0])
        if (len > 65) {
          console.log("  pubkey hex", Buffer.from(kd.slice(0, 65)).toString("hex").slice(0, 20) + "...")
          console.log("  cred suffix hex", Buffer.from(kd.slice(65)).toString("hex").slice(0, 40))
        }
      } else {
        console.log(" signer", s.tag, s.values)
      }
    }
  } catch (e) {
    console.log("rule0 read err", e)
  }
}

if (signerG?.startsWith("G")) {
  const factoryId = process.env.SMART_ACCOUNT_FACTORY_ID?.trim()
  const view = process.env.SMART_ACCOUNT_GET_ADDRESS_VIEW?.trim()
  console.log("factory configured", Boolean(factoryId && view))
}
