/**
 * @deprecated Use `@/lib/stellar/pick-send-token` and `@/lib/stellar/asset-registry`.
 */
import { getBlendUsdcAsset, getAssetById } from "@/lib/stellar/asset-registry"
import type { StellarNetwork } from "@/lib/stellar/asset-types"
import { pickSendToken } from "@/lib/stellar/pick-send-token"
import type { HolderTokenBalance } from "@/lib/stellar/asset-types"

export type UsdcSendTokenRail = "blend" | "circle_sac" | "sozu_internal"

export type PickedUsdcSendToken = {
  rail: UsdcSendTokenRail
  contractId: string
  label: string
  balance: number
}

function railFromAssetId(assetId: string): UsdcSendTokenRail {
  if (assetId === "circle_usdc_sac") return "circle_sac"
  if (assetId === "sozu_internal_usdc") return "sozu_internal"
  return "blend"
}

export function spendableAssetLabelForBalances(
  network: StellarNetwork,
  blend: number,
  sac: number,
  sozuInternal = 0,
): string {
  const labels: string[] = []
  if (blend > 0) labels.push("Blend USDC")
  if (sac > 0) labels.push("Circle USDC")
  if (sozuInternal > 0) labels.push("Sozu Test USDC")
  if (labels.length === 0) return network === "testnet" ? "Blend USDC" : "USDC"
  if (labels.length === 1) return labels[0]
  return labels.join(" + ")
}

/** @deprecated */
export function pickUsdcSendToken(params: {
  network: StellarNetwork
  blendBalance: number
  sacBalance: number
  amountRequired: number
  sozuInternalBalance?: number
}): PickedUsdcSendToken | null {
  const balances: HolderTokenBalance[] = []
  const blend = getBlendUsdcAsset(params.network)
  balances.push({ asset: blend, balance: params.blendBalance })

  const sac = getAssetById("circle_usdc_sac", params.network)
  if (sac) balances.push({ asset: sac, balance: params.sacBalance })

  const sozu = getAssetById("sozu_internal_usdc", params.network)
  if (sozu) {
    balances.push({
      asset: sozu,
      balance: params.sozuInternalBalance ?? 0,
    })
  }

  const picked = pickSendToken({
    balances,
    amountRequired: params.amountRequired,
    network: params.network,
  })
  if (!picked) return null

  return {
    rail: railFromAssetId(picked.asset.id),
    contractId: picked.asset.contractId,
    label: picked.asset.displayName,
    balance: picked.balance,
  }
}

export function combinedSpendableOnSmartWallet(
  network: StellarNetwork,
  blend: number,
  sac: number,
  sozuInternal = 0,
): number {
  if (network === "mainnet") return blend
  return blend + sac + sozuInternal
}
