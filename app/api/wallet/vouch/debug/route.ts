import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * POST /api/wallet/vouch/debug
 * Debug endpoint to test vouch insert directly
 * This helps us identify the exact issue with the insert
 */
export async function POST(request: Request) {
  try {
    const { voucher_id, vouched_user_id, trust_points_transferred } = await request.json()
    
    if (!voucher_id || !vouched_user_id || !trust_points_transferred) {
      return NextResponse.json({ 
        error: "Missing required fields: voucher_id, vouched_user_id, trust_points_transferred" 
      }, { status: 400 })
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ 
        error: "Service not available - missing environment variables" 
      }, { status: 500 })
    }
    
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    console.log("[Vouch Debug] Attempting direct insert...")
    console.log("[Vouch Debug] Voucher ID:", voucher_id)
    console.log("[Vouch Debug] Vouched User ID:", vouched_user_id)
    console.log("[Vouch Debug] Trust Points:", trust_points_transferred)
    
    // Try insert
    const { data: vouchRecord, error: vouchError } = await serviceClient
      .from("user_vouches")
      .insert({
        voucher_id,
        vouched_user_id,
        trust_points_transferred,
        message: null
      })
      .select()
      .single()
    
    if (vouchError) {
      console.error("[Vouch Debug] ❌ Insert failed:", vouchError)
      return NextResponse.json({
        success: false,
        error: vouchError.message,
        errorCode: vouchError.code,
        errorDetails: vouchError.details,
        errorHint: vouchError.hint,
        fullError: vouchError
      }, { status: 500 })
    }
    
    console.log("[Vouch Debug] ✅ Insert succeeded:", vouchRecord?.id)
    
    return NextResponse.json({
      success: true,
      message: "Vouch record created successfully",
      vouch: vouchRecord
    })
  } catch (error) {
    console.error("[Vouch Debug] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

