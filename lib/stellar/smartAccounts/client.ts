"use client"

import { SmartAccountKit, IndexedDBStorage, type SmartAccountConfig } from "smart-account-kit"

export type SmartAccountKitConfigResponse = {
  rpcUrl: string
  networkPassphrase: string
  accountWasmHash: string
  webauthnVerifierAddress: string
  thresholdPolicyAddress: string
}

let _kit: SmartAccountKit | null = null
let _cfg: SmartAccountKitConfigResponse | null = null

async function loadConfig(): Promise<SmartAccountKitConfigResponse> {
  if (_cfg) return _cfg
  const res = await fetch("/api/smart-accounts/config")
  const data = (await res.json().catch(() => ({}))) as Partial<SmartAccountKitConfigResponse> & {
    error?: string
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load smart account config")
  }
  if (!data.rpcUrl || !data.networkPassphrase || !data.accountWasmHash || !data.webauthnVerifierAddress) {
    throw new Error("Smart account config is incomplete")
  }
  _cfg = data as SmartAccountKitConfigResponse
  return _cfg
}

export async function getSmartAccountKit(): Promise<{
  kit: SmartAccountKit
  config: SmartAccountKitConfigResponse
}> {
  const config = await loadConfig()
  if (_kit) return { kit: _kit, config }

  const rpId = typeof window !== "undefined" ? window.location.hostname : undefined
  const kitConfig: SmartAccountConfig = {
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    accountWasmHash: config.accountWasmHash,
    webauthnVerifierAddress: config.webauthnVerifierAddress,
    storage: new IndexedDBStorage(),
    rpId,
    rpName: "Sozu Credit",
  }

  _kit = new SmartAccountKit(kitConfig)
  return { kit: _kit, config }
}
