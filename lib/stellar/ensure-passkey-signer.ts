"use client"

import { Keypair } from "@stellar/stellar-sdk"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import { deriveKeypairWithSeed } from "@/lib/webauthn/key-derivation"
import {
  deriveAndStoreKey,
  retrieveKeypair,
  getKeypairByPublicKey,
  storeEncryptedKey,
} from "@/lib/storage/browser-keys"

function addCredentialCandidate(ids: Set<string>, id?: string | null): void {
  const trimmed = id?.trim()
  if (!trimmed) return
  ids.add(normalizeCredentialId(trimmed))
}

/** Collect passkey credential ids (never rawId — derivation uses credential.id only). */
export async function collectCredentialIdCandidates(
  preferred?: string | null,
  userId?: string | null
): Promise<string[]> {
  const ids = new Set<string>()
  addCredentialCandidate(ids, preferred)

  if (typeof window !== "undefined") {
    addCredentialCandidate(ids, sessionStorage.getItem("credential_id"))
    addCredentialCandidate(ids, localStorage.getItem("credential_id"))
  }

  if (userId) {
    try {
      const res = await fetch("/api/auth/passkeys/list", {
        headers: { "x-user-id": userId },
      })
      if (res.ok) {
        const data = (await res.json()) as { passkeys?: Array<{ credential_id?: string }> }
        for (const row of data.passkeys ?? []) {
          addCredentialCandidate(ids, row.credential_id)
        }
      }
    } catch {
      // non-fatal
    }

    if (ids.size === 0) {
      try {
        const res = await fetch("/api/auth/passkeys/primary", {
          headers: { "x-user-id": userId },
        })
        if (res.ok) {
          const data = (await res.json()) as { credentialId?: string }
          addCredentialCandidate(ids, data.credentialId)
        }
      } catch {
        // non-fatal
      }
    }
  }

  return [...ids]
}

/** Derive G with userId (current) and without (legacy wallets). */
async function deriveMatchingKeypair(
  credentialId: string,
  userId: string,
  targetG: string
): Promise<{ keypair: Keypair; publicKey: string } | null> {
  const cid = normalizeCredentialId(credentialId)
  const target = targetG.trim().toUpperCase()

  for (const uid of [userId, undefined] as const) {
    try {
      const { keypair, publicKey, seed } = await deriveKeypairWithSeed(cid, uid)
      const pk = publicKey.trim().toUpperCase()
      if (pk === target) {
        await storeEncryptedKey(cid, userId, seed, publicKey)
        return { keypair, publicKey: pk }
      }
    } catch {
      // try next variant
    }
  }
  return null
}

/** Resolve the Ed25519 G keypair that can sign for `signerG`. */
export async function resolveKeypairForSignerG(
  signerG: string,
  userId: string,
  preferredCredentialId?: string | null
): Promise<{ keypair: Keypair; credentialId: string } | null> {
  const target = signerG.trim().toUpperCase()
  if (!target.startsWith("G") || target.length !== 56) return null

  const candidates = await collectCredentialIdCandidates(preferredCredentialId, userId)

  for (const cid of candidates) {
    const stored = await retrieveKeypair(cid, userId)
    if (stored?.publicKey().toUpperCase() === target) {
      return { keypair: stored, credentialId: cid }
    }
  }

  const byPk = await getKeypairByPublicKey(target, preferredCredentialId)
  if (byPk?.publicKey().toUpperCase() === target) {
    return {
      keypair: byPk,
      credentialId: preferredCredentialId ?? candidates[0] ?? "",
    }
  }

  for (const cid of candidates) {
    const matched = await deriveMatchingKeypair(cid, userId, target)
    if (matched) {
      return { keypair: matched.keypair, credentialId: cid }
    }
  }

  return null
}

/** Derive the passkey-bound G signer (first credential that yields a G). */
export async function derivePrimaryPasskeySignerG(
  userId: string,
  preferredCredentialId?: string | null,
  requiredPublicKey?: string
): Promise<{ publicKey: string; credentialId: string } | null> {
  const candidates = await collectCredentialIdCandidates(preferredCredentialId, userId)
  const required = requiredPublicKey?.trim().toUpperCase()

  for (const cid of candidates) {
    try {
      const { publicKey } = await deriveAndStoreKey(cid, userId, {
        requiredPublicKey: required,
      })
      const pk = publicKey.trim().toUpperCase()
      if (pk.startsWith("G") && pk.length === 56) {
        return { publicKey: pk, credentialId: cid }
      }
    } catch {
      // try next credential
    }
  }
  return null
}

async function fetchRegisteredSignerG(userId: string): Promise<string | null> {
  try {
    const res = await fetch("/api/wallet/stellar/address", {
      headers: { "x-user-id": userId },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      signerPublicKey?: string | null
      publicKey?: string | null
    }
    const signer = data.signerPublicKey?.trim().toUpperCase()
    if (signer?.startsWith("G") && signer.length === 56) return signer
    const pk = data.publicKey?.trim().toUpperCase()
    if (pk?.startsWith("G") && pk.length === 56) return pk
  } catch {
    // non-fatal
  }
  return null
}

/** Align DB signer_public_key with passkey-derived G (new wallets only). */
export async function syncPasskeySignerToServer(
  userId: string,
  preferredCredentialId?: string | null
): Promise<{ publicKey: string; credentialId: string }> {
  const derived = await derivePrimaryPasskeySignerG(userId, preferredCredentialId)
  if (!derived) {
    throw new Error(
      "No pudimos derivar tu clave Stellar desde el passkey. Cerrá sesión e iniciá de nuevo con passkey."
    )
  }

  const res = await fetch("/api/wallet/stellar/sync-signer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({
      signerPublicKey: derived.publicKey,
      credentialId: derived.credentialId,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; signerPublicKey?: string }
  if (!res.ok) {
    throw new Error(data.error ?? "No se pudo sincronizar la clave firmante de la billetera.")
  }

  const synced =
    typeof data.signerPublicKey === "string"
      ? data.signerPublicKey.trim().toUpperCase()
      : derived.publicKey

  return { publicKey: synced, credentialId: derived.credentialId }
}

/**
 * Prepare SEP-10 signing material for SDP.
 * Existing accounts: keep the registered G and find the passkey that controls it.
 * New accounts: derive G from passkey and sync to DB.
 */
export async function prepareSdpSigningMaterial(
  userId: string,
  preferredCredentialId?: string | null
): Promise<{ publicKey: string; credentialId: string }> {
  const registeredG = await fetchRegisteredSignerG(userId)

  if (registeredG) {
    let resolved = await resolveKeypairForSignerG(
      registeredG,
      userId,
      preferredCredentialId
    )

    if (!resolved) {
      await derivePrimaryPasskeySignerG(userId, preferredCredentialId, registeredG)
      resolved = await resolveKeypairForSignerG(
        registeredG,
        userId,
        preferredCredentialId
      )
    }

    if (!resolved) {
      throw new Error(
        `Tu passkey en este dispositivo no controla la billetera registrada para este pago (${registeredG.slice(0, 8)}…). ` +
          "Probá en el dispositivo donde creaste tu cuenta Sozu, o iniciá sesión con el passkey original."
      )
    }

    return { publicKey: registeredG, credentialId: resolved.credentialId }
  }

  return syncPasskeySignerToServer(userId, preferredCredentialId)
}
