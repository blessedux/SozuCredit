/**
 * DeFindex APY API
 * Returns comprehensive APY data with multiple time periods and precision
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRealTimeAPY, formatAPY, getAPYWithPrecision } from "@/lib/defindex/apy-calculator"
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
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    console.log("[DeFindex APY API] Fetching comprehensive APY data for user:", user.id)

    // Get URL parameters for customization
    const url = new URL(request.url)
    const period = url.searchParams.get('period') as 'daily' | 'weekly' | 'monthly' | 'yearly' || 'yearly'
    const decimals = parseInt(url.searchParams.get('decimals') || '4')
    const precision = Math.min(Math.max(decimals, 1), 8) // Limit precision to 1-8 decimals

    // Get comprehensive APY data
    const apyResult = await getRealTimeAPY()

    if (!apyResult.success || !apyResult.data) {
      console.error("[DeFindex APY API] APY calculation failed:", apyResult.error)

      // Return fallback with comprehensive data
      const fallbackAPY = 15.5
      const periods = {
        daily: (fallbackAPY / 365).toFixed(precision),
        weekly: ((Math.pow(1 + fallbackAPY/100/365, 7) - 1) * 100).toFixed(precision),
        monthly: ((Math.pow(1 + fallbackAPY/100/365, 30) - 1) * 100).toFixed(precision),
        yearly: fallbackAPY.toFixed(precision),
      }

      return NextResponse.json(
        {
          success: false,
          error: apyResult.error || "APY calculation failed",
          fallback: true,
          apy: {
            primary: periods.yearly,
            periods,
            source: 'fallback',
            confidence: 'low',
            precision,
          },
          strategy: {
            address: apyResult.strategyAddress,
          },
          lastUpdated: new Date().toISOString(),
        },
        { status: 200, headers: corsHeaders(request) }
      )
    }

    // Format response based on requested period and precision
    const formattedAPY = formatAPY(apyResult.data, period, precision)
    const preciseAPY = getAPYWithPrecision(apyResult.data, period, precision)

    // Create comprehensive periods data
    const allPeriods = {
      daily: formatAPY(apyResult.data, 'daily', precision),
      weekly: formatAPY(apyResult.data, 'weekly', precision),
      monthly: formatAPY(apyResult.data, 'monthly', precision),
      yearly: formatAPY(apyResult.data, 'yearly', precision),
    }

    console.log("[DeFindex APY API] APY calculation successful:", {
      requestedPeriod: period,
      primaryAPY: preciseAPY,
      source: apyResult.data.source,
      confidence: apyResult.data.confidence,
    })

    return NextResponse.json(
      {
        success: true,
        apy: {
          primary: formattedAPY,
          precise: preciseAPY,
          periods: allPeriods,
          source: apyResult.data.source,
          confidence: apyResult.data.confidence,
          precision,
          requestedPeriod: period,
        },
        strategy: {
          address: apyResult.strategyAddress,
        },
        metadata: {
          lastUpdated: apyResult.data.lastUpdated,
          calculationTime: new Date().toISOString(),
        },
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[DeFindex APY API] Unexpected error:", error)

    // Return comprehensive fallback on unexpected errors
    const fallbackAPY = 15.5
    const periods = {
      daily: (fallbackAPY / 365).toFixed(4),
      weekly: ((Math.pow(1 + fallbackAPY/100/365, 7) - 1) * 100).toFixed(4),
      monthly: ((Math.pow(1 + fallbackAPY/100/365, 30) - 1) * 100).toFixed(4),
      yearly: fallbackAPY.toFixed(4),
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fallback: true,
        apy: {
          primary: periods.yearly,
          periods,
          source: 'fallback',
          confidence: 'low',
          precision: 4,
        },
        strategy: {
          address: "unknown",
        },
        lastUpdated: new Date().toISOString(),
      },
      { status: 200, headers: corsHeaders(request) } // Return 200 even on error to show fallback APY
    )
  }
}

