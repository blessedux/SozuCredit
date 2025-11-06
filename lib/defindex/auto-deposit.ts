/**
 * Auto-Deposit Service
 * Monitors wallet balance and automatically deposits funds into DeFindex strategy
 */

import { getUSDCBalance, getStellarWallet, updatePreviousUsdcBalance, saveBalanceSnapshot } from "@/lib/turnkey/stellar-wallet"
import { depositToStrategy } from "./vault"

export interface AutoDepositConfig {
  minDepositAmount: number // Minimum amount to trigger auto-deposit (in USDC)
  networkFeeBuffer: number // Buffer to keep in wallet for network fees (in USDC)
  maxRetries: number // Maximum number of retry attempts
  retryDelayMs: number // Delay between retries (in milliseconds)
}

const DEFAULT_CONFIG: AutoDepositConfig = {
  minDepositAmount: 10.0, // Minimum $10 USDC to trigger auto-deposit
  networkFeeBuffer: 1.0, // Keep $1 USDC for network fees
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds between retries
}

/**
 * Check if balance has increased and trigger auto-deposit if needed
 */
export async function checkAndTriggerAutoDeposit(
  userId: string,
  previousBalance: number | null,
  currentBalance: number,
  config: Partial<AutoDepositConfig> = {}
): Promise<{ triggered: boolean; depositAmount?: number; transactionHash?: string; error?: string }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  console.log("[Auto-Deposit] Checking balance for auto-deposit:", {
    userId,
    previousBalance,
    currentBalance,
    minDepositAmount: finalConfig.minDepositAmount,
  })
  
  // If no previous balance, store current balance and don't deposit yet
  if (previousBalance === null) {
    console.log("[Auto-Deposit] No previous balance recorded, storing current balance")
    return { triggered: false }
  }
  
  // Calculate balance increase
  const balanceIncrease = currentBalance - previousBalance
  
  // Check if balance increased
  if (balanceIncrease <= 0) {
    console.log("[Auto-Deposit] Balance did not increase, no deposit needed")
    return { triggered: false }
  }
  
  console.log("[Auto-Deposit] Balance increased by:", balanceIncrease)
  
  // Check if increase meets minimum deposit amount
  if (balanceIncrease < finalConfig.minDepositAmount) {
    console.log("[Auto-Deposit] Balance increase below minimum deposit amount, skipping")
    return { triggered: false }
  }
  
  // Calculate deposit amount (current balance minus network fee buffer)
  const depositAmount = currentBalance - finalConfig.networkFeeBuffer
  
  // Ensure deposit amount is positive and meets minimum
  if (depositAmount <= 0 || depositAmount < finalConfig.minDepositAmount) {
    console.log("[Auto-Deposit] Calculated deposit amount too small:", depositAmount)
    return { triggered: false }
  }
  
  console.log("[Auto-Deposit] ✅ Triggering auto-deposit:", {
    depositAmount,
    networkFeeBuffer: finalConfig.networkFeeBuffer,
  })
  
  // Trigger deposit with retry logic
  try {
    const result = await depositWithRetry(userId, depositAmount, finalConfig)
    
    if (result.success) {
      console.log("[Auto-Deposit] ✅ Auto-deposit successful!")
      return {
        triggered: true,
        depositAmount,
        transactionHash: result.transactionHash,
      }
    } else {
      console.error("[Auto-Deposit] ❌ Auto-deposit failed after retries")
      return {
        triggered: true,
        depositAmount,
        error: result.error || "Deposit failed after retries",
      }
    }
  } catch (error) {
    console.error("[Auto-Deposit] ❌ Auto-deposit error:", error)
    return {
      triggered: true,
      depositAmount,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Deposit with retry logic
 */
async function depositWithRetry(
  userId: string,
  amount: number,
  config: AutoDepositConfig
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`[Auto-Deposit] Deposit attempt ${attempt}/${config.maxRetries}...`)
      
      // Get user's wallet
      const wallet = await getStellarWallet(userId, true)
      if (!wallet) {
        throw new Error("Wallet not found")
      }
      
      // Attempt deposit
      const result = await depositToStrategy(wallet.publicKey, amount, userId)
      
      if (result.success && result.transactionHash) {
        console.log(`[Auto-Deposit] ✅ Deposit successful on attempt ${attempt}`)
        
        // Transaction is already saved by depositToStrategy, but we can verify it
        // The position and transaction records are handled by depositToStrategy()
        
        return {
          success: true,
          transactionHash: result.transactionHash,
        }
      } else {
        throw new Error("Deposit returned success=false")
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`[Auto-Deposit] ❌ Deposit attempt ${attempt} failed:`, lastError.message)
      
      // If not the last attempt, wait before retrying
      if (attempt < config.maxRetries) {
        console.log(`[Auto-Deposit] Waiting ${config.retryDelayMs}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, config.retryDelayMs))
      }
    }
  }
  
  return {
    success: false,
    error: lastError?.message || "Deposit failed after all retries",
  }
}

/**
 * Monitor wallet balance and trigger auto-deposit when funds are received
 * This should be called periodically (e.g., every 30 seconds) or via webhook
 * Now uses database instead of in-memory store for persistence
 */
export async function monitorBalanceAndAutoDeposit(
  userId: string,
  previousBalanceStore: Map<string, number> | null = null, // Deprecated: kept for backward compatibility
  config: Partial<AutoDepositConfig> = {}
): Promise<{ triggered: boolean; depositAmount?: number; transactionHash?: string }> {
  try {
    // Get user's wallet
    const wallet = await getStellarWallet(userId, true)
    if (!wallet) {
      console.log("[Auto-Deposit] Wallet not found, skipping")
      return { triggered: false }
    }
    
    // Get current USDC balance
    const currentBalance = await getUSDCBalance(wallet.publicKey)
    
    // Get previous balance from database (or fallback to in-memory store for backward compatibility)
    let previousBalance: number | null = wallet.previousUsdcBalance ?? null
    
    // Fallback to in-memory store if database doesn't have it (for backward compatibility)
    if (previousBalance === null && previousBalanceStore) {
      previousBalance = previousBalanceStore.get(userId) || null
      console.log("[Auto-Deposit] Using in-memory store for previous balance (fallback)")
    }
    
    // Check and trigger auto-deposit
    const result = await checkAndTriggerAutoDeposit(
      userId,
      previousBalance,
      currentBalance,
      config
    )
    
    // Update balance in database (always update, even if no deposit triggered)
    try {
      await updatePreviousUsdcBalance(userId, currentBalance, true)
    } catch (error) {
      console.error("[Auto-Deposit] Error updating previous balance in database:", error)
      // Fallback to in-memory store if database update fails
      if (previousBalanceStore) {
        previousBalanceStore.set(userId, currentBalance)
      }
    }
    
    // Save balance snapshot if auto-deposit was triggered
    if (result.triggered) {
      try {
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
        )
      } catch (error) {
        console.error("[Auto-Deposit] Error saving balance snapshot:", error)
        // Don't fail if snapshot save fails
      }
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

