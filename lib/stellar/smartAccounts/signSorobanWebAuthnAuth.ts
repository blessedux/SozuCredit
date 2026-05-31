"use client"

import { startAuthentication } from "@simplewebauthn/browser"
import type { SmartAccountKit } from "smart-account-kit"
import base64url from "base64url"
import { Address, hash, rpc, xdr } from "@stellar/stellar-sdk"
import {
  buildExternalSignerKeyData,
  credentialIdToBuffer,
  parsePasskeyPublicKey65,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { getUserId } from "@/lib/wallet-utils"

const WEBAUTHN_TIMEOUT_MS = 60_000
const SECP256R1_PUBLIC_KEY_SIZE = 65

export function shouldFallbackPasskeySign(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes("get_context_rules") ||
    msg.includes("No signer found") ||
    msg.includes("non-existent contract function") ||
    msg.includes("Signer keyData not found")
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
}> {
  const rpId =
    process.env.NEXT_PUBLIC_RP_ID?.trim() ||
    (typeof window !== "undefined" ? window.location.hostname : "localhost")
  const normId = normalizeCredentialId(credentialId)

  const authResponse = await startAuthentication({
    optionsJSON: {
      challenge: challengeB64Url,
      rpId,
      allowCredentials: [{ id: normId, type: "public-key" }],
      userVerification: "required",
      timeout: WEBAUTHN_TIMEOUT_MS,
    },
  })

  const rawSignature = base64url.toBuffer(authResponse.response.signature)
  return {
    authenticator_data: base64url.toBuffer(authResponse.response.authenticatorData),
    client_data: base64url.toBuffer(authResponse.response.clientDataJSON),
    signature: compactSignature(rawSignature),
  }
}

/**
 * Sign a Soroban auth entry (legacy OZ WASM without get_context_rules).
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

  let expiration = params.expiration
  if (expiration == null) {
    const rpcUrl =
      process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
      "https://soroban-testnet.stellar.org"
    const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
    const latest = await server.getLatestLedger()
    expiration = latest.sequence + 60
  }
  credentials.signatureExpirationLedger(expiration)

  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: hash(Buffer.from(params.networkPassphrase)),
      nonce: credentials.nonce(),
      signatureExpirationLedger: credentials.signatureExpirationLedger(),
      invocation: normalizedEntry.rootInvocation(),
    }),
  )
  const challenge = base64url.encode(hash(preimage.toXDR()))

  const authResponse = await webAuthnSignSorobanPreimage(challenge, params.credentialId)

  let keyData: Buffer | null = null
  if (params.smartAccountContractId?.startsWith("C")) {
    keyData = await resolveKeyDataFromChain({
      contractId: params.smartAccountContractId,
      credentialId: params.credentialId,
      authEntry: normalizedEntry,
    })
  }

  if (!keyData) {
    const pub = await loadPasskeyPublicKey65({
      credentialId: params.credentialId,
      kit: params.kit,
    })
    // Match smart-account-kit deploy: base64url-decoded credential id string, not assertion rawId.
    keyData = buildExternalSignerKeyData(
      pub,
      credentialIdToBuffer(normalizeCredentialId(params.credentialId)),
    )
  }

  const scMapEntry = buildSignatureMapEntry(params.webauthnVerifierAddress, keyData, authResponse)

  const currentSig = credentials.signature()
  if (currentSig.switch().name === "scvVoid") {
    credentials.signature(xdr.ScVal.scvVec([xdr.ScVal.scvMap([scMapEntry])]))
  } else {
    currentSig.vec()?.[0].map()?.push(scMapEntry)
  }

  const sigMap = credentials.signature().vec()?.[0].map()
  if (sigMap && sigMap.length > 1) {
    sigMap.sort((a, b) => {
      const aKeyXdr = a.key().toXDR("hex")
      const bKeyXdr = b.key().toXDR("hex")
      return aKeyXdr.localeCompare(bKeyXdr)
    })
  }

  return normalizedEntry
}
