import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * GET /api/wallet/credit-eligibility
 * Check if user is eligible to apply for business credit/loan
 * 
 * Requirements:
 * - User must have 5+ trust points
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
    
    // Use service client to check trust points
    if (supabaseServiceKey && supabaseUrl) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
      
      // Get user's trust points
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
      
      const balance = trustPoints?.balance || 0
      const eligible = balance >= 5
      
      return NextResponse.json({
        eligible,
        trustPoints: balance,
        reason: eligible 
          ? null 
          : `Necesitas al menos 5 puntos de confianza para solicitar un crédito. Tienes ${balance} punto(s).`
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
    
    const balance = trustPoints?.balance || 0
    const eligible = balance >= 5
    
    return NextResponse.json({
      eligible,
      trustPoints: balance,
      reason: eligible 
        ? null 
        : `Necesitas al menos 5 puntos de confianza para solicitar un crédito. Tienes ${balance} punto(s).`
    })
  } catch (error) {
    console.error("[Credit Eligibility API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

