import { Asset, Networks } from "@stellar/stellar-sdk"
import {
  getDefaultTestnetBlendUsdcId,
} from "@/lib/stellar/contract-id"
import type { SozuAsset, StellarNetwork } from "@/lib/stellar/asset-types"
import {
  DEFAULT_TESTNET_PIZZA_TOKEN_ID,
  PIZZA_ASSET_ID,
  PIZZA_DECIMALS,
  PIZZA_NAME,
  PIZZA_SYMBOL,
} from "@/lib/stellar/pizza-token"

const MAINNET_USDC_DEFAULT =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"

const CIRCLE_TESTNET_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

function circleSacTestnetDefault(): string {
  return new Asset("USDC", CIRCLE_TESTNET_ISSUER).contractId(Networks.TESTNET)
}

/** Client-safe defaults; server registry may override via env. */
export function getDefaultAssetRegistry(network: StellarNetwork): SozuAsset[] {
  if (network === "mainnet") {
    return [
      {
        id: "mainnet_usdc",
        contractId: MAINNET_USDC_DEFAULT,
        symbol: "USDC",
        name: "USDC",
        displayName: "USDC",
        decimals: 7,
        network: "mainnet",
        issuer: "Circle",
        category: "stablecoin",
        sendPriority: 10,
      },
    ]
  }

  return [
    {
      id: "blend_usdc",
      contractId: getDefaultTestnetBlendUsdcId(),
      symbol: "USDC",
      name: "Blend USDC",
      displayName: "Blend USDC",
      decimals: 7,
      network: "testnet",
      issuer: "Blend",
      category: "stablecoin",
      sendPriority: 15,
    },
    {
      id: "circle_usdc_sac",
      contractId: circleSacTestnetDefault(),
      symbol: "USDC",
      name: "Circle USDC",
      displayName: "Circle USDC",
      decimals: 7,
      network: "testnet",
      issuer: "Circle",
      category: "stablecoin",
      /** Default send rail for Sozu / SozuPay C↔C (same SAC as org treasuries). */
      sendPriority: 5,
    },
    {
      id: PIZZA_ASSET_ID,
      contractId: DEFAULT_TESTNET_PIZZA_TOKEN_ID,
      symbol: PIZZA_SYMBOL,
      name: PIZZA_NAME,
      displayName: PIZZA_NAME,
      decimals: PIZZA_DECIMALS,
      network: "testnet",
      issuer: "Sozu",
      category: "sku",
      /** Never auto-pick ahead of USDC; Send must pass this contractId explicitly. */
      sendPriority: 90,
    },
  ]
}

export function getDefaultBlendUsdcContractId(network: StellarNetwork): string {
  const reg = getDefaultAssetRegistry(network)
  const blend = reg.find((a) => a.id === "blend_usdc" || a.id === "mainnet_usdc")
  return blend?.contractId ?? getDefaultTestnetBlendUsdcId()
}
