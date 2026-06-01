import "server-only"

import { Asset, Networks } from "@stellar/stellar-sdk"
import { normalizeStellarContractId } from "@/lib/stellar/contract-id"
import { getDefaultAssetRegistry } from "@/lib/stellar/asset-registry-core"
import type { SozuAsset, StellarNetwork } from "@/lib/stellar/asset-types"

function contractFromEnv(
  envKey: string,
  fallback: string,
): string {
  return normalizeStellarContractId(process.env[envKey], fallback, envKey)
}

function optionalContractFromEnv(envKey: string): string | null {
  const v = process.env[envKey]?.trim().toUpperCase()
  if (v?.startsWith("C") && v.length === 56) return v
  return null
}

function circleSacTestnetId(): string | null {
  const override = optionalContractFromEnv("TESTNET_CIRCLE_USDC_SAC_CONTRACT_ADDRESS")
  if (override) return override
  try {
    const issuer =
      process.env.CIRCLE_TESTNET_USDC_ISSUER?.trim() ||
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    return new Asset("USDC", issuer).contractId(Networks.TESTNET)
  } catch {
    return null
  }
}

function buildTestnetRegistry(): SozuAsset[] {
  const defaults = getDefaultAssetRegistry("testnet")
  const blendDefault = defaults.find((a) => a.id === "blend_usdc")!
  const sacDefault = defaults.find((a) => a.id === "circle_usdc_sac")

  const assets: SozuAsset[] = [
    {
      ...blendDefault,
      contractId: contractFromEnv(
        "TESTNET_USDC_CONTRACT_ADDRESS",
        blendDefault.contractId,
      ),
    },
  ]

  const sacId = circleSacTestnetId() ?? sacDefault?.contractId
  if (sacId) {
    assets.push({
      ...(sacDefault ?? {
        id: "circle_usdc_sac",
        symbol: "USDC",
        name: "Circle USDC",
        displayName: "Circle USDC",
        decimals: 7,
        network: "testnet",
        issuer: "Circle",
        category: "stablecoin",
        sendPriority: 20,
      }),
      contractId: sacId,
    })
  }

  const sozuInternal = optionalContractFromEnv("TESTNET_SOZU_INTERNAL_USDC_CONTRACT_ID")
  if (sozuInternal) {
    assets.push({
      id: "sozu_internal_usdc",
      contractId: sozuInternal,
      symbol: "USDC",
      name: "Sozu Test USDC",
      displayName: "Sozu Test USDC",
      decimals: 7,
      network: "testnet",
      issuer: "Sozu",
      category: "internal",
      sendPriority: 30,
    })
  }

  return assets
}

function buildMainnetRegistry(): SozuAsset[] {
  const defaults = getDefaultAssetRegistry("mainnet")[0]
  return [
    {
      ...defaults,
      contractId: contractFromEnv(
        "MAINNET_USDC_CONTRACT_ADDRESS",
        defaults.contractId,
      ),
    },
  ]
}

const REGISTRY_CACHE: Partial<Record<StellarNetwork, SozuAsset[]>> = {}

/** Known sendable Soroban tokens for a network (registry + env extensions). */
export function getAssetRegistry(network: StellarNetwork): SozuAsset[] {
  if (!REGISTRY_CACHE[network]) {
    REGISTRY_CACHE[network] =
      network === "mainnet" ? buildMainnetRegistry() : buildTestnetRegistry()
  }
  return REGISTRY_CACHE[network]!
}

export function getAssetById(
  assetId: string,
  network: StellarNetwork,
): SozuAsset | undefined {
  return getAssetRegistry(network).find((a) => a.id === assetId)
}

export function getAssetByContractId(
  contractId: string,
  network: StellarNetwork,
): SozuAsset | undefined {
  const id = contractId.trim().toUpperCase()
  return getAssetRegistry(network).find((a) => a.contractId === id)
}

export function isRegisteredSendAsset(
  contractId: string,
  network: StellarNetwork,
): boolean {
  return !!getAssetByContractId(contractId, network)
}

/** Blend / DeFindex strategies must use this reserve contract, not a ticker. */
export function getBlendUsdcAsset(network: StellarNetwork): SozuAsset {
  const asset =
    network === "testnet"
      ? getAssetById("blend_usdc", network)
      : getAssetById("mainnet_usdc", network)
  if (!asset) {
    throw new Error(`Blend USDC asset not configured for ${network}`)
  }
  return asset
}
