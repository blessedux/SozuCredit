import "server-only"

import { getDepositableUsdcBalance, getSorobanTokenBalance } from "@/lib/stellar/soroban-token"
import { getStellarConfig } from "@/lib/turnkey/config"

const CIRCLE_TESTNET_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

export type UsdcBalanceBreakdown = {
  /** Balance used for Soroban sends from a C wallet (BlendUSDC on testnet). */
  sorobanOnWallet: number
  /** Classic Circle USDC on the same address when it is a G account. */
  classicOnWallet: number
  /** Classic USDC on the linked G signer when the wallet is C (not spendable via smart rail). */
  classicOnSigner: number
  /** What the payment API enforces for the primary wallet address. */
  spendable: number
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
    const sorobanOnWallet = await getDepositableUsdcBalance(wallet, network)
    const classicOnSigner =
      signer && signer !== wallet ? await getClassicUsdcOnG(signer) : 0

    return {
      sorobanOnWallet,
      classicOnWallet: 0,
      classicOnSigner,
      spendable: sorobanOnWallet,
      spendableAssetLabel: network === "testnet" ? "BlendUSDC" : "USDC",
      walletAddress: wallet,
      signerPublicKey: signer,
      network,
    }
  }

  const classicOnWallet = await getClassicUsdcOnG(wallet)
  return {
    sorobanOnWallet: 0,
    classicOnWallet,
    classicOnSigner: 0,
    spendable: classicOnWallet,
    spendableAssetLabel: "USDC",
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
