import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * GET /api/wallet/vouches/received
 * Get all vouches received by the authenticated user
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
    
    // Use service client to fetch vouches
    if (supabaseServiceKey && supabaseUrl) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
      
      // Get vouches received by this user
      const { data: vouches, error: vouchesError } = await serviceClient
        .from("user_vouches")
        .select(`
          id,
          voucher_id,
          trust_points_transferred,
          message,
          created_at
        `)
        .eq("vouched_user_id", userId)
        .order("created_at", { ascending: false })
      
      if (vouchesError) {
        console.error("[Vouches Received API] Error fetching vouches:", vouchesError)
        return NextResponse.json({ 
          error: "Failed to fetch vouches",
          details: vouchesError.message 
        }, { status: 500 })
      }
      
      // Get voucher profiles separately
      const voucherIds = (vouches || []).map((v: any) => v.voucher_id)
      const { data: profiles } = voucherIds.length > 0
        ? await serviceClient
            .from("profiles")
            .select("id, username, display_name")
            .in("id", voucherIds)
        : { data: [] }
      
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
      
      // Format the response
      const formattedVouches = (vouches || []).map((vouch: any) => {
        const profile = profileMap.get(vouch.voucher_id)
        return {
          id: vouch.id,
          voucher: profile ? {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name
          } : {
            id: vouch.voucher_id,
            username: null,
            display_name: null
          },
          trust_points_transferred: vouch.trust_points_transferred,
          message: vouch.message,
          created_at: vouch.created_at
        }
      })
      
      return NextResponse.json({
        vouches: formattedVouches,
        total: formattedVouches.length
      })
    }
    
    // Fallback: try with regular client
    const { data: vouches, error: vouchesError } = await supabase
      .from("user_vouches")
      .select(`
        id,
        voucher_id,
        trust_points_transferred,
        message,
        created_at
      `)
      .eq("vouched_user_id", userId)
      .order("created_at", { ascending: false })
    
    if (vouchesError) {
      console.error("[Vouches Received API] Error fetching vouches:", vouchesError)
      return NextResponse.json({ 
        error: "Failed to fetch vouches",
        details: vouchesError.message 
      }, { status: 500 })
    }
    
    // Get voucher profiles separately
    const voucherIds = (vouches || []).map((v: any) => v.voucher_id)
    const { data: profiles } = voucherIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", voucherIds)
      : { data: [] }
    
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
    
    // Format the response
    const formattedVouches = (vouches || []).map((vouch: any) => {
      const profile = profileMap.get(vouch.voucher_id)
      return {
        id: vouch.id,
        voucher: profile ? {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name
        } : {
          id: vouch.voucher_id,
          username: null,
          display_name: null
        },
        trust_points_transferred: vouch.trust_points_transferred,
        message: vouch.message,
        created_at: vouch.created_at
      }
    })
    
    return NextResponse.json({
      vouches: formattedVouches,
      total: formattedVouches.length
    })
  } catch (error) {
    console.error("[Vouches Received API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

