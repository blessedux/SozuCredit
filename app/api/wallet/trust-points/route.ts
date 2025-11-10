import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    let userId: string | null = null
    
    if (user) {
      // Normal Supabase auth flow
      userId = user.id
      console.log("[Trust Points API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers (from sessionStorage)
      userId = request.headers.get("x-user-id")
      console.log("[Trust Points API] Dev mode, userId from header:", userId)
      
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    // For dev mode without proper Supabase session, try to use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!user && supabaseServiceKey && supabaseUrl) {
      console.log("[Trust Points API] Using service client for dev mode")
      try {
        const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
        
        const { data: trustPoints, error: trustError } = await serviceClient
          .from("trust_points")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle()
        
        if (trustError) {
          console.error("[Trust Points API] Error fetching trust points:", trustError)
          // Return default trust points (0 for new users)
          return NextResponse.json({ 
            trustPoints: {
              balance: 0,
              last_daily_credit: null
            }
          })
        }
        
        if (!trustPoints) {
          // Return default trust points for new users (0 points)
          return NextResponse.json({ 
            trustPoints: {
              balance: 0,
              last_daily_credit: null
            }
          })
        }
        
        return NextResponse.json({ trustPoints })
      } catch (serviceError) {
        console.error("[Trust Points API] Service client error:", serviceError)
        // Return default trust points (0 for new users)
        return NextResponse.json({ 
          trustPoints: {
            balance: 0,
            last_daily_credit: null
          }
        })
      }
    }
    
    // Normal Supabase auth flow
    const { data: trustPoints, error: trustError } = await supabase
      .from("trust_points")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
    
    if (trustError) {
      console.error("[Trust Points API] Error fetching trust points:", trustError)
      return NextResponse.json({ 
        error: "Failed to fetch trust points",
        details: trustError.message 
      }, { status: 500 })
    }
    
    // If trust points don't exist, return default (0 for new users)
    if (!trustPoints) {
      return NextResponse.json({ 
        trustPoints: {
          balance: 0,
          last_daily_credit: null
        }
      })
    }
    
    return NextResponse.json({ trustPoints })
  } catch (error) {
    console.error("[Trust Points API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

