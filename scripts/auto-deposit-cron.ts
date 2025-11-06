/**
 * Auto-Deposit Cron Job
 * Automatically checks all users and deposits funds to DeFindex strategies
 */

import { createClient } from "@supabase/supabase-js"
import { getUSDCBalance, getStellarWallet, updatePreviousUsdcBalance, saveBalanceSnapshot } from "../lib/turnkey/stellar-wallet"
import { checkAndTriggerAutoDeposit } from "../lib/defindex/auto-deposit"

// Configuration
const CONFIG = {
  minDepositAmount: 10.0, // $10 minimum
  networkFeeBuffer: 1.0,  // Keep $1 for fees
  batchSize: 10,          // Process 10 users at a time
  delayBetweenBatches: 5000, // 5 seconds between batches
}

/**
 * Get all users with Stellar wallets
 */
async function getUsersWithWallets(supabase: any) {
  const { data: wallets, error } = await supabase
    .from("stellar_wallets")
    .select(`
      id,
      user_id,
      public_key,
      previous_usdc_balance
    `)

  if (error) {
    console.error("[Auto-Deposit Cron] Error fetching wallets:", error)
    throw error
  }

  return wallets || []
}

/**
 * Process a single user's auto-deposit
 */
async function processUserAutoDeposit(wallet: any, supabase: any) {
  try {
    console.log(`[Auto-Deposit Cron] Processing user ${wallet.user_id} (${wallet.public_key.substring(0, 8)}...)`)

    // Get current USDC balance
    const currentBalance = await getUSDCBalance(wallet.public_key)
    console.log(`[Auto-Deposit Cron] Current balance: $${currentBalance.toFixed(2)} USDC`)

    // Check and trigger auto-deposit
    const result = await checkAndTriggerAutoDeposit(
      wallet.user_id,
      wallet.previous_usdc_balance,
      currentBalance,
      CONFIG
    )

    if (result.triggered) {
      console.log(`[Auto-Deposit Cron] ✅ Deposited $${result.depositAmount} USDC for user ${wallet.user_id}`)
      console.log(`[Auto-Deposit Cron] Transaction: ${result.transactionHash}`)

      // Update the previous balance after successful deposit
      if (result.depositAmount && result.transactionHash) {
        await updatePreviousUsdcBalance(wallet.user_id, currentBalance - result.depositAmount, true)
        await saveBalanceSnapshot(
          wallet.user_id,
          currentBalance - result.depositAmount,
          {
            previousBalance: wallet.previous_usdc_balance,
            autoDepositTriggered: true,
            depositAmount: result.depositAmount,
            transactionHash: result.transactionHash,
            snapshotType: "auto_deposit_cron",
          },
          true
        )
      }

      return { userId: wallet.user_id, success: true, depositAmount: result.depositAmount, transactionHash: result.transactionHash }
    } else {
      console.log(`[Auto-Deposit Cron] ℹ️ No deposit triggered for user ${wallet.user_id}`)
      return { userId: wallet.user_id, success: true, triggered: false }
    }
  } catch (error) {
    console.error(`[Auto-Deposit Cron] ❌ Error processing user ${wallet.user_id}:`, error)
    return {
      userId: wallet.user_id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Main cron job function
 */
async function runAutoDepositCron() {
  console.log("[Auto-Deposit Cron] 🚀 Starting auto-deposit cron job...")
  console.log(`[Auto-Deposit Cron] 📅 ${new Date().toISOString()}`)

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[Auto-Deposit Cron] Missing Supabase environment variables")
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get all users with wallets
    const wallets = await getUsersWithWallets(supabase)
    console.log(`[Auto-Deposit Cron] 📊 Found ${wallets.length} users with wallets`)

    if (wallets.length === 0) {
      console.log("[Auto-Deposit Cron] ℹ️ No wallets found, exiting...")
      return
    }

    // Process users in batches
    const results = []
    for (let i = 0; i < wallets.length; i += CONFIG.batchSize) {
      const batch = wallets.slice(i, i + CONFIG.batchSize)
      console.log(`[Auto-Deposit Cron] 🔄 Processing batch ${Math.floor(i / CONFIG.batchSize) + 1}/${Math.ceil(wallets.length / CONFIG.batchSize)} (${batch.length} users)`)

      // Process batch concurrently
      const batchPromises = batch.map(wallet => processUserAutoDeposit(wallet, supabase))
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Delay between batches to avoid rate limiting
      if (i + CONFIG.batchSize < wallets.length) {
        console.log(`[Auto-Deposit Cron] ⏳ Waiting ${CONFIG.delayBetweenBatches}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenBatches))
      }
    }

    // Summary
    const successfulDeposits = results.filter(r => r.success && r.depositAmount)
    const totalDeposited = successfulDeposits.reduce((sum, r) => sum + (r.depositAmount || 0), 0)

    console.log("[Auto-Deposit Cron] 📈 Summary:")
    console.log(`[Auto-Deposit Cron]   - Total users processed: ${wallets.length}`)
    console.log(`[Auto-Deposit Cron]   - Successful deposits: ${successfulDeposits.length}`)
    console.log(`[Auto-Deposit Cron]   - Total USDC deposited: $${totalDeposited.toFixed(2)}`)
    console.log(`[Auto-Deposit Cron]   - Errors: ${results.filter(r => !r.success).length}`)

    if (successfulDeposits.length > 0) {
      console.log("[Auto-Deposit Cron] 🎉 Successful deposits:")
      successfulDeposits.forEach(deposit => {
        console.log(`[Auto-Deposit Cron]   - User ${deposit.userId}: $${deposit.depositAmount} USDC (${deposit.transactionHash?.substring(0, 8)}...)`)
      })
    }

    console.log("[Auto-Deposit Cron] ✅ Auto-deposit cron job completed successfully")

  } catch (error) {
    console.error("[Auto-Deposit Cron] 💥 Fatal error:", error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  runAutoDepositCron()
    .then(() => {
      console.log("[Auto-Deposit Cron] 🎯 Cron job finished")
      process.exit(0)
    })
    .catch((error) => {
      console.error("[Auto-Deposit Cron] 💥 Cron job failed:", error)
      process.exit(1)
    })
}

export { runAutoDepositCron }
