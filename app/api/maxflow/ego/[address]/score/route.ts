import { createClient } from "@/lib/supabase/server"
import { maxflowClient } from "@/lib/maxflow/client"
import { NextResponse } from "next/server"

/**
 * GET /api/maxflow/ego/[address]/score
 * Get ego score for an Ethereum address
 * 
 * This endpoint fetches the MaxFlow ego score for a given address.
 * The ego score is based on network flow analysis of address relationships.
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

    const egoScore = await maxflowClient.getEgoScore(address)

    return NextResponse.json({ egoScore })
  } catch (error) {
    console.error("[MaxFlow Ego Score API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch ego score",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

