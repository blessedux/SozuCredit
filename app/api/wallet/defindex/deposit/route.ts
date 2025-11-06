/**
 * DeFindex Deposit API
 * Deposits assets into DeFindex strategy
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { depositToStrategy } from "@/lib/defindex/vault"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
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
    
    // Parse request body
    const { amount } = await request.json()
    
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400, headers: corsHeaders(request) }
      )
    }
    
    // Get user's Stellar wallet
    const wallet = await getStellarWallet(user.id, true) // Use service client
    
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }
    
    // Deposit to DeFindex strategy
    const result = await depositToStrategy(wallet.publicKey, amount, user.id)
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Deposit failed" },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    return NextResponse.json(
      {
        success: true,
        shares: result.shares,
        balance: result.balance,
        transactionHash: result.transactionHash,
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[DeFindex Deposit API] Error:", error)
    
    return NextResponse.json(
      {
        error: "Failed to deposit to DeFindex",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}

