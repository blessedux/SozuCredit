import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * GET /api/wallet/vouches/pending-review
 * Get all vouches pending review (where is_trustworthy is null)
 * 
 * This endpoint is for reviewers to see vouches that need manual review
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // TODO: Add reviewer role check here
    // For now, we'll allow any authenticated user to view pending vouches
    // In production, you should check if user has reviewer role
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Service not available" }, { status: 500 })
    }
    
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    // Get vouches pending review:
    // - is_trustworthy is null (not yet checked)
    // - is_trustworthy is false (auto-check failed, needs manual review)
    // - is_trustworthy is true but reviewed_by is null (auto-check passed but not manually reviewed)
    const { data: pendingVouches, error: vouchesError } = await serviceClient
      .from("user_vouches")
      .select(`
        id,
        voucher_id,
        vouched_user_id,
        trust_points_transferred,
        message,
        created_at,
        is_trustworthy,
        reviewed_by,
        reviewed_at,
        review_notes,
        voucher:profiles!user_vouches_voucher_id_fkey(
          id,
          username,
          display_name,
          email,
          created_at
        ),
        vouched_user:profiles!user_vouches_vouched_user_id_fkey(
          id,
          username,
          display_name,
          email
        )
      `)
      .or("is_trustworthy.is.null,is_trustworthy.eq.false,reviewed_by.is.null")
      .order("created_at", { ascending: false })
    
    if (vouchesError) {
      console.error("[Pending Review API] Error fetching pending vouches:", vouchesError)
      return NextResponse.json({ 
        error: "Failed to fetch pending vouches",
        details: vouchesError.message 
      }, { status: 500 })
    }
    
    // For each vouch, check if the voucher is trustworthy using the function
    const vouchesWithTrustworthiness = await Promise.all(
      (pendingVouches || []).map(async (vouch) => {
        const { data: isTrustworthy, error: checkError } = await serviceClient
          .rpc("is_user_trustworthy", { user_uuid: vouch.voucher_id })
        
        return {
          ...vouch,
          auto_trustworthy_check: isTrustworthy || false,
          check_error: checkError ? checkError.message : null
        }
      })
    )
    
    return NextResponse.json({
      vouches: vouchesWithTrustworthiness,
      count: vouchesWithTrustworthiness.length
    })
  } catch (error) {
    console.error("[Pending Review API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

