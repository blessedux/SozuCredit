"use client"

import { publicKeyToBase64Url } from "@/lib/stellar/smartAccounts/passkeyPublicKey"
import { getUserId } from "@/lib/wallet-utils"

export async function registerOzSmartAccount(params: {
  contractId: string
  credentialId: string
  publicKey: Uint8Array
}): Promise<void> {
  const userId = getUserId()
  if (!userId) throw new Error("Not authenticated")

  const res = await fetch("/api/smart-accounts/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({
      contractId: params.contractId,
      credentialId: params.credentialId,
      publicKey65b: publicKeyToBase64Url(params.publicKey),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Failed to save smart wallet")
  }
}

export async function resolvePublicKeyFromServer(params: {
  contractId: string
  credentialId: string
}): Promise<Uint8Array> {
  const userId = getUserId()
  const q = new URLSearchParams({
    contractId: params.contractId,
    credentialId: params.credentialId,
  })
  const res = await fetch(`/api/smart-accounts/resolve-public-key?${q}`, {
    headers: userId ? { "x-user-id": userId } : {},
  })
  const data = (await res.json().catch(() => ({}))) as { publicKey65b?: string; error?: string }
  if (!res.ok || !data.publicKey65b) {
    throw new Error(data.error ?? "Could not resolve passkey public key")
  }
  const padded = data.publicKey65b.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const bin = atob(padded + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
