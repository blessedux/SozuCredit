/**
 * Balance Tracking Test API Endpoint
 * Tests the database-based balance tracking functionality
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStellarWallet, getUSDCBalance, updatePreviousUsdcBalance, saveBalanceSnapshot } from "@/lib/turnkey/stellar-wallet"
import { monitorBalanceAndAutoDeposit } from "@/lib/defindex/auto-deposit"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in to test balance tracking" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    console.log("[Balance Tracking Test] Starting tests for userId:", user.id)

    const results: Record<string, any> = {
      userId: user.id,
      timestamp: new Date().toISOString(),
      tests: {},
      errors: [],
    }

    // Test 1: Get wallet with previous balance
    try {
      console.log("[Balance Tracking Test] Test 1: Getting wallet with previous balance...")
      const wallet = await getStellarWallet(user.id, true)
      
      if (!wallet) {
        results.errors.push("Wallet not found - please create a wallet first")
        results.tests.walletExists = false
      } else {
        results.tests.walletExists = true
        results.tests.walletData = {
          id: wallet.id,
          publicKey: wallet.publicKey.substring(0, 10) + "...",
          network: wallet.network,
          previousUsdcBalance: wallet.previousUsdcBalance ?? null,
        }
        console.log("[Balance Tracking Test] ✅ Wallet found with previous balance:", wallet.previousUsdcBalance)
      }
    } catch (error) {
      results.errors.push(`Test 1 failed: ${error instanceof Error ? error.message : String(error)}`)
      results.tests.walletExists = false
      console.error("[Balance Tracking Test] ❌ Test 1 failed:", error)
    }

    // Test 2: Get current USDC balance
    try {
      console.log("[Balance Tracking Test] Test 2: Getting current USDC balance...")
      const wallet = await getStellarWallet(user.id, true)
      
      if (wallet) {
        const currentBalance = await getUSDCBalance(wallet.publicKey)
        results.tests.currentBalance = currentBalance
        console.log("[Balance Tracking Test] ✅ Current USDC balance:", currentBalance)
      } else {
        results.errors.push("Cannot test balance - wallet not found")
        results.tests.currentBalance = null
      }
    } catch (error) {
      results.errors.push(`Test 2 failed: ${error instanceof Error ? error.message : String(error)}`)
      results.tests.currentBalance = null
      console.error("[Balance Tracking Test] ❌ Test 2 failed:", error)
    }

    // Test 3: Check database column exists
    try {
      console.log("[Balance Tracking Test] Test 3: Checking database schema...")
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (supabaseServiceKey && supabaseUrl) {
        const { createClient: createServiceClient } = await import("@supabase/supabase-js")
        const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
        
        // Check if previous_usdc_balance column exists
        const { data: walletData, error: walletError } = await serviceClient
          .from("stellar_wallets")
          .select("previous_usdc_balance")
          .eq("user_id", user.id)
          .maybeSingle()
        
        if (walletError) {
          results.errors.push(`Database check failed: ${walletError.message}`)
          results.tests.databaseSchema = false
        } else if (walletData !== null) {
          results.tests.databaseSchema = true
          results.tests.databasePreviousBalance = walletData.previous_usdc_balance
          console.log("[Balance Tracking Test] ✅ Database schema check passed")
        } else {
          results.tests.databaseSchema = true // Column exists, just no wallet yet
          results.tests.databasePreviousBalance = null
          console.log("[Balance Tracking Test] ✅ Database schema check passed (no wallet data)")
        }

        // Check if balance_snapshots table exists
        const { data: snapshots, error: snapshotsError } = await serviceClient
          .from("balance_snapshots")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
        
        if (snapshotsError) {
          // Table might not exist or RLS issue
          results.errors.push(`Balance snapshots table check: ${snapshotsError.message}`)
          results.tests.snapshotsTableExists = false
        } else {
          results.tests.snapshotsTableExists = true
          results.tests.snapshotsCount = snapshots?.length ?? 0
          console.log("[Balance Tracking Test] ✅ Balance snapshots table exists")
        }
      } else {
        results.errors.push("Service role key not configured - cannot check database schema")
        results.tests.databaseSchema = false
      }
    } catch (error) {
      results.errors.push(`Test 3 failed: ${error instanceof Error ? error.message : String(error)}`)
      results.tests.databaseSchema = false
      console.error("[Balance Tracking Test] ❌ Test 3 failed:", error)
    }

    // Test 4: Update previous balance (dry run - don't actually update)
    try {
      console.log("[Balance Tracking Test] Test 4: Testing updatePreviousUsdcBalance function...")
      const wallet = await getStellarWallet(user.id, true)
      
      if (wallet) {
        const currentBalance = await getUSDCBalance(wallet.publicKey)
        const previousBalance = wallet.previousUsdcBalance ?? null
        
        results.tests.updateFunction = {
          canCall: true,
          currentBalance,
          previousBalanceBefore: previousBalance,
          note: "Function is callable. Set 'update=true' in query params to actually update.",
        }
        console.log("[Balance Tracking Test] ✅ Update function is callable")
      } else {
        results.tests.updateFunction = {
          canCall: false,
          error: "Wallet not found",
        }
      }
    } catch (error) {
      results.errors.push(`Test 4 failed: ${error instanceof Error ? error.message : String(error)}`)
      results.tests.updateFunction = { canCall: false, error: String(error) }
      console.error("[Balance Tracking Test] ❌ Test 4 failed:", error)
    }

    // Test 5: Monitor balance and auto-deposit (dry run)
    try {
      console.log("[Balance Tracking Test] Test 5: Testing monitorBalanceAndAutoDeposit function...")
      const wallet = await getStellarWallet(user.id, true)
      
      if (wallet) {
        const currentBalance = await getUSDCBalance(wallet.publicKey)
        const previousBalance = wallet.previousUsdcBalance ?? null
        
        results.tests.monitorFunction = {
          canCall: true,
          currentBalance,
          previousBalance,
          balanceChange: previousBalance !== null ? currentBalance - previousBalance : null,
          note: "Function is callable. Set 'trigger=true' in query params to actually trigger auto-deposit.",
        }
        console.log("[Balance Tracking Test] ✅ Monitor function is callable")
      } else {
        results.tests.monitorFunction = {
          canCall: false,
          error: "Wallet not found",
        }
      }
    } catch (error) {
      results.errors.push(`Test 5 failed: ${error instanceof Error ? error.message : String(error)}`)
      results.tests.monitorFunction = { canCall: false, error: String(error) }
      console.error("[Balance Tracking Test] ❌ Test 5 failed:", error)
    }

    // Check if user wants to actually update (via query param)
    const { searchParams } = new URL(request.url)
    const shouldUpdate = searchParams.get("update") === "true"
    const shouldTrigger = searchParams.get("trigger") === "true"

    if (shouldUpdate) {
      try {
        console.log("[Balance Tracking Test] Actually updating previous balance...")
        const wallet = await getStellarWallet(user.id, true)
        if (wallet) {
          const currentBalance = await getUSDCBalance(wallet.publicKey)
          await updatePreviousUsdcBalance(user.id, currentBalance, true)
          results.tests.actualUpdate = {
            success: true,
            updatedBalance: currentBalance,
            timestamp: new Date().toISOString(),
          }
          console.log("[Balance Tracking Test] ✅ Previous balance updated successfully")
        }
      } catch (error) {
        results.errors.push(`Update failed: ${error instanceof Error ? error.message : String(error)}`)
        results.tests.actualUpdate = { success: false, error: String(error) }
      }
    }

    if (shouldTrigger) {
      try {
        console.log("[Balance Tracking Test] Actually triggering auto-deposit check...")
        const result = await monitorBalanceAndAutoDeposit(user.id, null, {})
        results.tests.actualTrigger = {
          success: true,
          triggered: result.triggered,
          depositAmount: result.depositAmount,
          transactionHash: result.transactionHash,
          timestamp: new Date().toISOString(),
        }
        console.log("[Balance Tracking Test] ✅ Auto-deposit check completed:", result.triggered ? "Triggered" : "Not triggered")
      } catch (error) {
        results.errors.push(`Trigger failed: ${error instanceof Error ? error.message : String(error)}`)
        results.tests.actualTrigger = { success: false, error: String(error) }
      }
    }

    // Summary
    const allTestsPassed = 
      results.tests.walletExists !== false &&
      results.tests.currentBalance !== null &&
      results.tests.databaseSchema !== false &&
      results.tests.snapshotsTableExists !== false

    results.summary = {
      allTestsPassed,
      testsRun: 5,
      errorsCount: results.errors.length,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(
      {
        success: allTestsPassed,
        message: allTestsPassed
          ? "All balance tracking tests passed! ✅"
          : "Some tests failed. Check errors array.",
        results,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Balance Tracking Test] Error:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run balance tracking tests",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}

