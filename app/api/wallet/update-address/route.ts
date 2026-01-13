/**
 * Update Stellar Wallet Address
 * 
 * This endpoint allows updating a user's wallet address in the database.
 * Used for fixing wallet address mismatches or updating to the correct wallet.
 * 
 * IMPORTANT: This only updates the public key in the database.
 * Private keys are always stored client-side in the browser and never touched by this endpoint.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean)

  if (origin && allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-user-id",
      "Access-Control-Allow-Credentials": "true",
    }
  }

  return {}
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  try {
    const { username, newPublicKey, network } = await request.json()
    // x-user-id is optional - we look up by username anyway

    if (!username || !newPublicKey) {
      return NextResponse.json(
        { error: "Username and new public key are required" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Validate public key format
    if (!/^G[A-Z0-9]{55}$/.test(newPublicKey)) {
      return NextResponse.json(
        { error: "Invalid Stellar public key format" },
        { status: 400, headers: corsHeaders(request) }
      )
    }

    // Use service client to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Find profile by username
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, username")
      .eq("username", username.trim())
      .maybeSingle()

    if (profileError) {
      console.error("[Update Address] Error finding profile:", profileError)
      return NextResponse.json(
        { error: "Failed to find user profile" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: corsHeaders(request) }
      )
    }

    console.log("[Update Address] Updating wallet for user:", {
      username: profile.username,
      userId: profile.id,
      newPublicKey: newPublicKey.substring(0, 10) + "..." + newPublicKey.substring(newPublicKey.length - 10),
      network: network || "testnet"
    })

    // Get existing wallet to log what we're replacing
    const { data: existingWallet } = await serviceClient
      .from("stellar_wallets")
      .select("public_key, network, updated_at")
      .eq("user_id", profile.id)
      .maybeSingle()

    if (existingWallet) {
      console.log("[Update Address] Existing wallet:", {
        publicKey: existingWallet.public_key.substring(0, 10) + "..." + existingWallet.public_key.substring(existingWallet.public_key.length - 10),
        network: existingWallet.network,
        updatedAt: existingWallet.updated_at
      })
    }

    // Update or insert wallet
    // Use public key as turnkey_wallet_id for backward compatibility (we're not using Turnkey anymore)
    // This matches the pattern used in storeStellarWallet()
    const { data: updatedWallet, error: updateError } = await serviceClient
      .from("stellar_wallets")
      .upsert(
        {
          user_id: profile.id,
          public_key: newPublicKey,
          turnkey_wallet_id: newPublicKey, // Use public key as turnkey_wallet_id for backward compatibility
          network: network || "testnet",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single()

    if (updateError) {
      console.error("[Update Address] Error updating wallet:", updateError)
      return NextResponse.json(
        { error: "Failed to update wallet address", details: updateError.message },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    console.log("[Update Address] ✅ Wallet updated successfully:", {
      publicKey: updatedWallet.public_key.substring(0, 10) + "..." + updatedWallet.public_key.substring(updatedWallet.public_key.length - 10),
      network: updatedWallet.network,
      updatedAt: updatedWallet.updated_at
    })

    return NextResponse.json(
      {
        success: true,
        message: "Wallet address updated successfully",
        wallet: {
          publicKey: updatedWallet.public_key,
          network: updatedWallet.network,
          updatedAt: updatedWallet.updated_at,
        },
      },
      { headers: corsHeaders(request) }
    )
  } catch (error: any) {
    console.error("[Update Address] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update wallet address" },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
