"use client"

import type { SmartAccountKit } from "smart-account-kit"

/**
 * Best-effort reverse lookup via SDF's public smart-account indexer.
 *
 * The indexer is optional infrastructure. 5xx / timeouts / CORS must never
 * fail wallet create, login sync, or send alignment — those paths already
 * resolve contracts via DB + deterministic user-scoped deploy.
 */
export function extractContractIdFromDiscovery(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null
  if ("contract_id" in entry && typeof (entry as { contract_id: string }).contract_id === "string") {
    return (entry as { contract_id: string }).contract_id
  }
  if ("contractId" in entry && typeof (entry as { contractId: string }).contractId === "string") {
    return (entry as { contractId: string }).contractId
  }
  return null
}

export async function discoverContractsByCredentialSafe(
  kit: SmartAccountKit,
  credentialId: string,
  opts?: { timeoutMs?: number; logLabel?: string },
): Promise<unknown[] | null> {
  const timeoutMs = opts?.timeoutMs ?? 8_000
  const label = opts?.logLabel ?? "discoverContracts"

  try {
    const contracts = await Promise.race([
      kit.discoverContractsByCredential(credentialId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("indexer timed out")), timeoutMs),
      ),
    ])
    return Array.isArray(contracts) ? contracts : null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Quiet: React DevTools installHook turns console.warn(Error) into a red stack.
    console.info(`[${label}] indexer unavailable (${msg}); continuing without discovery`)
    return null
  }
}

export async function discoverFirstContractIdSafe(
  kit: SmartAccountKit,
  credentialId: string,
  opts?: { timeoutMs?: number; logLabel?: string },
): Promise<string | null> {
  const contracts = await discoverContractsByCredentialSafe(kit, credentialId, opts)
  const id = extractContractIdFromDiscovery(contracts?.[0])
  return id?.trim().toUpperCase() ?? null
}
