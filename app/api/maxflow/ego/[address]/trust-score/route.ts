import { createClient } from "@/lib/supabase/server"
import { maxflowClient } from "@/lib/maxflow/client"
import { NextResponse } from "next/server"

/**
 * GET /api/maxflow/ego/[address]/trust-score
 * Get trust score for an Ethereum address
 * 
 * This endpoint calculates a simplified trust score from the ego score.
 * The trust score is a weighted combination of ego metrics.
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

    if (!address || !address.startsWith("0x")) {
      return NextResponse.json(
        { error: "Invalid address format. Must be a valid Ethereum address (0x...)" },
        { status: 400 }
      )
    }

    const trustScore = await maxflowClient.getTrustScore(address)
    const egoScore = await maxflowClient.getEgoScore(address)

    return NextResponse.json({
      address,
      trustScore,
      egoScore: {
        localHealth: egoScore.localHealth,
        metrics: egoScore.metrics,
      },
    })
  } catch (error) {
    console.error("[MaxFlow Trust Score API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch trust score",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

