import "server-only"

import {
  getDepositableUsdcBalance,
  getSorobanUsdcOnContractWallet,
} from "@/lib/stellar/soroban-token"
import { getStellarConfig } from "@/lib/turnkey/config"

const CIRCLE_TESTNET_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

export type UsdcBalanceBreakdown = {
  /** BlendUSDC (or mainnet USDC token) on the canonical wallet — used for sends. */
  sorobanOnWallet: number
  /** Circle USDC SAC on a C wallet (testnet only; not used for sends today). */
  sorobanSacOnWallet: number
  /** Classic Circle USDC on the same address when it is a G account. */
  classicOnWallet: number
  /** Classic USDC on the linked G signer when the wallet is C (not spendable via smart rail). */
  classicOnSigner: number
  /** What the payment API enforces for the primary wallet address. */
  spendable: number
  /** All USDC the user can see (wallet + signer + strategy added separately in API). */
  displayOnWallet: number
  spendableAssetLabel: string
  walletAddress: string
  signerPublicKey: string | null
  network: "testnet" | "mainnet"
}

async function getClassicUsdcOnG(publicKey: string): Promise<number> {
  const pk = publicKey.trim()
  if (!pk.startsWith("G") || pk.length !== 56) return 0

  const { getUSDCBalance } = await import("@/lib/turnkey/stellar-wallet")
  return getUSDCBalance(pk)
}

/**
 * Unified USDC balance for display and send pre-checks.
 *
 * Testnet smart accounts (C) hold **BlendUSDC** (Soroban). Circle testnet USDC on a
 * classic G trustline is a different asset and does not fund C→* Soroban transfers.
 */
export async function getUsdcBalanceBreakdown(params: {
  walletAddress: string
  signerPublicKey?: string | null
  network?: "testnet" | "mainnet"
}): Promise<UsdcBalanceBreakdown> {
  const cfg = getStellarConfig()
  const network = params.network ?? cfg.network
  const wallet = params.walletAddress.trim().toUpperCase()
  const signer = params.signerPublicKey?.trim().toUpperCase() ?? null

  if (wallet.startsWith("C")) {
    const soroban = await getSorobanUsdcOnContractWallet(wallet, network)
    const classicOnSigner =
      signer && signer !== wallet ? await getClassicUsdcOnG(signer) : 0
    const displayOnWallet = soroban.total + classicOnSigner
    const spendableAssetLabel =
      network === "testnet"
        ? soroban.blend > 0
          ? "BlendUSDC"
          : soroban.circleSac > 0
            ? "USDC (SAC)"
            : "BlendUSDC"
        : "USDC"

    return {
      sorobanOnWallet: soroban.blend,
      sorobanSacOnWallet: soroban.circleSac,
      classicOnWallet: 0,
      classicOnSigner,
      spendable: soroban.blend,
      displayOnWallet,
      spendableAssetLabel,
      walletAddress: wallet,
      signerPublicKey: signer,
      network,
    }
  }

  const classicOnWallet = await getClassicUsdcOnG(wallet)
  const sorobanOnG =
    network === "testnet" ? await getDepositableUsdcBalance(wallet, network) : 0
  const displayOnWallet = classicOnWallet + sorobanOnG

  return {
    sorobanOnWallet: sorobanOnG,
    sorobanSacOnWallet: 0,
    classicOnWallet,
    classicOnSigner: 0,
    spendable: network === "testnet" ? sorobanOnG || classicOnWallet : classicOnWallet,
    displayOnWallet,
    spendableAssetLabel: network === "testnet" && sorobanOnG > 0 ? "BlendUSDC" : "USDC",
    walletAddress: wallet,
    signerPublicKey: signer,
    network,
  }
}

export async function getSpendableUsdcBalance(
  walletAddress: string,
  signerPublicKey?: string | null,
  network?: "testnet" | "mainnet"
): Promise<number> {
  const b = await getUsdcBalanceBreakdown({ walletAddress, signerPublicKey, network })
  return b.spendable
}

export { CIRCLE_TESTNET_USDC_ISSUER }
