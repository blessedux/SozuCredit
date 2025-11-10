import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * GET /api/wallet/credit-eligibility
 * Check if user is eligible to apply for business credit/loan
 * 
 * Requirements:
 * - User must have 5+ TRUST points received from trustworthy users (not from referrals)
 * - Trustworthy vouches are from users who:
 *   - Have balance in wallet (not empty)
 *   - Have accessed and paid back credit (if they've taken any)
 *   - Are at least 1 month old
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    let userId: string | null = null
    
    if (user) {
      userId = user.id
    } else {
      // In dev mode, check for userId in headers
      userId = request.headers.get("x-user-id")
      
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    // Use service client to check trustworthy vouches
    if (supabaseServiceKey && supabaseUrl) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
      
      // Get total trust points (for display)
      const { data: trustPoints, error: trustError } = await serviceClient
        .from("trust_points")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle()
      
      if (trustError) {
        console.error("[Credit Eligibility API] Error fetching trust points:", trustError)
        return NextResponse.json({ 
          error: "Failed to check eligibility",
          details: trustError.message 
        }, { status: 500 })
      }
      
      // Get trustworthy vouches count using the database function
      const { data: trustworthyCountData, error: countError } = await serviceClient
        .rpc("get_trustworthy_vouches_count", { user_uuid: userId })
      
      if (countError) {
        console.error("[Credit Eligibility API] Error fetching trustworthy vouches count:", countError)
        return NextResponse.json({ 
          error: "Failed to check eligibility",
          details: countError.message 
        }, { status: 500 })
      }
      
      const trustworthyVouchesCount = trustworthyCountData || 0
      const totalTrustPoints = trustPoints?.balance || 0
      const eligible = trustworthyVouchesCount >= 5
      
      // Get detailed breakdown of vouches for better messaging
      const { data: vouchesData, error: vouchesError } = await serviceClient
        .from("user_vouches")
        .select("id, trust_points_transferred, is_trustworthy, created_at")
        .eq("vouched_user_id", userId)
      
      const trustworthyVouches = vouchesData?.filter(v => v.is_trustworthy === true) || []
      const pendingVouches = vouchesData?.filter(v => v.is_trustworthy === null) || []
      const untrustworthyVouches = vouchesData?.filter(v => v.is_trustworthy === false) || []
      
      return NextResponse.json({
        eligible,
        trustworthyVouchesCount,
        totalTrustPoints,
        breakdown: {
          trustworthy: trustworthyVouches.length,
          pending: pendingVouches.length,
          untrustworthy: untrustworthyVouches.length,
          total: vouchesData?.length || 0
        },
        reason: eligible 
          ? null 
          : `Necesitas al menos 5 puntos de confianza recibidos de usuarios confiables para solicitar un crédito. Tienes ${trustworthyVouchesCount} punto(s) confiable(s) de ${totalTrustPoints} punto(s) total(es).`
      })
    }
    
    // Fallback: try with regular client
    const { data: trustPoints, error: trustError } = await supabase
      .from("trust_points")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle()
    
    if (trustError) {
      console.error("[Credit Eligibility API] Error fetching trust points:", trustError)
      return NextResponse.json({ 
        error: "Failed to check eligibility",
        details: trustError.message 
      }, { status: 500 })
    }
    
    // Try to get trustworthy vouches count
    const { data: trustworthyCountData, error: countError } = await supabase
      .rpc("get_trustworthy_vouches_count", { user_uuid: userId })
    
    const trustworthyVouchesCount = trustworthyCountData || 0
    const totalTrustPoints = trustPoints?.balance || 0
    const eligible = trustworthyVouchesCount >= 5
    
    return NextResponse.json({
      eligible,
      trustworthyVouchesCount,
      totalTrustPoints,
      reason: eligible 
        ? null 
        : `Necesitas al menos 5 puntos de confianza recibidos de usuarios confiables para solicitar un crédito. Tienes ${trustworthyVouchesCount} punto(s) confiable(s) de ${totalTrustPoints} punto(s) total(es).`
    })
  } catch (error) {
    console.error("[Credit Eligibility API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

