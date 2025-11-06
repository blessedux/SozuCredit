/**
 * Auto-Deposit API
 * Monitors wallet balance and automatically deposits funds into DeFindex strategy
 * This endpoint can be called by a background job or webhook
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { monitorBalanceAndAutoDeposit } from "@/lib/defindex/auto-deposit"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function POST(request: NextRequest) {
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
    
    // Get user's Stellar wallet
    const wallet = await getStellarWallet(user.id, true)
    
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }
    
    // Parse optional config from request body
    const body = await request.json().catch(() => ({}))
    const config = body.config || {}
    
    // Monitor balance and trigger auto-deposit
    // Now uses database for balance tracking (persistent across server restarts)
    const result = await monitorBalanceAndAutoDeposit(
      user.id,
      null, // No longer needed - using database
      config
    )
    
    return NextResponse.json(
      {
        success: true,
        triggered: result.triggered,
        depositAmount: result.depositAmount,
        transactionHash: result.transactionHash,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Auto-Deposit API] Error:", error)
    
    return NextResponse.json(
      {
        error: "Failed to check and trigger auto-deposit",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}

