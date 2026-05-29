/**
 * Network-aware Blend pool deep links for APY verification.
 *
 * Testnet defaults from blend-capital/blend-utils testnet.contracts.json (TestnetV2 + USDC reserve).
 * Mainnet defaults from blend.capital mainnet deployments (Fixed USDC pool).
 *
 * Override via env when pools are redeployed:
 *   NEXT_PUBLIC_BLEND_TESTNET_POOL_ID
 *   NEXT_PUBLIC_BLEND_TESTNET_USDC_RESERVE
 *   NEXT_PUBLIC_BLEND_MAINNET_POOL_ID
 *   NEXT_PUBLIC_BLEND_MAINNET_USDC_RESERVE
 */

export type StellarNetwork = "testnet" | "mainnet"

export type BlendStrategyLink = {
  network: StellarNetwork
  poolId: string
  assetId: string
  /** e.g. "Blend TestnetV2 · USDC" */
  poolLabel: string
  url: string
}

const MAINNET_POOL_ID =
  process.env.NEXT_PUBLIC_BLEND_MAINNET_POOL_ID ??
  "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD"

const MAINNET_USDC_RESERVE =
  process.env.NEXT_PUBLIC_BLEND_MAINNET_USDC_RESERVE ??
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"

const TESTNET_POOL_ID =
  process.env.NEXT_PUBLIC_BLEND_TESTNET_POOL_ID ??
  "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF"

const TESTNET_USDC_RESERVE =
  process.env.NEXT_PUBLIC_BLEND_TESTNET_USDC_RESERVE ??
  "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"

export function resolveStellarNetwork(network?: string | null): StellarNetwork {
  const raw =
    network ??
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_STELLAR_NETWORK
      : undefined) ??
    "testnet"
  return raw === "mainnet" ? "mainnet" : "testnet"
}

export function getBlendStrategyLink(network?: string | null): BlendStrategyLink {
  const resolved = resolveStellarNetwork(network)

  if (resolved === "mainnet") {
    return {
      network: "mainnet",
      poolId: MAINNET_POOL_ID,
      assetId: MAINNET_USDC_RESERVE,
      poolLabel: "Blend · USDC",
      url: `https://mainnet.blend.capital/asset/?poolId=${MAINNET_POOL_ID}&assetId=${MAINNET_USDC_RESERVE}`,
    }
  }

  return {
    network: "testnet",
    poolId: TESTNET_POOL_ID,
    assetId: TESTNET_USDC_RESERVE,
    poolLabel: "Blend TestnetV2 · USDC",
    url: `https://testnet.blend.capital/asset/?poolId=${TESTNET_POOL_ID}&assetId=${TESTNET_USDC_RESERVE}`,
  }
}

export function openBlendStrategyAsset(network?: string | null): BlendStrategyLink {
  const link = getBlendStrategyLink(network)
  if (typeof window !== "undefined") {
    window.open(link.url, "_blank", "noopener,noreferrer")
  }
  return link
}
