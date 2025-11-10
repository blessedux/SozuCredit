import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/wallet/evm-address
 * Get user's linked EVM address
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("evm_address")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("[EVM Address API] Error fetching profile:", profileError)
      return NextResponse.json(
        { error: "Failed to fetch EVM address" },
        { status: 500 }
      )
    }

    return NextResponse.json({ evmAddress: profile?.evm_address || null })
  } catch (error) {
    console.error("[EVM Address API] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/wallet/evm-address
 * Link or update user's EVM address
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
    const { evmAddress } = body

    if (!evmAddress || typeof evmAddress !== "string") {
      return NextResponse.json(
        { error: "EVM address is required" },
        { status: 400 }
      )
    }

    // Validate EVM address format (0x followed by 40 hex characters)
    const evmAddressRegex = /^0x[a-fA-F0-9]{40}$/
    if (!evmAddressRegex.test(evmAddress)) {
      return NextResponse.json(
        { error: "Invalid EVM address format. Must be a valid Ethereum address (0x followed by 40 hex characters)" },
        { status: 400 }
      )
    }

    // Update profile with EVM address
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ evm_address: evmAddress, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (updateError) {
      console.error("[EVM Address API] Error updating profile:", updateError)
      return NextResponse.json(
        { error: "Failed to update EVM address" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, evmAddress })
  } catch (error) {
    console.error("[EVM Address API] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/wallet/evm-address
 * Unlink user's EVM address
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Remove EVM address from profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ evm_address: null, updated_at: new Date().toISOString() })
      .eq("id", user.id)

    if (updateError) {
      console.error("[EVM Address API] Error removing EVM address:", updateError)
      return NextResponse.json(
        { error: "Failed to remove EVM address" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[EVM Address API] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

