/**
 * DeFindex Contract Function Test
 * Tests what functions are available on the DeFindex strategy contract
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getDeFindexConfig } from "@/lib/defindex/config"
import { Contract, TransactionBuilder, Account, BASE_FEE, Networks } from "@stellar/stellar-sdk"
import { getSorobanRpc } from "@/lib/defindex/vault"
import { Api } from "@stellar/stellar-sdk/rpc"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  try {
    // Get user ID from session
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in to test contract functions" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    console.log("[DeFindex Contract Test] Starting contract function test for user:", user.id)

    const config = getDeFindexConfig()

    if (!config.defindexStrategyAddress || config.defindexStrategyAddress.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid strategy address in configuration",
          config: {
            strategyAddress: config.defindexStrategyAddress,
            network: config.network,
            rpcUrl: config.rpcUrl,
          }
        },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    const results: Record<string, any> = {
      userId: user.id,
      strategyAddress: config.defindexStrategyAddress,
      network: config.network,
      timestamp: new Date().toISOString(),
      functionTests: [],
      summary: {},
    }

    const rpc = getSorobanRpc()
    const contract = new Contract(config.defindexStrategyAddress)

    const tempAccount = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0")
    const networkPassphrase = config.network === "testnet" ? Networks.TESTNET : Networks.PUBLIC

    // Test various functions that might exist on the contract
    const functionsToTest = [
      "total_assets",
      "total_shares",
      "get_apy",
      "apy",
      "getApy",
      "current_apy",
      "strategy_apy",
      "balance_of",
      "shares_of",
      "deposit",
      "withdraw",
      "harvest",
      "asset",
      "strategy",
      "vault",
      "decimals",
      "name",
      "symbol",
    ]

    console.log("[DeFindex Contract Test] Testing functions on contract:", config.defindexStrategyAddress)

    for (const functionName of functionsToTest) {
      try {
        console.log(`[DeFindex Contract Test] Testing function: ${functionName}`)

        const tx = new TransactionBuilder(tempAccount, {
          fee: BASE_FEE,
          networkPassphrase,
        })
          .addOperation(contract.call(functionName))
          .setTimeout(30)
          .build()

        const startTime = Date.now()
        const result = await rpc.simulateTransaction(tx)
        const endTime = Date.now()

        if (Api.isSimulationSuccess(result) && result.result) {
          try {
            const returnValue = result.result.retval
            const nativeValue = returnValue ? returnValue.value() : null

            results.functionTests.push({
              function: functionName,
              status: "success",
              responseTime: endTime - startTime,
              returnType: returnValue ? returnValue.switch().name : "unknown",
              rawValue: nativeValue,
              hasResult: true,
            })

            console.log(`[DeFindex Contract Test] ✅ ${functionName}:`, {
              type: returnValue?.switch().name,
              value: nativeValue,
              time: endTime - startTime + "ms"
            })
          } catch (parseError) {
            results.functionTests.push({
              function: functionName,
              status: "success",
              responseTime: endTime - startTime,
              returnType: "parse_error",
              error: parseError instanceof Error ? parseError.message : String(parseError),
              hasResult: true,
            })
          }
        } else {
          const error = Api.isSimulationError(result) ? (result as Api.SimulateTransactionErrorResponse).error : "Unknown error"
          results.functionTests.push({
            function: functionName,
            status: "error",
            responseTime: endTime - startTime,
            error: error,
            hasResult: false,
          })

          console.log(`[DeFindex Contract Test] ❌ ${functionName}:`, error)
        }
      } catch (functionError) {
        results.functionTests.push({
          function: functionName,
          status: "exception",
          error: functionError instanceof Error ? functionError.message : String(functionError),
          hasResult: false,
        })

        console.log(`[DeFindex Contract Test] 💥 ${functionName} exception:`, functionError instanceof Error ? functionError.message : String(functionError))
      }
    }

    // Summary
    const successfulFunctions = results.functionTests.filter((f: any) => f.status === "success")
    const availableFunctions = successfulFunctions.map((f: any) => f.function)

    results.summary = {
      totalFunctions: functionsToTest.length,
      successfulFunctions: successfulFunctions.length,
      failedFunctions: results.functionTests.length - successfulFunctions.length,
      availableFunctions: availableFunctions,
      contractAddress: config.defindexStrategyAddress,
      network: config.network,
      timestamp: new Date().toISOString(),
    }

    // Check if APY function exists
    const apyFunctions = ["get_apy", "apy", "getApy", "current_apy", "strategy_apy"]
    const foundApyFunction = availableFunctions.find((f: string) => apyFunctions.includes(f))

    if (foundApyFunction) {
      results.summary.apyFunction = foundApyFunction
      console.log(`[DeFindex Contract Test] 🎯 Found APY function: ${foundApyFunction}`)
    } else {
      results.summary.apyFunction = null
      console.log("[DeFindex Contract Test] ⚠️ No APY function found")
    }

    return NextResponse.json(
      {
        success: true,
        message: `Contract function test complete. Found ${successfulFunctions.length} available functions.`,
        results,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[DeFindex Contract Test] Error:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to test contract functions",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
