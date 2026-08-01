"use client"

import { getSmartAccountKit } from "@/lib/stellar/smartAccounts/client"
import { registerOzSmartAccount } from "@/lib/stellar/smartAccounts/registerWalletClient"
import { discoverFirstContractIdSafe } from "@/lib/stellar/smartAccounts/discover-contracts"
import { deriveAndStoreKey } from "@/lib/storage/browser-keys"
import { getCurrentCredentialId, storeCredentialIdInSession } from "@/lib/storage/key-utils"
import { persistCanonicalWalletSession } from "@/lib/wallet/persist-wallet-session"

type AlignResult = { contractId: string; signerG: string; credentialId: string; realigned: boolean }

const ALIGN_CACHE_KEY = "sozu_wallet_align_v1"
const ALIGN_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface AlignCache {
  contractId: string
  signerG: string
  credentialId: string
  userId: string
  ts: number
}

function readAlignCache(userId: string): AlignCache | null {
  try {
    const raw = sessionStorage.getItem(ALIGN_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AlignCache
    if (
      parsed.userId === userId &&
      parsed.contractId?.startsWith("C") &&
      Date.now() - parsed.ts < ALIGN_CACHE_TTL_MS
    )
      return parsed
  } catch {
    /* ignore */
  }
  return null
}

function writeAlignCache(data: Omit<AlignCache, "ts">): void {
  try {
    sessionStorage.setItem(ALIGN_CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
  } catch {
    /* quota / private browsing */
  }
}

function clearAlignCache(): void {
  try {
    sessionStorage.removeItem(ALIGN_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Fast variant: returns cached alignment when the session C matches and cache is fresh.
 * Falls back to full alignment (which may discover and re-register a new C) on miss or mismatch.
 */
export async function alignWalletForSendFast(
  userId: string,
  sessionC: string,
): Promise<AlignResult> {
  const sessionNorm = sessionC.trim().toUpperCase()

  const cached = readAlignCache(userId)
  if (cached && cached.contractId === sessionNorm) {
    return { contractId: cached.contractId, signerG: cached.signerG, credentialId: cached.credentialId, realigned: false }
  }

  // Cache cold or mismatched — run full alignment with a timeout guard.
  const DISCOVER_TIMEOUT_MS = 8_000
  const result = await Promise.race([
    alignWalletForSend(userId, sessionC),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("[alignWalletForSend] timed out after 8s")), DISCOVER_TIMEOUT_MS),
    ),
  ])

  writeAlignCache({ userId, contractId: result.contractId, signerG: result.signerG, credentialId: result.credentialId })
  return result
}

/** Invalidate cached alignment (call after sign-out or wallet change). */
export function invalidateAlignCache(): void {
  clearAlignCache()
}

/**
 * Ensures session/DB C matches the passkey's on-chain OZ smart account before Soroban sends.
 */
export async function alignWalletForSend(
  userId: string,
  sessionC: string,
): Promise<{ contractId: string; signerG: string; credentialId: string; realigned: boolean }> {
  const credId =
    (await getCurrentCredentialId(undefined)) ??
    (typeof window !== "undefined" ? sessionStorage.getItem("credential_id") : null)

  if (!credId) {
    throw new Error("Passkey session missing. Sign out and sign in again.")
  }

  storeCredentialIdInSession(credId)
  const { publicKey: signerG } = await deriveAndStoreKey(credId, userId)
  const g = signerG.trim().toUpperCase()
  if (!g.startsWith("G") || g.length !== 56) {
    throw new Error("Invalid passkey signer (G…). Sign in again.")
  }

  const sessionNorm = sessionC.trim().toUpperCase()
  let onChainC: string | null = null

  try {
    const { kit } = await getSmartAccountKit()
    const { deriveOzContractIdForUser } = await import(
      "@/lib/stellar/smartAccounts/deployOzForUser"
    )
    const kitAny = kit as unknown as {
      deployerKeypair?: { publicKey(): string }
      networkPassphrase?: string
    }
    const deployerPk = kitAny.deployerKeypair?.publicKey?.()
    const passphrase = kitAny.networkPassphrase
    if (deployerPk && passphrase) {
      const derived = deriveOzContractIdForUser({
        credentialId: credId,
        userId,
        networkPassphrase: passphrase,
        deployerPublicKey: deployerPk,
      })
      const probe = await fetch(
        `/api/smart-accounts/resolve-key-data?${new URLSearchParams({
          contractId: derived,
          credentialId: credId,
        })}`,
        { headers: { "x-user-id": userId } },
      )
      if (probe.ok) onChainC = derived
    }
    if (!onChainC) {
      onChainC = await discoverFirstContractIdSafe(kit, credId, {
        logLabel: "alignWalletForSend",
      })
    }
  } catch (e) {
    console.info(
      "[alignWalletForSend] on-chain probe failed:",
      e instanceof Error ? e.message : e,
    )
  }

  if (onChainC?.startsWith("C") && onChainC.length === 56) {
    const keyProbe = await fetch(
      `/api/smart-accounts/resolve-key-data?${new URLSearchParams({
        contractId: onChainC,
        credentialId: credId,
      })}`,
      { headers: { "x-user-id": userId } },
    )
    if (!keyProbe.ok) {
      console.warn(
        "[alignWalletForSend] Passkey not on discovered C — run wallet setup on this URL (same host/port as login)",
        onChainC.slice(0, 12),
      )
    }

    if (onChainC !== sessionNorm) {
      console.warn("[alignWalletForSend] Realigning C", {
        session: sessionNorm.slice(0, 12),
        onChain: onChainC.slice(0, 12),
      })
      const { parsePasskeyPublicKey65 } = await import(
        "@/lib/stellar/smartAccounts/passkeyPublicKey"
      )
      const primaryRes = await fetch("/api/auth/passkeys/primary", {
        headers: { "x-user-id": userId },
      })
      const primary = (await primaryRes.json().catch(() => ({}))) as {
        publicKey65b?: string
      }
      if (!primaryRes.ok || !primary.publicKey65b) {
        throw new Error("Passkey public key missing. Sign in again.")
      }
      await registerOzSmartAccount({
        contractId: onChainC,
        credentialId: credId,
        publicKey: parsePasskeyPublicKey65(primary.publicKey65b),
        signerPublicKey: g,
      })
      persistCanonicalWalletSession(onChainC, "oz", credId)
      return { contractId: onChainC, signerG: g, credentialId: credId, realigned: true }
    }
    return { contractId: onChainC, signerG: g, credentialId: credId, realigned: false }
  }

  if (sessionNorm.startsWith("C") && sessionNorm.length === 56) {
    return { contractId: sessionNorm, signerG: g, credentialId: credId, realigned: false }
  }

  throw new Error(
    "No smart account (C…) linked to this passkey. Open Depositar or Settings and complete wallet setup.",
  )
}
