/**
 * DeFindex Vault Service
 *
 * Orchestrates deposit, withdraw, and balance queries using the DeFindex SDK
 * (@defindex/sdk) rather than raw Soroban contract calls.  Transaction signing
 * and submission still flow through the existing Turnkey/passkey pipeline in
 * lib/turnkey/soroban-signing.ts.
 */

import { TransactionBuilder, Networks } from "@stellar/stellar-sdk"
import * as rpc from "@stellar/stellar-sdk/rpc"
import {
  getDepositableUsdcBalance,
  getSorobanUsdcOnContractWallet,
  getWalletSpendableUsdcOnC,
} from "@/lib/stellar/soroban-token"
import { getResolvedDeFindexConfig } from "./config"
import { signSorobanTransaction, submitSorobanTransaction } from "@/lib/turnkey/soroban-signing"
import { updatePositionOnDeposit, updatePositionOnWithdraw, saveTransaction, updateTransactionStatus } from "./positions"
import { getDeFindexConfig, validateDeFindexConfig } from "./config"
import { buildDepositXdr, buildWithdrawXdr, getVaultUserBalance, parseDfTokensMinted } from "./vault-sdk"
import type { StrategyId } from "./strategy-catalog"

export interface VaultBalance {
  walletBalance: number
  strategyBalance: number
  totalBalance: number
  strategyShares: number
}

export interface StrategyInfo {
  strategyAddress: string
  assetAddress: string
  apy: number
  totalAssets: number
  totalShares: number
}

/** Soroban RPC client instance. */
export function getSorobanRpc(networkStr?: string): rpc.Server {
  const config = getDeFindexConfig("fixed", networkStr)
  return new rpc.Server(config.rpcUrl, { allowHttp: config.network === "testnet" })
}

// ─── Balance ─────────────────────────────────────────────────────────────────

/**
 * Get vault balance for a user.
 *
 * Source priority:
 *   1. DeFindex SDK on-chain vault balance (dfTokens → underlying)
 *   2. Supabase defindex_positions (audit / fallback)
 *
 * Wallet balance is always fetched live from the Stellar network.
 */
export async function getVaultBalance(
  userWalletAddress: string,
  userId?: string,
  strategyId: StrategyId = "fixed"
): Promise<VaultBalance> {
  const config = await getResolvedDeFindexConfig(strategyId)

  if (!validateDeFindexConfig(config)) {
    throw new Error("DeFindex configuration is invalid. Please check environment variables.")
  }

  const pk = userWalletAddress.trim().toUpperCase()
  const walletBalance =
    pk.startsWith("C") && pk.length === 56
      ? await getWalletSpendableUsdcOnC(pk, config.network)
      : await getDepositableUsdcBalance(pk, config.network, config.assetAddress)

  // ── Primary: on-chain vault balance via DeFindex SDK ──────────────────────
  const { dfTokens: chainShares, underlyingUsdc: chainBalance } = await getVaultUserBalance(
    userWalletAddress,
    strategyId,
    config.network
  )

  if (chainBalance > 0 || chainShares > 0) {
    console.log(`[DeFindex] On-chain vault balance: ${chainBalance} USDC, ${chainShares} dfTokens`)
    return {
      walletBalance,
      strategyBalance: chainBalance,
      totalBalance: walletBalance + chainBalance,
      strategyShares: chainShares,
    }
  }

  // ── Secondary: Supabase position record ───────────────────────────────────
  if (userId) {
    try {
      const { createClient } = await import("@supabase/supabase-js")
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: position } = await supabase
          .from("defindex_positions")
          .select("*")
          .eq("user_id", userId)
          .eq("strategy_address", config.defindexStrategyAddress)
          .maybeSingle()

        if (position) {
          const dbBalance =
            Number(position.total_deposited ?? 0) - Number(position.total_withdrawn ?? 0)
          const dbShares = Number(position.shares ?? 0)
          console.log(`[DeFindex] DB position fallback: balance=${dbBalance}, shares=${dbShares}`)
          return {
            walletBalance,
            strategyBalance: Math.max(0, dbBalance),
            totalBalance: walletBalance + Math.max(0, dbBalance),
            strategyShares: dbShares,
          }
        }
      }
    } catch (dbError) {
      console.warn("[DeFindex] DB position lookup failed:", dbError)
    }
  }

  return {
    walletBalance,
    strategyBalance: 0,
    totalBalance: walletBalance,
    strategyShares: 0,
  }
}

// ─── Deposit ─────────────────────────────────────────────────────────────────

/**
 * Deposit assets into a DeFindex vault.
 *
 * Uses vault-sdk.ts (DeFindex SDK) to build the unsigned XDR, then signs and
 * submits via the existing Turnkey/passkey pipeline.
 */
export async function depositToStrategy(
  userWalletAddress: string,
  amount: number,
  userId?: string,
  strategyId: StrategyId = "fixed",
  credentialId?: string
): Promise<{ success: boolean; shares: number; balance: number; transactionHash?: string }> {
  const config = await getResolvedDeFindexConfig(strategyId)

  if (!validateDeFindexConfig(config)) {
    throw new Error("DeFindex configuration is invalid")
  }

  if (!userId) {
    throw new Error("User ID is required for transaction signing")
  }

  const pk = userWalletAddress.trim().toUpperCase()
  const vaultDepositBalance = await getDepositableUsdcBalance(
    pk,
    config.network,
    config.assetAddress,
  )
  if (vaultDepositBalance < amount) {
    const { circleSac } =
      pk.startsWith("C") && pk.length === 56
        ? await getSorobanUsdcOnContractWallet(pk, config.network)
        : { circleSac: 0 }
    if (circleSac > 0 && config.network === "testnet") {
      throw new Error(
        `Insufficient vault deposit token. This vault accepts ${config.assetAddress.slice(0, 8)}… ` +
          `(Blend pool USDC on testnet). You have Circle USDC SAC on C but not the vault deposit asset.`,
      )
    }
    throw new Error(
      `Insufficient balance for vault deposit. Available: ${vaultDepositBalance.toFixed(2)} USDC.`,
    )
  }

  // ── Build unsigned XDR via DeFindex SDK ────────────────────────────────
  console.log("[DeFindex] Building deposit XDR via DeFindex SDK...", {
    depositAsset: config.assetAddress,
  })
  const { xdr: depositXdr } = await buildDepositXdr(
    userWalletAddress,
    amount,
    strategyId,
    config.network
  )

  // ── Parse + sign ───────────────────────────────────────────────────────
  const networkPassphrase =
    config.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
  const transaction = TransactionBuilder.fromXDR(depositXdr, networkPassphrase)

  let resolvedCredentialId = credentialId
  if (!resolvedCredentialId && typeof window !== "undefined") {
    try {
      const { getCurrentCredentialId } = await import("../storage/key-utils")
      resolvedCredentialId = (await getCurrentCredentialId(userWalletAddress)) || undefined
    } catch {
      // non-critical
    }
  }

  const signedTransaction = await signSorobanTransaction(
    userId,
    transaction as Parameters<typeof signSorobanTransaction>[1],
    resolvedCredentialId
  )

  // ── Submit ─────────────────────────────────────────────────────────────
  console.log("[DeFindex] Submitting deposit transaction...")
  const submitResult = await submitSorobanTransaction(signedTransaction, config.network)

  if (!submitResult.success) {
    if (submitResult.transactionHash) {
      await saveTransaction(
        userId,
        submitResult.transactionHash,
        "deposit",
        amount,
        config.defindexStrategyAddress,
        { shares: 0, status: "failed", errorMessage: `Failed: ${submitResult.status}` },
        true
      ).catch(() => null)
    }
    throw new Error(`Deposit failed with status: ${submitResult.status}`)
  }

  console.log("[DeFindex] ✅ Deposit successful! tx:", submitResult.transactionHash)

  // ── Record position + transaction ──────────────────────────────────────
  // dfTokens would come from on-chain return value; use deposit amount as fallback.
  const shares = amount

  if (submitResult.transactionHash) {
    const positionId = await updatePositionOnDeposit(
      userId,
      config.defindexStrategyAddress,
      amount,
      shares,
      true
    ).catch(() => null)

    await saveTransaction(
      userId,
      submitResult.transactionHash,
      "deposit",
      amount,
      config.defindexStrategyAddress,
      { positionId, shares, status: "confirmed" },
      true
    ).catch(() => null)

    if (submitResult.status === "SUCCESS") {
      await updateTransactionStatus(
        submitResult.transactionHash,
        "confirmed",
        null,
        true
      ).catch(() => null)
    }
  }

  const { underlyingUsdc } = await getVaultUserBalance(
    userWalletAddress,
    strategyId,
    config.network
  )

  return {
    success: true,
    shares,
    balance: underlyingUsdc,
    transactionHash: submitResult.transactionHash,
  }
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

/**
 * Withdraw assets from a DeFindex vault.
 *
 * Uses vault-sdk.ts to build the unsigned withdraw XDR, then signs and submits.
 */
export async function withdrawFromStrategy(
  userWalletAddress: string,
  amount: number,
  userId?: string,
  strategyId: StrategyId = "fixed",
  credentialId?: string
): Promise<{ success: boolean; balance: number; transactionHash?: string }> {
  const config = getDeFindexConfig(strategyId)

  if (!validateDeFindexConfig(config)) {
    throw new Error("DeFindex configuration is invalid")
  }

  if (!userId) {
    throw new Error("User ID is required for transaction signing")
  }

  console.log("[DeFindex] Building withdraw XDR via DeFindex SDK...")
  const { xdr: withdrawXdr } = await buildWithdrawXdr(
    userWalletAddress,
    amount,
    strategyId,
    config.network
  )

  const networkPassphrase =
    config.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
  const transaction = TransactionBuilder.fromXDR(withdrawXdr, networkPassphrase)

  let resolvedCredentialId = credentialId
  if (!resolvedCredentialId && typeof window !== "undefined") {
    try {
      const { getCurrentCredentialId } = await import("../storage/key-utils")
      resolvedCredentialId = (await getCurrentCredentialId(userWalletAddress)) || undefined
    } catch {
      // non-critical
    }
  }

  const signedTransaction = await signSorobanTransaction(
    userId,
    transaction as Parameters<typeof signSorobanTransaction>[1],
    resolvedCredentialId
  )

  console.log("[DeFindex] Submitting withdraw transaction...")
  const submitResult = await submitSorobanTransaction(signedTransaction, config.network)

  if (!submitResult.success) {
    throw new Error(`Withdraw failed with status: ${submitResult.status}`)
  }

  console.log("[DeFindex] ✅ Withdraw successful! tx:", submitResult.transactionHash)

  if (submitResult.transactionHash) {
    const positionId = await updatePositionOnWithdraw(
      userId,
      config.defindexStrategyAddress,
      amount,
      true
    ).catch(() => null)

    await saveTransaction(
      userId,
      submitResult.transactionHash,
      "withdraw",
      amount,
      config.defindexStrategyAddress,
      { positionId, status: "confirmed" },
      true
    ).catch(() => null)
  }

  const { underlyingUsdc } = await getVaultUserBalance(
    userWalletAddress,
    strategyId,
    config.network
  )

  return {
    success: true,
    balance: underlyingUsdc,
    transactionHash: submitResult.transactionHash,
  }
}

// ─── Strategy info ────────────────────────────────────────────────────────────

/**
 * Get basic strategy metadata + live APY.
 * Still used by the APY API route and balance display.
 */
export async function getStrategyInfo(
  strategyId: StrategyId = "fixed",
  networkStr?: string | null
): Promise<StrategyInfo> {
  const config = await getResolvedDeFindexConfig(strategyId, networkStr)

  let apy = 15.5
  try {
    const { getRealTimeAPY } = await import("./apy-calculator")
    const apyResult = await getRealTimeAPY(strategyId, networkStr)
    if (apyResult.success && apyResult.data && apyResult.data.yearly > 0) {
      apy = apyResult.data.yearly
    }
  } catch {
    // keep fallback
  }

  return {
    strategyAddress: config.defindexStrategyAddress,
    assetAddress: config.assetAddress,
    apy,
    totalAssets: 0,
    totalShares: 0,
  }
}
