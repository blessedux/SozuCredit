import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * POST /api/wallet/vouches/review
 * Review a vouch and mark it as trustworthy or not
 * 
 * Request body:
 * {
 *   vouchId: string,
 *   isTrustworthy: boolean,
 *   reviewNotes?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const { vouchId, isTrustworthy, reviewNotes } = await request.json()
    
    if (!vouchId || typeof isTrustworthy !== "boolean") {
      return NextResponse.json({ 
        error: "vouchId and isTrustworthy (boolean) are required" 
      }, { status: 400 })
    }
    
    const supabase = await createClient()
    
    // Get the authenticated user (reviewer)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // TODO: Add reviewer role check here
    // For now, we'll allow any authenticated user to review vouches
    // In production, you should check if user has reviewer role
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Service not available" }, { status: 500 })
    }
    
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    // Check if vouch exists
    const { data: vouch, error: vouchError } = await serviceClient
      .from("user_vouches")
      .select("id, voucher_id, vouched_user_id, is_trustworthy")
      .eq("id", vouchId)
      .single()
    
    if (vouchError || !vouch) {
      return NextResponse.json({ 
        error: "Vouch not found",
        details: vouchError?.message 
      }, { status: 404 })
    }
    
    // Update the vouch with review information
    const { data: updatedVouch, error: updateError } = await serviceClient
      .from("user_vouches")
      .update({
        is_trustworthy: isTrustworthy,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null
      })
      .eq("id", vouchId)
      .select()
      .single()
    
    if (updateError) {
      console.error("[Review Vouch API] Error updating vouch:", updateError)
      return NextResponse.json({ 
        error: "Failed to update vouch",
        details: updateError.message 
      }, { status: 500 })
    }
    
    // Check if the vouched user now becomes eligible for credit
    let vouchedUserEligible = false
    let trustworthyCount = 0
    
    if (isTrustworthy) {
      // Only check eligibility if we marked it as trustworthy
      const { data: eligibleCheck, error: eligibleError } = await serviceClient
        .rpc("can_apply_for_credit", { user_uuid: vouch.vouched_user_id })
      
      vouchedUserEligible = !eligibleError && eligibleCheck === true
      
      if (vouchedUserEligible) {
        // Create notification for the user if they become eligible
        const { data: countData, error: countError } = await serviceClient
          .rpc("get_trustworthy_vouches_count", { user_uuid: vouch.vouched_user_id })
        
        trustworthyCount = countData || 0
        
        await serviceClient
          .from("notifications")
          .insert({
            user_id: vouch.vouched_user_id,
            type: "credit_eligible",
            title: "¡Eres elegible para crédito!",
            message: `Ahora tienes ${trustworthyCount} puntos de confianza confiables. Puedes solicitar un crédito.`,
            metadata: {
              trustworthy_vouches_count: trustworthyCount
            }
          })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: "Vouch reviewed successfully",
      vouch: updatedVouch,
      vouchedUserEligible: vouchedUserEligible,
      trustworthyVouchesCount: trustworthyCount
    })
  } catch (error) {
    console.error("[Review Vouch API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

