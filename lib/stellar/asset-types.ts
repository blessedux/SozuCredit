export type StellarNetwork = "testnet" | "mainnet"

export type AssetCategory = "stablecoin" | "internal" | "rwa" | "yield"

/**
 * Contract-native asset descriptor. `contractId` is the source of truth;
 * `symbol` is display-only and may collide across assets.
 */
export interface SozuAsset {
  /** Stable registry key, e.g. blend_usdc_testnet */
  id: string
  contractId: string
  symbol: string
  name: string
  /** UI label, e.g. "Circle USDC" */
  displayName: string
  decimals: number
  network: StellarNetwork
  issuer?: string
  category: AssetCategory
  /** Lower = preferred when auto-picking a send token */
  sendPriority: number
}

export interface HolderTokenBalance {
  asset: SozuAsset
  balance: number
}

export interface PickedSendToken {
  asset: SozuAsset
  balance: number
}
