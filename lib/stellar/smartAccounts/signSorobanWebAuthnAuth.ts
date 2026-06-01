"use client"

import { startAuthentication } from "@simplewebauthn/browser"
import type { SmartAccountKit } from "smart-account-kit"
import base64url from "base64url"
import { Address, hash, rpc, xdr } from "@stellar/stellar-sdk"
import {
  credentialIdToBuffer,
  extractPublicKeyFromKeyData,
  parsePasskeyPublicKey65,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { getUserId } from "@/lib/wallet-utils"
import {
  buildOzAuthPayloadScVal,
  defaultContextRuleIdsForEntry,
  ozWebAuthnChallengeFromEntry,
} from "@/lib/stellar/smartAccounts/ozAuthPayload"

/** Send flow — fail fast so UI does not sit on "Waiting for passkey" for a full minute. */
const WEBAUTHN_TIMEOUT_MS = 45_000
const SECP256R1_PUBLIC_KEY_SIZE = 65
const UNCOMPRESSED_PUBKEY_PREFIX = 0x04
/** OZ stellar-contracts webauthn verifier requires UP + UV (see AUTH_DATA_FLAGS_*). */
const AUTH_DATA_FLAGS_UP = 0x01
const AUTH_DATA_FLAGS_UV = 0x04
const AUTH_DATA_FLAGS_BE = 0x08
const AUTH_DATA_FLAGS_BS = 0x10
const AUTH_EXPIRATION_LEDGER_BUFFER = 12
const AUTH_EXPIRATION_LEDGER_TTL = 60

/** Bump stale prepare expiration so __check_auth does not fail after the user approves Touch ID. */
async function resolveSignatureExpirationLedger(
  preferred: number | undefined,
  credentials: ReturnType<xdr.SorobanAuthorizationEntry["credentials"]>,
): Promise<number> {
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    "https://soroban-testnet.stellar.org"
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
  const latest = await server.getLatestLedger()
  const ledger = latest.sequence
  const minValid = ledger + AUTH_EXPIRATION_LEDGER_BUFFER

  let expiration = preferred
  if (expiration == null || expiration <= 0) {
    const fromEntry = credentials.address().signatureExpirationLedger()
    const entryExp = fromEntry != null ? Number(fromEntry) : 0
    expiration = entryExp > 0 ? entryExp : ledger + AUTH_EXPIRATION_LEDGER_TTL
  }
  if (expiration < minValid) {
    if (process.env.NODE_ENV === "development") {
      console.log("[signSorobanWebAuthnAuth] bumped auth expiration ledger", {
        previous: preferred,
        next: ledger + AUTH_EXPIRATION_LEDGER_TTL,
        currentLedger: ledger,
      })
    }
    expiration = ledger + AUTH_EXPIRATION_LEDGER_TTL
  }
  return expiration
}

/** secp256r1 public key embedded in WebAuthn authenticator_data (signing ceremony). */
function extractPublicKeyFromAuthenticatorData(authData: Buffer): Uint8Array | null {
  if (authData.length < 55) return null
  const credentialIdLength = (authData[53] << 8) | authData[54]
  const xStart = 55 + credentialIdLength
  const yStart = xStart + 32 + 3
  if (yStart + 32 > authData.length) return null
  const publicKey = new Uint8Array(SECP256R1_PUBLIC_KEY_SIZE)
  publicKey[0] = UNCOMPRESSED_PUBKEY_PREFIX
  publicKey.set(authData.slice(xStart, xStart + 32), 1)
  publicKey.set(authData.slice(yStart, yStart + 32), 33)
  return publicKey
}

function assertPasskeyMatchesOnChainKeyData(
  keyData: Buffer,
  authenticatorData: Buffer,
): void {
  const fromAuth = extractPublicKeyFromAuthenticatorData(authenticatorData)
  if (!fromAuth) return
  const onChain = extractPublicKeyFromKeyData(keyData)
  if (Buffer.from(fromAuth).equals(Buffer.from(onChain))) return
  throw new Error(
    "This passkey is not the one registered on your smart account (C…). Sign out, sign in with the same passkey you used for wallet setup, or re-link your smart wallet in Settings.",
  )
}

export function shouldFallbackPasskeySign(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes("get_context_rules") ||
    msg.includes("No signer found") ||
    msg.includes("non-existent contract function") ||
    msg.includes("Signer keyData not found") ||
    msg.includes("MissingValue") ||
    msg.includes("WasmVm") ||
    msg.includes("missing function") ||
    msg.includes("not found in contract")
  )
}

/** Apply low-S to an already-compact 64-byte (r||s) signature. */
function lowSCompactSignature(compact: Buffer): Uint8Array {
  const s = compact.subarray(32, 64)
  let sBigInt = BigInt(`0x${s.toString("hex")}`)
  const n = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551")
  const halfN = n / BigInt(2)
  if (sBigInt > halfN) {
    sBigInt = n - sBigInt
  }
  const sLowS = Buffer.from(sBigInt.toString(16).padStart(64, "0"), "hex")
  return new Uint8Array(Buffer.concat([compact.subarray(0, 32), sLowS]))
}

/** DER or raw 64-byte → Stellar compact (r||s, low-S), same as smart-account-kit. */
function toStellarCompactSignature(derOrRaw: Buffer): Uint8Array {
  if (derOrRaw.length === 64) {
    return lowSCompactSignature(derOrRaw)
  }
  if (derOrRaw[0] === 0x30) {
    return compactSignature(derOrRaw)
  }
  throw new Error(
    `Unexpected WebAuthn signature (${derOrRaw.length} bytes). Retry the passkey prompt.`,
  )
}

/** DER secp256r1 → 64-byte compact (low-S), same as smart-account-kit. */
function compactSignature(derSignature: Buffer): Uint8Array {
  let offset = 2
  const rLength = derSignature[offset + 1]
  const r = derSignature.slice(offset + 2, offset + 2 + rLength)
  offset += 2 + rLength
  const sLength = derSignature[offset + 1]
  const s = derSignature.slice(offset + 2, offset + 2 + sLength)
  const rBigInt = BigInt(`0x${r.toString("hex")}`)
  let sBigInt = BigInt(`0x${s.toString("hex")}`)
  const n = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551")
  const halfN = n / BigInt(2)
  if (sBigInt > halfN) {
    sBigInt = n - sBigInt
  }
  const rPadded = Buffer.from(rBigInt.toString(16).padStart(64, "0"), "hex")
  const sLowS = Buffer.from(sBigInt.toString(16).padStart(64, "0"), "hex")
  return new Uint8Array(Buffer.concat([rPadded, sLowS]))
}

function buildSignatureMapEntry(
  webauthnVerifierAddress: string,
  keyData: Buffer,
  sigData: {
    authenticator_data: Buffer
    client_data: Buffer
    signature: Uint8Array
  },
): xdr.ScMapEntry {
  const keyVal = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("External"),
    xdr.ScVal.scvAddress(Address.fromString(webauthnVerifierAddress).toScAddress()),
    xdr.ScVal.scvBytes(keyData),
  ])
  const sigDataScVal = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("authenticator_data"),
      val: xdr.ScVal.scvBytes(sigData.authenticator_data),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("client_data"),
      val: xdr.ScVal.scvBytes(sigData.client_data),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(Buffer.from(sigData.signature)),
    }),
  ])
  return new xdr.ScMapEntry({
    key: keyVal,
    val: xdr.ScVal.scvBytes(sigDataScVal.toXDR()),
  })
}

function sortSignerMapEntries(sigMap: xdr.ScMapEntry[]): void {
  if (sigMap.length <= 1) return
  sigMap.sort((a, b) => {
    const aKeyXdr = a.key().toXDR("hex")
    const bKeyXdr = b.key().toXDR("hex")
    return aKeyXdr.localeCompare(bKeyXdr)
  })
}

/** New OZ WASM expects AuthPayload on credentials.signature, not a bare signer vec. */
function applyOzAuthPayloadSignature(
  credentials: xdr.SorobanAddressCredentials,
  scMapEntry: xdr.ScMapEntry,
  contextRuleIds: number[],
): void {
  const currentSig = credentials.signature()
  if (currentSig.switch().name === "scvMap") {
    const payloadMap = currentSig.map() ?? []
    let signersMap: xdr.ScMapEntry[] | null = null
    for (const entry of payloadMap) {
      if (entry.key().switch().name === "scvSymbol" && entry.key().sym() === "signers") {
        signersMap = entry.val().map() ?? []
        break
      }
    }
    if (signersMap) {
      signersMap.push(scMapEntry)
      sortSignerMapEntries(signersMap)
      return
    }
  }
  credentials.signature(buildOzAuthPayloadScVal([scMapEntry], contextRuleIds))
}

function assertKeyDataMatchesStoredPasskey(keyData: Buffer, storedPublicKey65: Uint8Array): void {
  const onChain = extractPublicKeyFromKeyData(keyData)
  if (Buffer.from(onChain).equals(Buffer.from(storedPublicKey65))) return
  if (process.env.NODE_ENV === "development") {
    console.error("[signSorobanWebAuthnAuth] pubkey mismatch", {
      onChainPrefix: Buffer.from(onChain).subarray(0, 8).toString("hex"),
      storedPrefix: Buffer.from(storedPublicKey65).subarray(0, 8).toString("hex"),
    })
  }
  throw new Error(
    "Database and on-chain public keys disagree with this passkey's signing key. Sign out, register again at the same URL, and create a new smart wallet.",
  )
}

export async function resolveKeyDataFromChain(params: {
  contractId: string
  credentialId: string
  authEntry: xdr.SorobanAuthorizationEntry
}): Promise<Buffer | null> {
  const q = new URLSearchParams({
    contractId: params.contractId,
    credentialId: params.credentialId,
    authEntryXdr: params.authEntry.toXDR("base64"),
  })
  const res = await fetch(`/api/smart-accounts/resolve-key-data?${q}`)
  const data = (await res.json().catch(() => ({}))) as { keyDataBase64?: string }
  if (!res.ok || !data.keyDataBase64) return null
  return Buffer.from(data.keyDataBase64, "base64")
}

async function loadPasskeyPublicKey65(params: {
  credentialId: string
  kit?: SmartAccountKit
}): Promise<Uint8Array> {
  if (params.kit) {
    try {
      const norm = normalizeCredentialId(params.credentialId)
      const all = await params.kit.credentials.getAll()
      const match = all.find((c) => normalizeCredentialId(c.credentialId) === norm)
      if (match?.publicKey?.length === SECP256R1_PUBLIC_KEY_SIZE) {
        return match.publicKey
      }
    } catch {
      /* fall through */
    }
  }

  const userId = getUserId()
  if (!userId) {
    throw new Error("Not signed in. Please log in again.")
  }
  const res = await fetch("/api/auth/passkeys/primary", {
    headers: { "x-user-id": userId },
  })
  const data = (await res.json().catch(() => ({}))) as {
    publicKey65b?: string
    error?: string
  }
  if (!res.ok || !data.publicKey65b) {
    throw new Error(
      data.error ??
        "Passkey public key missing. Open Settings and re-link your smart wallet, or sign in again.",
    )
  }
  return parsePasskeyPublicKey65(data.publicKey65b)
}

/**
 * WebAuthn assertion for Soroban auth — matches smart-account-kit (simplewebauthn + base64url).
 */
async function webAuthnSignSorobanPreimage(
  challengeB64Url: string,
  credentialId: string,
): Promise<{
  authenticator_data: Buffer
  client_data: Buffer
  signature: Uint8Array
  credentialId: string
  rpId: string
}> {
  const rpId =
    process.env.NEXT_PUBLIC_RP_ID?.trim() ||
    (typeof window !== "undefined" ? window.location.hostname : "localhost")
  console.log("[signSorobanWebAuthnAuth] startAuthentication", {
    rpId,
    credentialIdPrefix: credentialId.slice(0, 8),
  })

  let authResponse: Awaited<ReturnType<typeof startAuthentication>>
  try {
    authResponse = await startAuthentication({
      optionsJSON: {
        challenge: challengeB64Url,
        rpId,
        allowCredentials: [{ id: credentialId, type: "public-key" }],
        userVerification: "required",
        timeout: WEBAUTHN_TIMEOUT_MS,
      },
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ""
    if (name === "NotAllowedError" || name === "AbortError") {
      throw new Error(
        "Passkey prompt was cancelled or blocked. Close any other passkey dialog, then tap Send again.",
      )
    }
    if (name === "TimeoutError") {
      throw new Error("Passkey prompt timed out. Tap Send again and complete Face ID / Touch ID when prompted.")
    }
    throw err
  }

  const rawSignature = base64url.toBuffer(authResponse.response.signature)
  return {
    authenticator_data: base64url.toBuffer(authResponse.response.authenticatorData),
    client_data: base64url.toBuffer(authResponse.response.clientDataJSON),
    signature: toStellarCompactSignature(rawSignature),
    credentialId: authResponse.id,
    rpId,
  }
}

async function sha256Bytes(input: string): Promise<Buffer> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Buffer.from(digest)
}

async function assertWebAuthnPayloadMatchesExpected(params: {
  expectedChallenge: string
  rpId: string
  clientDataJson: Buffer
  authenticatorData: Buffer
}): Promise<void> {
  const clientDataRaw = params.clientDataJson.toString("utf8")
  let clientData: { challenge?: string; origin?: string; type?: string }
  try {
    clientData = JSON.parse(clientDataRaw)
  } catch {
    throw new Error("WebAuthn clientDataJSON could not be parsed.")
  }

  const actualChallenge = clientData.challenge ?? ""
  if (actualChallenge !== params.expectedChallenge) {
    throw new Error(
      "WebAuthn challenge mismatch. Please retry from the same tab and URL without refreshing during Touch ID.",
    )
  }

  const origin = clientData.origin ?? ""
  if (typeof window !== "undefined" && origin && !origin.startsWith(window.location.origin)) {
    throw new Error(
      `WebAuthn origin mismatch: expected ${window.location.origin}, got ${origin}. Open only ${window.location.origin} and retry.`,
    )
  }

  if (clientData.type !== "webauthn.get") {
    throw new Error(
      `WebAuthn type must be "webauthn.get" for Soroban auth (got "${clientData.type ?? ""}").`,
    )
  }

  if (params.authenticatorData.length < 37) {
    throw new Error("WebAuthn authenticator_data is too short.")
  }
  const rpHashFromAuth = params.authenticatorData.subarray(0, 32)
  const expectedRpHash = await sha256Bytes(params.rpId)
  if (!Buffer.from(rpHashFromAuth).equals(expectedRpHash)) {
    throw new Error(
      `WebAuthn rpId hash mismatch. Expected rpId "${params.rpId}" for this URL, but assertion was produced for a different rpId.`,
    )
  }

  const flags = params.authenticatorData[32]!
  if ((flags & AUTH_DATA_FLAGS_UP) === 0) {
    throw new Error(
      "WebAuthn user presence (UP) was not set. Complete the passkey prompt (Touch ID / Face ID) and try again.",
    )
  }
  if ((flags & AUTH_DATA_FLAGS_UV) === 0) {
    throw new Error(
      "WebAuthn user verification (UV) was not set. Your passkey must verify you (biometrics or device PIN). Try again and complete verification when prompted.",
    )
  }
  if ((flags & AUTH_DATA_FLAGS_BE) === 0 && (flags & AUTH_DATA_FLAGS_BS) !== 0) {
    throw new Error(
      "WebAuthn backup state is invalid for this passkey. Try another passkey or sign out and register a new wallet.",
    )
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[signSorobanWebAuthnAuth] payload verified", {
      type: clientData.type,
      origin,
      rpId: params.rpId,
      challengePrefix: actualChallenge.slice(0, 12),
      authFlags: `0x${flags.toString(16)}`,
    })
  }
}

/**
 * Kit-compatible Soroban auth signing for OZ smart accounts that only expose
 * get_context_rule (singular), not get_context_rules. Resolves keyData on-chain
 * via /api/smart-accounts/resolve-key-data (get_context_rule id 0).
 */
export async function signAuthEntryWithResolvedKeyData(params: {
  entry: xdr.SorobanAuthorizationEntry
  credentialId: string
  networkPassphrase: string
  webauthnVerifierAddress: string
  smartAccountContractId: string
  expiration?: number
}): Promise<xdr.SorobanAuthorizationEntry> {
  const entryXdrBytes = params.entry.toXDR()
  const normalizedEntry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdrBytes)
  const credentials = normalizedEntry.credentials().address()

  // Use the server-prepared expiration directly when it looks valid (> 0).
  // Only hit `getLatestLedger` if it's missing or zero — skipping the RPC call
  // means the passkey prompt can appear as soon as the challenge is ready.
  const entryExpiration = Number(credentials.signatureExpirationLedger())
  let expiration: number
  if (entryExpiration > 0 && (!params.expiration || params.expiration <= 0)) {
    expiration = entryExpiration
  } else if (params.expiration && params.expiration > 0) {
    expiration = params.expiration
  } else {
    // Fallback: must hit RPC to get current ledger.
    expiration = await resolveSignatureExpirationLedger(undefined, normalizedEntry.credentials())
  }
  credentials.signatureExpirationLedger(expiration)

  const contextRuleIds = defaultContextRuleIdsForEntry(normalizedEntry)
  const challenge = ozWebAuthnChallengeFromEntry({
    networkPassphrase: params.networkPassphrase,
    entry: normalizedEntry,
    contextRuleIds,
  })

  // Passkey prompt — fires immediately now that the challenge is ready.
  const webAuthnSig = await webAuthnSignSorobanPreimage(challenge, params.credentialId)
  await assertWebAuthnPayloadMatchesExpected({
    expectedChallenge: challenge,
    rpId: webAuthnSig.rpId,
    clientDataJson: webAuthnSig.client_data,
    authenticatorData: webAuthnSig.authenticator_data,
  })

  // Resolve keyData and stored pubkey in parallel (both are network calls, no user interaction).
  const [keyData, storedPubkey] = await Promise.all([
    resolveKeyDataFromChain({
      contractId: params.smartAccountContractId,
      credentialId: webAuthnSig.credentialId,
      authEntry: normalizedEntry,
    }),
    loadPasskeyPublicKey65({ credentialId: webAuthnSig.credentialId }),
  ])
  if (!keyData) {
    throw new Error(
      `No signer found for credential ID: ${webAuthnSig.credentialId.slice(0, 12)}…`,
    )
  }

  assertKeyDataMatchesStoredPasskey(keyData, storedPubkey)

  const { verifyWebAuthnAssertionForKeyData } = await import(
    "@/lib/webauthn/verify-p256-assertion"
  )
  const sigOk = await verifyWebAuthnAssertionForKeyData({
    keyData,
    authenticatorData: webAuthnSig.authenticator_data,
    clientData: webAuthnSig.client_data,
    signature64: webAuthnSig.signature,
  })
  if (!sigOk) {
    const onChainHex = Buffer.from(extractPublicKeyFromKeyData(keyData))
      .subarray(0, 12)
      .toString("hex")
    const storedHex = Buffer.from(storedPubkey).subarray(0, 12).toString("hex")
    throw new Error(
      `This passkey signature does not match the public key on your smart account (on-chain ${onChainHex}…, session ${storedHex}…). ` +
        "Sign out, register a new account at the same URL you use for login, complete wallet setup, then send again.",
    )
  }

  const scMapEntry = buildSignatureMapEntry(params.webauthnVerifierAddress, keyData, {
    authenticator_data: webAuthnSig.authenticator_data,
    client_data: webAuthnSig.client_data,
    signature: webAuthnSig.signature,
  })

  applyOzAuthPayloadSignature(credentials, scMapEntry, contextRuleIds)

  return normalizedEntry
}

/**
 * Sign a Soroban auth entry (OZ passkey smart account).
 * keyData suffix uses assertion rawId — must match smart-account-kit deploy.
 */
export async function signAuthEntryWithStoredPasskey(params: {
  entry: xdr.SorobanAuthorizationEntry
  credentialId: string
  networkPassphrase: string
  webauthnVerifierAddress: string
  smartAccountContractId?: string
  kit?: SmartAccountKit
  expiration?: number
}): Promise<xdr.SorobanAuthorizationEntry> {
  const entryXdrBytes = params.entry.toXDR()
  const normalizedEntry = xdr.SorobanAuthorizationEntry.fromXDR(entryXdrBytes)
  const credentials = normalizedEntry.credentials().address()

  const expiration = await resolveSignatureExpirationLedger(params.expiration, normalizedEntry.credentials())
  credentials.signatureExpirationLedger(expiration)

  const contextRuleIds = defaultContextRuleIdsForEntry(normalizedEntry)
  const challenge = ozWebAuthnChallengeFromEntry({
    networkPassphrase: params.networkPassphrase,
    entry: normalizedEntry,
    contextRuleIds,
  })

  const webAuthnSig = await webAuthnSignSorobanPreimage(challenge, params.credentialId)
  await assertWebAuthnPayloadMatchesExpected({
    expectedChallenge: challenge,
    rpId: webAuthnSig.rpId,
    clientDataJson: webAuthnSig.client_data,
    authenticatorData: webAuthnSig.authenticator_data,
  })
  const expectedCredential = normalizeCredentialId(params.credentialId)
  const returnedCredential = normalizeCredentialId(webAuthnSig.credentialId)
  if (process.env.NODE_ENV === "development") {
    console.log("[signSorobanWebAuthnAuth] credential check", {
      expectedCredentialPrefix: expectedCredential.slice(0, 8),
      returnedCredentialPrefix: returnedCredential.slice(0, 8),
      match: expectedCredential === returnedCredential,
    })
  }
  if (returnedCredential !== expectedCredential) {
    throw new Error(
      "A different passkey was used for this signature than the one linked to your smart account. Use the exact same passkey you used during wallet setup.",
    )
  }

  let keyData: Buffer | null = null
  if (params.smartAccountContractId?.startsWith("C")) {
    const credForLookup = webAuthnSig.credentialId
    keyData = await resolveKeyDataFromChain({
      contractId: params.smartAccountContractId,
      credentialId: credForLookup,
      authEntry: normalizedEntry,
    })
  }

  if (!keyData) {
    throw new Error(
      "This passkey is not registered on your smart account (C…). Sign out, sign in with passkey, wait for wallet setup, then try again. If it persists, your C address may be from an old wallet — contact support.",
    )
  }

  assertPasskeyMatchesOnChainKeyData(keyData, webAuthnSig.authenticator_data)

  const scMapEntry = buildSignatureMapEntry(params.webauthnVerifierAddress, keyData, {
    authenticator_data: webAuthnSig.authenticator_data,
    client_data: webAuthnSig.client_data,
    signature: webAuthnSig.signature,
  })

  if (process.env.NODE_ENV === "development") {
    console.log("[signSorobanWebAuthnAuth] applying AuthPayload", {
      contextRuleIds,
      priorSigType: credentials.signature().switch().name,
    })
  }
  applyOzAuthPayloadSignature(credentials, scMapEntry, contextRuleIds)

  return normalizedEntry
}
