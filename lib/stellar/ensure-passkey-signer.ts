"use client"

import { Keypair } from "@stellar/stellar-sdk"
import { normalizeCredentialId } from "@/lib/webauthn/normalize-credential-id"
import {
  deriveAndStoreKey,
  retrieveKeypair,
  getKeypairByPublicKey,
} from "@/lib/storage/browser-keys"

function addCredentialCandidate(ids: Set<string>, id?: string | null): void {
  const trimmed = id?.trim()
  if (!trimmed) return
  ids.add(normalizeCredentialId(trimmed))
}

/** Collect passkey credential ids from session, storage, and server. */
export async function collectCredentialIdCandidates(
  preferred?: string | null,
  userId?: string | null
): Promise<string[]> {
  const ids = new Set<string>()
  addCredentialCandidate(ids, preferred)

  if (typeof window !== "undefined") {
    addCredentialCandidate(ids, sessionStorage.getItem("credential_id"))
    addCredentialCandidate(ids, localStorage.getItem("credential_id"))
    addCredentialCandidate(ids, sessionStorage.getItem("credential_raw_id"))
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
    if (stored?.publicKey() === target) {
      return { keypair: stored, credentialId: cid }
    }
  }

  const byPk = await getKeypairByPublicKey(target, preferredCredentialId)
  if (byPk?.publicKey() === target) {
    return {
      keypair: byPk,
      credentialId: preferredCredentialId ?? candidates[0] ?? "",
    }
  }

  for (const cid of candidates) {
    const derived = await deriveAndStoreKey(cid, userId)
    if (derived.publicKey === target) {
      return { keypair: derived.keypair, credentialId: cid }
    }
  }

  return null
}

/** Derive the passkey-bound G signer (first matching credential). */
export async function derivePrimaryPasskeySignerG(
  userId: string,
  preferredCredentialId?: string | null
): Promise<{ publicKey: string; credentialId: string } | null> {
  const candidates = await collectCredentialIdCandidates(preferredCredentialId, userId)
  for (const cid of candidates) {
    const derived = await deriveAndStoreKey(cid, userId)
    const pk = derived.publicKey.trim().toUpperCase()
    if (pk.startsWith("G") && pk.length === 56) {
      return { publicKey: pk, credentialId: cid }
    }
  }
  return null
}

/** Align DB signer_public_key with passkey-derived G before SEP-10. */
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
