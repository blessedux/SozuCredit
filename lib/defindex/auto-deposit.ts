/**
 * Auto-Deposit Service
 *
 * Two modes:
 *   1. "increase-detect" — deposit when wallet USDC increases above min threshold
 *      (original behaviour; used for "auto-earn on inbound funds")
 *   2. "idle-balance"    — deposit (walletBalance − buffer) regardless of whether
 *      previousBalance was recorded (first-time earn / manual "Start earning" trigger)
 *
 * Strategy is passed in; defaults to "fixed".
 */

import {
  getStellarWallet,
  updatePreviousUsdcBalance,
  saveBalanceSnapshot,
} from "@/lib/turnkey/stellar-wallet"
import { getDepositableUsdcBalance } from "@/lib/stellar/soroban-token"
import { depositToStrategy } from "./vault"
import type { StrategyId } from "./strategy-catalog"

export interface AutoDepositConfig {
  minDepositAmount: number
  networkFeeBuffer: number
  maxRetries: number
  retryDelayMs: number
  strategyId: StrategyId
}

const DEFAULT_CONFIG: AutoDepositConfig = {
  minDepositAmount: Number(process.env.VAULT_MIN_DEPOSIT ?? "10"),
  networkFeeBuffer: Number(process.env.VAULT_NETWORK_FEE_BUFFER ?? "0.4"),
  maxRetries: 3,
  retryDelayMs: 5000,
  strategyId: "fixed",
}

// ─── Increase-detect mode (original) ─────────────────────────────────────────

/**
 * Check if balance has increased and trigger auto-deposit if so.
 * Also handles idle-balance mode when previousBalance is null and
 * the caller explicitly passes `depositIdleBalance: true`.
 */
export async function checkAndTriggerAutoDeposit(
  userId: string,
  previousBalance: number | null,
  currentBalance: number,
  config: Partial<AutoDepositConfig> & { depositIdleBalance?: boolean } = {}
): Promise<{ triggered: boolean; depositAmount?: number; transactionHash?: string; error?: string }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  console.log("[Auto-Deposit] Checking balance:", {
    userId,
    previousBalance,
    currentBalance,
    strategyId: finalConfig.strategyId,
    depositIdleBalance: config.depositIdleBalance ?? false,
  })

  const maxDepositable = currentBalance - finalConfig.networkFeeBuffer

  // ── Idle-balance mode: deposit whatever is in wallet right now ───────────
  if (previousBalance === null && config.depositIdleBalance) {
    if (maxDepositable < finalConfig.minDepositAmount) {
      console.log("[Auto-Deposit] Idle balance too low, skipping")
      return { triggered: false }
    }
    console.log("[Auto-Deposit] Idle-balance deposit triggered:", maxDepositable.toFixed(2))
    return runDeposit(userId, maxDepositable, finalConfig)
  }

  // ── No previous balance recorded — store it for next run ─────────────────
  if (previousBalance === null) {
    console.log("[Auto-Deposit] No previous balance, recording for next run")
    return { triggered: false }
  }

  // ── Increase-detect mode ──────────────────────────────────────────────────
  const balanceIncrease = currentBalance - previousBalance
  if (balanceIncrease <= 0) {
    console.log("[Auto-Deposit] Balance did not increase, skipping")
    return { triggered: false }
  }

  if (balanceIncrease < finalConfig.minDepositAmount) {
    console.log("[Auto-Deposit] Increase below minimum, skipping")
    return { triggered: false }
  }

  const depositAmount = Math.max(0, maxDepositable)
  if (depositAmount < finalConfig.minDepositAmount) {
    console.log("[Auto-Deposit] Deposit amount below minimum after buffer, skipping")
    return { triggered: false }
  }

  console.log("[Auto-Deposit] Increase-detect deposit triggered:", depositAmount.toFixed(2))
  return runDeposit(userId, depositAmount, finalConfig)
}

async function runDeposit(
  userId: string,
  amount: number,
  config: AutoDepositConfig
): Promise<{ triggered: boolean; depositAmount?: number; transactionHash?: string; error?: string }> {
  try {
    const result = await depositWithRetry(userId, amount, config)
    if (result.success) {
      console.log("[Auto-Deposit] ✅ Deposit successful")
      return { triggered: true, depositAmount: amount, transactionHash: result.transactionHash }
    }
    return { triggered: true, depositAmount: amount, error: result.error }
  } catch (error) {
    return { triggered: true, depositAmount: amount, error: error instanceof Error ? error.message : String(error) }
  }
}

async function depositWithRetry(
  userId: string,
  amount: number,
  config: AutoDepositConfig
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`[Auto-Deposit] Attempt ${attempt}/${config.maxRetries}...`)
      const wallet = await getStellarWallet(userId, true)
      if (!wallet) throw new Error("Wallet not found")

      const result = await depositToStrategy(
        wallet.publicKey,
        amount,
        userId,
        config.strategyId
      )

      if (result.success && result.transactionHash) {
        return { success: true, transactionHash: result.transactionHash }
      }
      throw new Error("Deposit returned success=false")
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[Auto-Deposit] Attempt ${attempt} failed:`, lastError.message)
      if (attempt < config.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, config.retryDelayMs))
      }
    }
  }

  return { success: false, error: lastError?.message ?? "Deposit failed after all retries" }
}

// ─── Balance monitor (called by API routes / USDC credit hook) ────────────────

/**
 * Monitor wallet balance and trigger auto-deposit when conditions are met.
 *
 * @param depositIdleBalance - When true, deposit even if no previousBalance is
 *   recorded (first-time earn; user manually triggered "Start earning").
 */
export async function monitorBalanceAndAutoDeposit(
  userId: string,
  _previousBalanceStore: Map<string, number> | null = null,
  config: Partial<AutoDepositConfig> & { depositIdleBalance?: boolean } = {}
): Promise<{ triggered: boolean; depositAmount?: number; transactionHash?: string }> {
  try {
    const wallet = await getStellarWallet(userId, true)
    if (!wallet) {
      console.log("[Auto-Deposit] Wallet not found, skipping")
      return { triggered: false }
    }

    const network = (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet") ? "mainnet" : "testnet"
    const currentBalance = await getDepositableUsdcBalance(wallet.publicKey, network)
    const previousBalance: number | null = wallet.previousUsdcBalance ?? null

    const result = await checkAndTriggerAutoDeposit(userId, previousBalance, currentBalance, config)

    // Always update stored balance
    await updatePreviousUsdcBalance(userId, currentBalance, true).catch((err) =>
      console.error("[Auto-Deposit] Error updating previous balance:", err)
    )

    if (result.triggered) {
      await saveBalanceSnapshot(
        userId,
        currentBalance,
        {
          previousBalance,
          autoDepositTriggered: true,
          depositAmount: result.depositAmount,
          transactionHash: result.transactionHash,
          snapshotType: "auto_deposit_trigger",
        },
        true
      ).catch(() => null)
    }

    return {
      triggered: result.triggered,
      depositAmount: result.depositAmount,
      transactionHash: result.transactionHash,
    }
  } catch (error) {
    console.error("[Auto-Deposit] Error in balance monitoring:", error)
    return { triggered: false }
  }
}
