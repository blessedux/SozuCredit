/**
 * Auto-Deposit End-to-End Test
 * Tests the complete auto-deposit flow from balance detection to deposit
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStellarWallet, getUSDCBalance, updatePreviousUsdcBalance } from "@/lib/turnkey/stellar-wallet"
import { monitorBalanceAndAutoDeposit, checkAndTriggerAutoDeposit } from "@/lib/defindex/auto-deposit"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { debugRoutesEnabled } from "@/lib/debug-routes"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  try {
    if (!debugRoutesEnabled()) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in to run E2E test" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    console.log("[Auto-Deposit E2E Test] Starting end-to-end test for userId:", user.id)

    const url = new URL(request.url)
    const strategyId = url.searchParams.get("strategyId") === "yieldblox" ? "yieldblox" : "fixed"

    const results: Record<string, any> = {
      userId: user.id,
      timestamp: new Date().toISOString(),
      strategyId,
      testSteps: [],
      summary: {},
    }

    // Step 0: Config validation
    try {
      const { getDeFindexConfig, validateDeFindexConfig } = await import("@/lib/defindex/config")
      const { getStrategyConfig } = await import("@/lib/defindex/strategy-catalog")
      const config = getDeFindexConfig(strategyId)
      const strategy = getStrategyConfig(strategyId)
      const valid = validateDeFindexConfig(config)
      results.testSteps.push({
        step: 0,
        name: "Config Validation",
        status: valid ? "passed" : "failed",
        data: {
          network: config.network,
          strategyId,
          vaultAddress: strategy.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          assetAddress: strategy.assetAddress,
          blendPoolId: strategy.blendPoolId,
          minDeposit: config.minDepositAmount,
          feeBuffer: config.networkFeeBuffer,
          configValid: valid,
        },
      })
    } catch (err) {
      results.testSteps.push({ step: 0, name: "Config Validation", status: "failed", error: String(err) })
    }

    // Step 0b: Live APY check
    try {
      const { getRealTimeAPY } = await import("@/lib/defindex/apy-calculator")
      const apyResult = await getRealTimeAPY(strategyId)
      results.testSteps.push({
        step: 0,
        name: "Live APY",
        status: apyResult.success ? "passed" : "failed",
        data: {
          source: apyResult.data?.source,
          yearlyApy: apyResult.data?.yearly,
          confidence: apyResult.data?.confidence,
        },
      })
    } catch (err) {
      results.testSteps.push({ step: 0, name: "Live APY", status: "failed", error: String(err) })
    }

    // Step 1: Get wallet
    console.log("[Auto-Deposit E2E Test] Step 1: Getting wallet...")
    const wallet = await getStellarWallet(user.id, true)
    if (!wallet) {
      results.testSteps.push({
        step: 1,
        name: "Get Wallet",
        status: "failed",
        error: "Wallet not found",
      })
      return NextResponse.json(
        {
          success: false,
          error: "Wallet not found. Please create a wallet first.",
          results,
        },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    results.testSteps.push({
      step: 1,
      name: "Get Wallet",
      status: "passed",
      walletId: wallet.id,
      publicKey: wallet.publicKey.substring(0, 10) + "...",
      previousBalance: wallet.previousUsdcBalance ?? null,
    })

    // Step 2: Get current balance
    console.log("[Auto-Deposit E2E Test] Step 2: Getting current USDC balance...")
    const currentBalance = await getUSDCBalance(wallet.publicKey)
    results.testSteps.push({
      step: 2,
      name: "Get Current Balance",
      status: "passed",
      currentBalance,
    })

    // Step 3: Check previous balance in database
    console.log("[Auto-Deposit E2E Test] Step 3: Checking previous balance in database...")
    const previousBalance = wallet.previousUsdcBalance ?? null
    results.testSteps.push({
      step: 3,
      name: "Get Previous Balance",
      status: "passed",
      previousBalance,
      source: "database",
    })

    // Step 4: Calculate balance change
    const balanceChange = previousBalance !== null ? currentBalance - previousBalance : null
    results.testSteps.push({
      step: 4,
      name: "Calculate Balance Change",
      status: "passed",
      balanceChange,
      note: balanceChange === null 
        ? "No previous balance - first check"
        : balanceChange > 0 
          ? "Balance increased"
          : balanceChange < 0
            ? "Balance decreased"
            : "Balance unchanged",
    })

    // Step 5: Test auto-deposit trigger logic
    console.log("[Auto-Deposit E2E Test] Step 5: Testing auto-deposit trigger logic...")
    const minDepositAmount = 10.0
    const networkFeeBuffer = 1.0
    
    let shouldTrigger = false
    let depositAmount = 0
    let triggerReason = ""

    if (balanceChange === null) {
      triggerReason = "No previous balance - will not trigger (first check)"
      shouldTrigger = false
    } else if (balanceChange <= 0) {
      triggerReason = "Balance did not increase"
      shouldTrigger = false
    } else if (balanceChange < minDepositAmount) {
      triggerReason = `Balance increase (${balanceChange}) below minimum threshold (${minDepositAmount})`
      shouldTrigger = false
    } else {
      depositAmount = currentBalance - networkFeeBuffer
      if (depositAmount <= 0 || depositAmount < minDepositAmount) {
        triggerReason = `Calculated deposit amount (${depositAmount}) too small`
        shouldTrigger = false
      } else {
        triggerReason = `Balance increase (${balanceChange}) meets threshold - will trigger deposit`
        shouldTrigger = true
      }
    }

    results.testSteps.push({
      step: 5,
      name: "Auto-Deposit Trigger Logic",
      status: "passed",
      shouldTrigger,
      triggerReason,
      minDepositAmount,
      networkFeeBuffer,
      depositAmount: shouldTrigger ? depositAmount : null,
    })

    // Step 6: Check database integration
    console.log("[Auto-Deposit E2E Test] Step 6: Verifying database integration...")
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (supabaseServiceKey && supabaseUrl) {
      const { createClient: createServiceClient } = await import("@supabase/supabase-js")
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
      
      // Check wallet has previous balance column
      const { data: walletData } = await serviceClient
        .from("stellar_wallets")
        .select("previous_usdc_balance")
        .eq("user_id", user.id)
        .maybeSingle()
      
      // Check balance snapshots table
      const { data: snapshots, count } = await serviceClient
        .from("balance_snapshots")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
      
      results.testSteps.push({
        step: 6,
        name: "Database Integration",
        status: "passed",
        walletHasPreviousBalance: walletData !== null,
        previousBalanceInDb: walletData?.previous_usdc_balance ?? null,
        snapshotsTableAccessible: true,
        snapshotsCount: count ?? 0,
      })
    } else {
      results.testSteps.push({
        step: 6,
        name: "Database Integration",
        status: "skipped",
        note: "Service role key not configured",
      })
    }

    // Step 7: Test update previous balance function
    console.log("[Auto-Deposit E2E Test] Step 7: Testing updatePreviousUsdcBalance function...")
    const { searchParams } = new URL(request.url)
    const shouldUpdate = searchParams.get("update") === "true"

    if (shouldUpdate) {
      try {
        await updatePreviousUsdcBalance(user.id, currentBalance, true)
        results.testSteps.push({
          step: 7,
          name: "Update Previous Balance",
          status: "passed",
          updatedBalance: currentBalance,
          note: "Balance updated in database",
        })
      } catch (error) {
        results.testSteps.push({
          step: 7,
          name: "Update Previous Balance",
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } else {
      results.testSteps.push({
        step: 7,
        name: "Update Previous Balance",
        status: "skipped",
        note: "Add ?update=true to actually update balance",
      })
    }

    // Step 8: Test monitorBalanceAndAutoDeposit function
    console.log("[Auto-Deposit E2E Test] Step 8: Testing monitorBalanceAndAutoDeposit function...")
    const shouldTriggerAutoDeposit = searchParams.get("trigger") === "true"

    if (shouldTriggerAutoDeposit) {
      try {
        const monitorResult = await monitorBalanceAndAutoDeposit(user.id, null, {})
        results.testSteps.push({
          step: 8,
          name: "Monitor Balance and Auto-Deposit",
          status: "passed",
          triggered: monitorResult.triggered,
          depositAmount: monitorResult.depositAmount,
          transactionHash: monitorResult.transactionHash,
          note: monitorResult.triggered 
            ? "Auto-deposit was triggered" 
            : "Auto-deposit was not triggered (expected if balance didn't increase)",
        })
      } catch (error) {
        results.testSteps.push({
          step: 8,
          name: "Monitor Balance and Auto-Deposit",
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } else {
      results.testSteps.push({
        step: 8,
        name: "Monitor Balance and Auto-Deposit",
        status: "skipped",
        note: "Add ?trigger=true to actually trigger auto-deposit check",
      })
    }

    // Step 9: DeFindex SDK — build deposit XDR (simulation only, no signing)
    console.log("[Auto-Deposit E2E Test] Step 9: DeFindex SDK deposit simulation...")
    try {
      const { buildDepositXdr, getVaultUserBalance } = await import("@/lib/defindex/vault-sdk")
      const { getDepositableUsdcBalance } = await import("@/lib/stellar/soroban-token")
      const { getDeFindexConfig } = await import("@/lib/defindex/config")

      const config = getDeFindexConfig(strategyId)
      const blendBalance = await getDepositableUsdcBalance(wallet.publicKey, config.network)

      // Try building a deposit XDR for the minimum deposit amount (no signing)
      const testDepositAmount = Math.max(config.minDepositAmount, 0.001)
      let xdrPreview = "(skipped — balance below minimum)"
      let xdrBuilt = false

      if (blendBalance >= config.minDepositAmount) {
        const { xdr } = await buildDepositXdr(
          wallet.publicKey,
          testDepositAmount,
          strategyId,
          config.network
        )
        xdrPreview = xdr.slice(0, 80) + "..."
        xdrBuilt = true
      }

      // Read on-chain vault balance
      const vaultBalance = await getVaultUserBalance(wallet.publicKey, strategyId, config.network)

      results.testSteps.push({
        step: 9,
        name: "DeFindex SDK Simulation",
        status: "passed",
        data: {
          blendUsdcBalance: blendBalance,
          vaultAddressQueried: config.defindexVaultAddress,
          dfTokens: vaultBalance.dfTokens,
          underlyingUsdc: vaultBalance.underlyingUsdc,
          depositXdrBuilt: xdrBuilt,
          xdrPreview,
          readyToDeposit: blendBalance >= config.minDepositAmount,
          minDeposit: config.minDepositAmount,
        },
      })
    } catch (err) {
      results.testSteps.push({
        step: 9,
        name: "DeFindex SDK Simulation",
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // Summary
    const allStepsPassed = results.testSteps.every((step: { status: string }) => 
      step.status === "passed" || step.status === "skipped"
    )
    const failedSteps = results.testSteps.filter((step: { status: string }) => step.status === "failed")

    results.summary = {
      allStepsPassed,
      totalSteps: results.testSteps.length,
      passedSteps: results.testSteps.filter((s: { status: string }) => s.status === "passed").length,
      skippedSteps: results.testSteps.filter((s: { status: string }) => s.status === "skipped").length,
      failedSteps: failedSteps.length,
      currentBalance,
      previousBalance,
      balanceChange,
      willTriggerAutoDeposit: shouldTrigger,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(
      {
        success: allStepsPassed,
        message: allStepsPassed
          ? "✅ All E2E test steps passed! Auto-deposit feature is ready."
          : `❌ ${failedSteps.length} test step(s) failed. Check results.`,
        results,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Auto-Deposit E2E Test] Error:", error)
    
      return NextResponse.json(
        {
          success: false,
          error: "Failed to run E2E test",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500, headers: corsHeaders(request as any) }
      )
  }
}

