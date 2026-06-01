import "server-only"

import { getDepositableUsdcBalance } from "@/lib/stellar/soroban-token"
import { getAssetById } from "@/lib/stellar/asset-registry"
import {
  getHolderTokenBalances,
  sumRegistryBalances,
} from "@/lib/stellar/token-balances"
import { spendableAssetLabelForBalances } from "@/lib/stellar/usdc-send-token"
import { getStellarConfig } from "@/lib/turnkey/config"
import type { HolderTokenBalance, StellarNetwork } from "@/lib/stellar/asset-types"

const CIRCLE_TESTNET_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

export type UsdcBalanceBreakdown = {
  /** Per-contract balances (source of truth). */
  tokenBalances: HolderTokenBalance[]
  /** Blend USDC on C — legacy field */
  sorobanOnWallet: number
  /** Circle SAC on C — legacy field */
  sorobanSacOnWallet: number
  /** Sozu internal test USDC on C */
  sorobanSozuInternalOnWallet: number
  classicOnWallet: number
  classicOnSigner: number
  /** USDC still on G signer (not spendable from C); shown only for migration warnings. */
  legacyUsdcOnSigner: number
  /** Sum of registry Soroban balances (each send still uses one contractId). */
  spendable: number
  displayOnWallet: number
  spendableAssetLabel: string
  walletAddress: string
  signerPublicKey: string | null
  network: StellarNetwork
}

async function getClassicUsdcOnG(publicKey: string): Promise<number> {
  const pk = publicKey.trim()
  if (!pk.startsWith("G") || pk.length !== 56) return 0

  const { getUSDCBalance } = await import("@/lib/turnkey/stellar-wallet")
  return getUSDCBalance(pk)
}

function balanceForId(
  rows: HolderTokenBalance[],
  assetId: string,
): number {
  return rows.find((r) => r.asset.id === assetId)?.balance ?? 0
}

type CacheEntry = { expiresAt: number; value: UsdcBalanceBreakdown }
const BREAKDOWN_CACHE_TTL_MS = 3_000
const _breakdownCache = new Map<string, CacheEntry>()

function cacheKey(wallet: string, signer: string | null, network: StellarNetwork): string {
  return `${network}:${wallet}:${signer ?? ""}`
}

/**
 * Unified balance for display and send pre-checks.
 * Assets are keyed by contractId via the asset registry — never by symbol alone.
 */
export async function getUsdcBalanceBreakdown(params: {
  walletAddress: string
  signerPublicKey?: string | null
  network?: StellarNetwork
}): Promise<UsdcBalanceBreakdown> {
  const cfg = getStellarConfig()
  const network = params.network ?? cfg.network
  const wallet = params.walletAddress.trim().toUpperCase()
  const signer = params.signerPublicKey?.trim().toUpperCase() ?? null

  // Hot path cache: payment build calls this often (prefetch + send).
  // Keep TTL very short so balance remains fresh while still eliminating 2× round-trips.
  const key = cacheKey(wallet, signer, network)
  const cached = _breakdownCache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.value

  if (wallet.startsWith("C")) {
    const tokenBalances = await getHolderTokenBalances(wallet, network)
    const blend = balanceForId(tokenBalances, "blend_usdc")
    const sac = balanceForId(tokenBalances, "circle_usdc_sac")
    const sozuInternal = balanceForId(tokenBalances, "sozu_internal_usdc")
    const legacyUsdcOnSigner =
      signer && signer !== wallet ? await getClassicUsdcOnG(signer) : 0
    const spendable = sumRegistryBalances(tokenBalances)
    // G is fee-only (XLM); USDC treasury is C.
    const displayOnWallet = spendable

    const value: UsdcBalanceBreakdown = {
      tokenBalances,
      sorobanOnWallet: blend,
      sorobanSacOnWallet: sac,
      sorobanSozuInternalOnWallet: sozuInternal,
      classicOnWallet: 0,
      classicOnSigner: 0,
      legacyUsdcOnSigner,
      spendable,
      displayOnWallet,
      spendableAssetLabel: spendableAssetLabelForBalances(
        network,
        blend,
        sac,
        sozuInternal,
      ),
      walletAddress: wallet,
      signerPublicKey: signer,
      network,
    }
    _breakdownCache.set(key, { value, expiresAt: Date.now() + BREAKDOWN_CACHE_TTL_MS })
    return value
  }

  const classicOnWallet = await getClassicUsdcOnG(wallet)
  const sorobanOnG =
    network === "testnet" ? await getDepositableUsdcBalance(wallet, network) : 0
  const blendAsset = getAssetById("blend_usdc", network)
  const tokenBalances: HolderTokenBalance[] = blendAsset
    ? [{ asset: blendAsset, balance: sorobanOnG }]
    : []
  const displayOnWallet = classicOnWallet + sorobanOnG

  const value: UsdcBalanceBreakdown = {
    tokenBalances,
    sorobanOnWallet: sorobanOnG,
    sorobanSacOnWallet: 0,
    sorobanSozuInternalOnWallet: 0,
    classicOnWallet,
    classicOnSigner: 0,
    legacyUsdcOnSigner: 0,
    spendable: network === "testnet" ? sorobanOnG || classicOnWallet : classicOnWallet,
    displayOnWallet,
    spendableAssetLabel:
      network === "testnet" && sorobanOnG > 0 ? "Blend USDC" : "USDC",
    walletAddress: wallet,
    signerPublicKey: signer,
    network,
  }
  _breakdownCache.set(key, { value, expiresAt: Date.now() + BREAKDOWN_CACHE_TTL_MS })
  return value
}

export async function getSpendableUsdcBalance(
  walletAddress: string,
  signerPublicKey?: string | null,
  network?: StellarNetwork,
): Promise<number> {
  const b = await getUsdcBalanceBreakdown({ walletAddress, signerPublicKey, network })
  return b.spendable
}

export { CIRCLE_TESTNET_USDC_ISSUER }
