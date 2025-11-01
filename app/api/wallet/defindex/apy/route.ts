/**
 * DeFindex APY API
 * Returns current APY from DeFindex strategy
 */

import { NextResponse } from "next/server"
import { getStrategyInfo } from "@/lib/defindex/vault"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request)
}

export async function GET(request: Request) {
  try {
    // Get strategy info including APY
    const strategyInfo = await getStrategyInfo()
    
    return NextResponse.json(
      {
        success: true,
        apy: strategyInfo.apy,
        strategy: {
          address: strategyInfo.strategyAddress,
          assetAddress: strategyInfo.assetAddress,
          totalAssets: strategyInfo.totalAssets,
          totalShares: strategyInfo.totalShares,
        },
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[DeFindex APY API] Error:", error)
    
    return NextResponse.json(
      {
        error: "Failed to get DeFindex APY",
        details: error instanceof Error ? error.message : String(error),
        // Return fallback APY if query fails
        apy: 15.5,
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}

