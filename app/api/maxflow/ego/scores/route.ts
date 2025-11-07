import { createClient } from "@/lib/supabase/server"
import { maxflowClient } from "@/lib/maxflow/client"
import { NextResponse } from "next/server"

/**
 * POST /api/maxflow/ego/scores
 * Get ego scores for multiple addresses
 * 
 * This endpoint fetches ego scores for multiple addresses in parallel.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { addresses } = body

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "addresses array is required" },
        { status: 400 }
      )
    }

    if (addresses.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 addresses allowed per request" },
        { status: 400 }
      )
    }

    // Validate all addresses
    const invalidAddresses = addresses.filter(
      (addr: string) => !addr || !addr.startsWith("0x")
    )

    if (invalidAddresses.length > 0) {
      return NextResponse.json(
        { error: "Invalid address format. All addresses must be valid Ethereum addresses (0x...)", invalidAddresses },
        { status: 400 }
      )
    }

    const scores = await maxflowClient.getEgoScores(addresses)

    // Convert Map to object for JSON response
    const scoresObject: Record<string, any> = {}
    scores.forEach((score, address) => {
      scoresObject[address] = score
    })

    return NextResponse.json({ scores: scoresObject })
  } catch (error) {
    console.error("[MaxFlow Ego Scores API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch ego scores",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

