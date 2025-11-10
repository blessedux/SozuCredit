import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { maxflowClient } from "@/lib/maxflow/client"

/**
 * POST /api/wallet/trust-points/initialize
 * Initialize trust points based on MaxFlow ego score
 * 
 * This endpoint can be called when a user links their EVM address.
 * It checks their MaxFlow ego score and grants additional initial trust points
 * if their trust score is high enough.
 * 
 * This should only be called once per user, typically when they first link
 * their EVM address.
 */
export async function POST(request: Request) {
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
    
    // Get user's EVM address
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("evm_address")
      .eq("id", userId)
      .single()
    
    if (profileError || !profile) {
      return NextResponse.json({ 
        error: "Profile not found",
        details: profileError?.message 
      }, { status: 404 })
    }
    
    if (!profile.evm_address || !profile.evm_address.startsWith("0x")) {
      return NextResponse.json({ 
        error: "EVM address not linked. Please link your Ethereum address first." 
      }, { status: 400 })
    }
    
    // Check if user already has trust points initialized
    const { data: existingTrustPoints, error: trustError } = await serviceClient
      .from("trust_points")
      .select("balance, created_at")
      .eq("user_id", userId)
      .maybeSingle()
    
    if (trustError) {
      console.error("[Trust Points Initialize API] Error fetching trust points:", trustError)
      return NextResponse.json({ 
        error: "Failed to check existing trust points",
        details: trustError.message 
      }, { status: 500 })
    }
    
    // If user already has trust points and they were created more than 1 hour ago,
    // don't re-initialize (they may have already received initial allocation)
    if (existingTrustPoints) {
      const createdAt = new Date(existingTrustPoints.created_at)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      if (createdAt < oneHourAgo) {
        return NextResponse.json({ 
          success: true,
          message: "Trust points already initialized",
          trustPoints: existingTrustPoints.balance,
          alreadyInitialized: true
        })
      }
    }
    
    // Get MaxFlow ego score
    let trustScore: number
    let egoScore: any
    
    try {
      trustScore = await maxflowClient.getTrustScore(profile.evm_address)
      egoScore = await maxflowClient.getEgoScore(profile.evm_address)
    } catch (error) {
      console.error("[Trust Points Initialize API] Error fetching MaxFlow score:", error)
      // If MaxFlow fails, use default allocation
      trustScore = 0
    }
    
    // Calculate initial trust points based on trust score
    // NOTE: This is optional - users can still get points from referrals
    // MaxFlow initialization is an additional way to get initial points
    let initialPoints = 0 // Default (no free points)
    
    if (trustScore >= 1.5) {
      initialPoints = 15
    } else if (trustScore >= 1.0) {
      initialPoints = 10
    } else if (trustScore >= 0.5) {
      initialPoints = 7
    }
    
    // If user already has trust points, only add the difference
    // (don't reduce if they already have more)
    let finalBalance = initialPoints
    
    if (existingTrustPoints) {
      // Only increase if the calculated initial is higher
      if (initialPoints > existingTrustPoints.balance) {
        finalBalance = initialPoints
      } else {
        finalBalance = existingTrustPoints.balance
      }
    }
    
    // Update or create trust points
    const { data: updatedTrustPoints, error: updateError } = await serviceClient
      .from("trust_points")
      .upsert({
        user_id: userId,
        balance: finalBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      })
      .select()
      .single()
    
    if (updateError) {
      console.error("[Trust Points Initialize API] Error updating trust points:", updateError)
      return NextResponse.json({ 
        error: "Failed to initialize trust points",
        details: updateError.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: "Trust points initialized based on MaxFlow ego score",
      trustPoints: updatedTrustPoints.balance,
      trustScore: trustScore,
      initialAllocation: initialPoints,
      egoScore: egoScore ? {
        localHealth: egoScore.localHealth,
        metrics: egoScore.metrics
      } : null
    })
  } catch (error) {
    console.error("[Trust Points Initialize API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

