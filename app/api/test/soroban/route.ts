/**
 * Soroban Integration Test API Endpoint
 * Tests Phase 1 Soroban integration
 */

import { NextRequest, NextResponse } from "next/server"
import { runSorobanIntegrationTests } from "@/lib/defindex/soroban-test"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  try {
    console.log("[Soroban Test API] Running Soroban integration tests...")
    
    const results = await runSorobanIntegrationTests()
    
    return NextResponse.json(
      {
        success: results.allPassed,
        results: {
          rpcConnection: results.rpcConnection,
          contractAddressFormat: results.contractAddressFormat,
          contractInstance: results.contractInstance,
        },
        message: results.allPassed
          ? "All Soroban integration tests passed!"
          : "Some tests failed. Check configuration.",
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Soroban Test API] Error:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run tests",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}

