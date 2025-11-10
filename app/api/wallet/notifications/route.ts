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
      console.log("[Notifications API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers (from sessionStorage)
      userId = request.headers.get("x-user-id")
      console.log("[Notifications API] Dev mode, userId from header:", userId)
      
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    // Use service client for dev mode or if needed
    if (!user && supabaseServiceKey && supabaseUrl) {
      console.log("[Notifications API] Using service client for dev mode")
      try {
        const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
        
        const { data: notifications, error: notificationsError } = await serviceClient
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50)
        
        if (notificationsError) {
          console.error("[Notifications API] Error fetching notifications:", notificationsError)
          return NextResponse.json({ notifications: [] })
        }
        
        return NextResponse.json({ notifications: notifications || [] })
      } catch (serviceError) {
        console.error("[Notifications API] Service client error:", serviceError)
        return NextResponse.json({ notifications: [] })
      }
    }
    
    // Normal Supabase auth flow
    const { data: notifications, error: notificationsError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
    
    if (notificationsError) {
      console.error("[Notifications API] Error fetching notifications:", notificationsError)
      return NextResponse.json({ 
        error: "Failed to fetch notifications",
        details: notificationsError.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({ notifications: notifications || [] })
  } catch (error) {
    console.error("[Notifications API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { notificationId, read } = await request.json()
    
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    let userId: string | null = null
    
    if (user) {
      userId = user.id
    } else {
      userId = request.headers.get("x-user-id")
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!user && supabaseServiceKey && supabaseUrl) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
      
      const { error: updateError } = await serviceClient
        .from("notifications")
        .update({ read, updated_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId)
      
      if (updateError) {
        return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
      }
      
      return NextResponse.json({ success: true })
    }
    
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read, updated_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", userId)
    
    if (updateError) {
      return NextResponse.json({ error: "Failed to update notification" }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Notifications API] Error updating notification:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

