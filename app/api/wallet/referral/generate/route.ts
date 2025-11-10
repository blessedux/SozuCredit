import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * POST /api/wallet/referral/generate
 * Generate a referral code for the authenticated user
 * 
 * Each user can have one active referral code
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
    
    // Check if user already has an unused referral code
    const { data: existingReferral, error: checkError } = await serviceClient
      .from("referrals")
      .select("referral_code, used")
      .eq("referrer_id", userId)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (checkError) {
      console.error("[Referral Generate API] Error checking existing referral:", checkError)
      return NextResponse.json({ 
        error: "Failed to check existing referral",
        details: checkError.message 
      }, { status: 500 })
    }
    
    // If user already has an unused referral code, return it
    if (existingReferral && !existingReferral.used) {
      return NextResponse.json({
        success: true,
        referralCode: existingReferral.referral_code,
        alreadyExists: true
      })
    }
    
    // Generate new referral code using database function
    const { data: referralCode, error: generateError } = await serviceClient
      .rpc("generate_referral_code", { user_uuid: userId })
    
    if (generateError) {
      console.error("[Referral Generate API] Error generating referral code:", generateError)
      
      // Fallback: Generate code manually
      const fallbackCode = `REF${userId.substring(0, 8).toUpperCase().replace(/-/g, "")}`
      
      const { data: newReferral, error: insertError } = await serviceClient
        .from("referrals")
        .insert({
          referrer_id: userId,
          referral_code: fallbackCode,
          trust_points_awarded: 1
        })
        .select("referral_code")
        .single()
      
      if (insertError) {
        console.error("[Referral Generate API] Error inserting referral:", insertError)
        return NextResponse.json({ 
          error: "Failed to generate referral code",
          details: insertError.message 
        }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        referralCode: newReferral.referral_code,
        alreadyExists: false
      })
    }
    
    // Get the generated referral code
    const { data: referral, error: fetchError } = await serviceClient
      .from("referrals")
      .select("referral_code")
      .eq("referrer_id", userId)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    
    if (fetchError || !referral) {
      return NextResponse.json({ 
        error: "Failed to retrieve referral code",
        details: fetchError?.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      referralCode: referral.referral_code,
      alreadyExists: false
    })
  } catch (error) {
    console.error("[Referral Generate API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

