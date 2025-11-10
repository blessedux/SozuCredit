import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * GET /api/wallet/referral/status
 * Get user's referral code and statistics
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
    
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Service not available" }, { status: 500 })
    }
    
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    // Get all referrals for this user
    const { data: referrals, error: referralsError } = await serviceClient
      .from("referrals")
      .select(`
        id,
        referral_code,
        used,
        used_at,
        trust_points_awarded,
        created_at,
        referred_user_id,
        profiles:referred_user_id (
          id,
          username,
          display_name
        )
      `)
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
    
    if (referralsError) {
      console.error("[Referral Status API] Error fetching referrals:", referralsError)
      return NextResponse.json({ 
        error: "Failed to fetch referrals",
        details: referralsError.message 
      }, { status: 500 })
    }
    
    // Find active (unused) referral code
    const activeReferral = referrals?.find((r: any) => !r.used)
    
    // Count successful referrals
    const successfulReferrals = referrals?.filter((r: any) => r.used) || []
    const totalPointsEarned = successfulReferrals.reduce((sum: number, r: any) => 
      sum + (r.trust_points_awarded || 0), 0
    )
    
    return NextResponse.json({
      success: true,
      referralCode: activeReferral?.referral_code || null,
      totalReferrals: successfulReferrals.length,
      totalPointsEarned,
      referrals: successfulReferrals.map((r: any) => ({
        id: r.id,
        referralCode: r.referral_code,
        usedAt: r.used_at,
        trustPointsAwarded: r.trust_points_awarded,
        referredUser: r.profiles ? {
          id: r.profiles.id,
          username: r.profiles.username,
          displayName: r.profiles.display_name
        } : null
      }))
    })
  } catch (error) {
    console.error("[Referral Status API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

