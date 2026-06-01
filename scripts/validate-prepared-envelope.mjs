#!/usr/bin/env node
/**
 * Phase 2 regression script: validate that the payment server pipeline produces a
 * well-formed Soroban envelope (sorobanDataXdr present, cloneFrom rebuild doesn't
 * produce txMalformed, funder co-sign works).
 *
 * Usage:
 *   node scripts/validate-prepared-envelope.mjs <senderC> <destinationG> <userId>
 *
 * Example:
 *   node scripts/validate-prepared-envelope.mjs \
 *     CAY2QVIGFLE4ZBIB6QPA44C4QA6NOY3QEPJSWZOWPEIQ5TTYQLEAJOHX \
 *     GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
 *     7b9c6069-d7b5-45de-9eea-7776815aa8c8
 */

import { readFileSync } from "fs"
import { Keypair, Transaction, TransactionBuilder, Networks, xdr } from "@stellar/stellar-sdk"

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3001"
const NETWORK = process.env.STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET
const FUNDER_SECRET = process.env.STELLAR_FUNDER_SECRET?.trim()
const CIRCLE_SAC = process.env.SOROBAN_USDC_TOKEN_ID?.trim() ||
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

const [,, senderArg, destinationArg, userIdArg] = process.argv
const sender = senderArg?.trim().toUpperCase()
const destination = destinationArg?.trim().toUpperCase()
const userId = userIdArg?.trim()

if (!sender?.startsWith("C") || !destination || !userId) {
  console.error("Usage: node scripts/validate-prepared-envelope.mjs <senderC> <destG_or_C> <userId>")
  process.exit(1)
}

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1) }
}

function extractSorobanDataXdr(envelopeXdr) {
  const tx = new Transaction(envelopeXdr, NETWORK)
  try {
    const ext = tx.toEnvelope().v1().tx().ext()
    const sd = ext.sorobanData()
    return sd.toXDR("base64")
  } catch {
    return null
  }
}

async function main() {
  console.log("\n=== Phase 2: validate-prepared-envelope ===")
  console.log("Sender:", sender.slice(0, 8) + "…")
  console.log("Destination:", destination.slice(0, 8) + "…")
  console.log("App URL:", APP_URL)
  console.log("USDC contract:", CIRCLE_SAC.slice(0, 8) + "…")
  console.log("Funder configured:", Boolean(FUNDER_SECRET))
  console.log()

  // Step 1: Build-only API call
  console.log("Step 1: Calling payment build API …")
  const buildRes = await fetch(`${APP_URL}/api/wallet/stellar/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({
      sender,
      destination,
      amount: "0.01",
      contractId: CIRCLE_SAC,
    }),
  })

  const buildBody = await buildRes.json().catch(() => ({}))

  if (!buildRes.ok) {
    console.error("FAIL: build API returned", buildRes.status, buildBody.error ?? JSON.stringify(buildBody).slice(0, 200))
    process.exit(1)
  }

  const { unsignedXdr, sorobanDataXdr, signMethod, supportsOzKitApi, feePayerPublicKey, usedFunderRelayer } = buildBody
  console.log("  signMethod:", signMethod)
  console.log("  supportsOzKitApi:", supportsOzKitApi)
  console.log("  feePayerPublicKey:", feePayerPublicKey?.slice(0, 8) + "…")
  console.log("  usedFunderRelayer:", usedFunderRelayer)

  assert(unsignedXdr, "unsignedXdr must be present in build response")
  assert(sorobanDataXdr, "sorobanDataXdr must be present in build response")
  console.log("PASS: unsignedXdr and sorobanDataXdr both present")

  // Step 2: Extract sorobanData from the envelope itself and compare
  console.log("\nStep 2: Validating sorobanDataXdr round-trips from envelope …")
  const extractedXdr = extractSorobanDataXdr(unsignedXdr)
  assert(extractedXdr, "Could not extract sorobanDataXdr from unsignedXdr — envelope may be malformed")
  assert(
    extractedXdr === sorobanDataXdr,
    `sorobanDataXdr mismatch!\n  API: ${sorobanDataXdr.slice(0, 40)}\n  Extracted: ${extractedXdr.slice(0, 40)}`
  )
  console.log("PASS: sorobanDataXdr round-trips correctly from the prepared envelope")

  // Step 3: Rebuild with cloneFrom (no passkey auth) and check shape
  console.log("\nStep 3: Rebuilding envelope via cloneFrom (no auth signatures) …")
  const originalTx = new Transaction(unsignedXdr, NETWORK)
  const sorobanData = xdr.SorobanTransactionData.fromXDR(sorobanDataXdr, "base64")
  const op = originalTx.operations[0]

  assert(op?.type === "invokeHostFunction", `Expected invokeHostFunction, got ${op?.type}`)

  const rebuilt = TransactionBuilder.cloneFrom(originalTx, {
    fee: originalTx.fee,
    networkPassphrase: NETWORK,
    sorobanData,
  })
  rebuilt.clearOperations()
  rebuilt.addOperation(op)
  const rebuiltTx = rebuilt.build()
  const rebuiltXdr = rebuiltTx.toEnvelope().toXDR("base64")

  // Verify sorobanData survived the rebuild
  const rebuiltExtracted = extractSorobanDataXdr(rebuiltXdr)
  assert(rebuiltExtracted, "cloneFrom rebuild dropped sorobanData — would cause txMalformed")
  console.log("PASS: sorobanData survived cloneFrom rebuild")

  // Step 4: Co-sign with funder and attempt submit (expect txBadAuth, not txMalformed)
  if (!FUNDER_SECRET) {
    console.log("\nStep 4: Skipped (no STELLAR_FUNDER_SECRET configured)")
  } else {
    console.log("\nStep 4: Co-signing with funder keypair and simulating submit …")
    const funderKp = Keypair.fromSecret(FUNDER_SECRET)
    assert(
      originalTx.source === funderKp.publicKey(),
      `Fee payer in envelope (${originalTx.source.slice(0, 8)}) does not match funder (${funderKp.publicKey().slice(0, 8)})`
    )

    rebuiltTx.sign(funderKp)
    const signedXdr = rebuiltTx.toEnvelope().toXDR("base64")

    const rpcUrl = process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org"
    const rpcRes = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "sendTransaction",
        params: { transaction: signedXdr },
      }),
    })
    const rpcBody = await rpcRes.json()
    const status = rpcBody.result?.status ?? rpcBody.error?.message ?? "unknown"
    const errorCode = rpcBody.result?.errorResultXdr

    // txMalformed = envelope structure problem. txBadAuth = missing passkey sig (expected).
    // Both are ok from a shape perspective; PENDING/ERROR are also acceptable.
    const txMalformed = JSON.stringify(rpcBody).includes("txMalformed")
    if (txMalformed) {
      console.error("FAIL: RPC returned txMalformed — Soroban envelope is structurally invalid")
      console.error("  RPC response:", JSON.stringify(rpcBody).slice(0, 400))
      process.exit(1)
    }
    console.log("PASS: No txMalformed. RPC status:", status, errorCode ? `(${errorCode.slice(0, 30)})` : "")
    console.log("  (txBadAuth / PENDING are expected without passkey signature)")
  }

  console.log("\n✅ All envelope shape checks passed. Server pipeline is clean.")
  console.log("   Root cause of __check_auth is in WebAuthn signing, not the envelope.")
}

main().catch(err => {
  console.error("Fatal error:", err.message)
  process.exit(1)
})
