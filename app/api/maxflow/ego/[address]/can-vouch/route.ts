import { createClient } from "@/lib/supabase/server"
import { maxflowClient } from "@/lib/maxflow/client"
import { NextResponse } from "next/server"

/**
 * GET /api/maxflow/ego/[address]/can-vouch
 * Check if an address has sufficient trust to vouch for others
 * 
 * This endpoint checks if an address meets the minimum trust score
 * required for vouching based on MaxFlow ego score.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { address } = await params
    const { searchParams } = new URL(request.url)
    const minTrustScore = parseFloat(searchParams.get("minTrustScore") || "1.0")

    if (!address || !address.startsWith("0x")) {
      return NextResponse.json(
        { error: "Invalid address format. Must be a valid Ethereum address (0x...)" },
        { status: 400 }
      )
    }

    const result = await maxflowClient.canVouch(address, minTrustScore)

    return NextResponse.json({
      address,
      canVouch: result.canVouch,
      trustScore: result.trustScore,
      minTrustScore,
      egoScore: {
        localHealth: result.egoScore.localHealth,
        metrics: result.egoScore.metrics,
      },
    })
  } catch (error) {
    console.error("[MaxFlow Can Vouch API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to check vouching eligibility",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

