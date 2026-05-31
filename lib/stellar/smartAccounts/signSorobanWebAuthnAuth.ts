"use client"

import { Address, hash, rpc, xdr } from "@stellar/stellar-sdk"
import { credentialIdToBuffer } from "@/lib/stellar/smartAccounts/passkeyPublicKey"
import { base64URLToBuffer, bufferToBase64URL } from "@/lib/webauthn/utils"
import { getUserId } from "@/lib/wallet-utils"

const WEBAUTHN_TIMEOUT_MS = 60_000
const SECP256R1_PUBLIC_KEY_SIZE = 65

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

async function loadPasskeyKeyData(credentialId: string): Promise<Buffer> {
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
    throw new Error(data.error ?? "Passkey public key missing. Sign in again.")
  }
  const pub = new Uint8Array(base64URLToBuffer(data.publicKey65b))
  if (pub.length !== SECP256R1_PUBLIC_KEY_SIZE) {
    throw new Error("Invalid passkey public key length.")
  }
  const cred = credentialIdToBuffer(credentialId)
  return Buffer.concat([Buffer.from(pub), cred])
}

async function webAuthnSignSorobanPreimage(challengeB64Url: string, credentialId: string) {
  const rpId = typeof window !== "undefined" ? window.location.hostname : "localhost"
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: base64URLToBuffer(challengeB64Url),
      rpId,
      allowCredentials: [
        {
          id: base64URLToBuffer(credentialId),
          type: "public-key",
        },
      ],
      userVerification: "preferred",
      timeout: WEBAUTHN_TIMEOUT_MS,
    },
  })
  if (!cred || cred.type !== "public-key") {
    throw new Error(
      "Payment cancelled. Approve the transfer with your passkey to continue.",
    )
  }
  const assertion = cred as PublicKeyCredential
  const response = assertion.response as AuthenticatorAssertionResponse
  return {
    authenticator_data: Buffer.from(response.authenticatorData),
    client_data: Buffer.from(response.clientDataJSON),
    signature: compactSignature(Buffer.from(response.signature)),
  }
}

function hashToChallenge(payload: Buffer): string {
  const bytes = new Uint8Array(payload)
  return bufferToBase64URL(bytes.buffer)
}

/**
 * Sign a Soroban auth entry with WebAuthn using passkey key material from our DB
 * (no on-chain get_context_rules lookup).
 */
export async function signAuthEntryWithStoredPasskey(params: {
  entry: xdr.SorobanAuthorizationEntry
  credentialId: string
  networkPassphrase: string
  webauthnVerifierAddress: string
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
  const challenge = hashToChallenge(hash(preimage.toXDR()))

  const authResponse = await webAuthnSignSorobanPreimage(challenge, params.credentialId)
  const keyData = await loadPasskeyKeyData(params.credentialId)
  const scMapEntry = buildSignatureMapEntry(params.webauthnVerifierAddress, keyData, authResponse)

  const currentSig = credentials.signature()
  if (currentSig.switch().name === "scvVoid") {
    credentials.signature(xdr.ScVal.scvVec([xdr.ScVal.scvMap([scMapEntry])]))
  } else {
    currentSig.vec()?.[0].map()?.push(scMapEntry)
  }

  return normalizedEntry
}
