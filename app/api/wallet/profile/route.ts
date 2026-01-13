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
      console.log("[Profile API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers (from sessionStorage)
      userId = request.headers.get("x-user-id")
      console.log("[Profile API] Dev mode, userId from header:", userId)
      
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    // For dev mode without proper Supabase session, try to use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!user && supabaseServiceKey && supabaseUrl) {
      console.log("[Profile API] Using service client for dev mode")
      try {
        const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
        
        const { data: profile, error: profileError } = await serviceClient
          .from("profiles")
          .select("username, display_name, profile_picture")
          .eq("id", userId)
          .maybeSingle()
        
        if (profileError) {
          console.error("[Profile API] Error fetching profile:", profileError)
          // Return default profile
          return NextResponse.json({ 
            profile: {
              username: userId.substring(0, 8),
              display_name: userId.substring(0, 8)
            }
          })
        }
        
        if (!profile) {
          // Return default profile for new users
          return NextResponse.json({ 
            profile: {
              username: userId.substring(0, 8),
              display_name: userId.substring(0, 8)
            }
          })
        }
        
        return NextResponse.json({ profile })
      } catch (serviceError) {
        console.error("[Profile API] Service client error:", serviceError)
        // Return default profile
        return NextResponse.json({ 
          profile: {
            username: userId.substring(0, 8),
            display_name: userId.substring(0, 8)
          }
        })
      }
    }
    
    // Normal Supabase auth flow
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, display_name, profile_picture")
      .eq("id", userId)
      .maybeSingle()
    
    if (profileError) {
      console.error("[Profile API] Error fetching profile:", profileError)
      return NextResponse.json({ 
        error: "Failed to fetch profile",
        details: profileError.message 
      }, { status: 500 })
    }
    
    // If profile doesn't exist, return default
    if (!profile) {
      return NextResponse.json({ 
        profile: {
          username: userId.substring(0, 8),
          display_name: userId.substring(0, 8)
        }
      })
    }
    
    return NextResponse.json({ profile })
  } catch (error) {
    console.error("[Profile API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { username, display_name, profile_picture } = await request.json()
    
    // Username is immutable - cannot be changed after registration
    // This ensures 1 passkey = 1 tag = 1 wallet address mapping
    if (username) {
      return NextResponse.json({ 
        error: "Username (Sozu tag) cannot be changed. It is permanently linked to your passkey and wallet address." 
      }, { status: 403 })
    }
    
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    let userId: string | null = null
    
    if (user) {
      userId = user.id
      console.log("[Profile API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers
      userId = request.headers.get("x-user-id")
      console.log("[Profile API] Dev mode, userId from header:", userId)
      
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    // Use service client to update profile (works in both dev and prod mode)
    if (supabaseServiceKey && supabaseUrl) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
      
      // Update profile (username is immutable, only allow display_name and profile_picture)
      const updateData: { display_name?: string; profile_picture?: string } = {}
      
      if (display_name && typeof display_name === "string") {
        updateData.display_name = display_name.trim()
      }
      
      if (profile_picture && typeof profile_picture === "string") {
        updateData.profile_picture = profile_picture
      }
      
      // If no fields to update, return error
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ 
          error: "No valid fields to update. Username cannot be changed." 
        }, { status: 400 })
      }
      
      const { data: updatedProfile, error: updateError } = await serviceClient
        .from("profiles")
        .update(updateData)
        .eq("id", userId)
        .select("username, display_name, profile_picture")
        .maybeSingle()
      
      if (updateError) {
        console.error("[Profile API] Error updating profile:", updateError)
        
        // Check if it's a unique constraint violation
        if (updateError.code === "23505") {
          return NextResponse.json({ error: "Username is already taken" }, { status: 409 })
        }
        
        // Check if it's the "Cannot coerce to single JSON object" error
        if (updateError.message && updateError.message.includes("coerce")) {
          console.error("[Profile API] Query returned multiple rows or unexpected result")
          // Try to get the profile after update
          const { data: profileAfterUpdate, error: fetchError } = await serviceClient
            .from("profiles")
            .select("username, display_name")
            .eq("id", userId)
            .maybeSingle()
          
          if (fetchError || !profileAfterUpdate) {
            return NextResponse.json({ 
              error: "Failed to update profile",
              details: updateError.message 
            }, { status: 500 })
          }
          
          return NextResponse.json({ profile: profileAfterUpdate })
        }
        
        return NextResponse.json({ 
          error: "Failed to update profile",
          details: updateError.message 
        }, { status: 500 })
      }
      
      if (!updatedProfile) {
        // Profile doesn't exist - this shouldn't happen, but return error
        return NextResponse.json({ 
          error: "Profile not found. Please contact support.",
          details: "Profile should exist but was not found"
        }, { status: 404 })
      }
      
      return NextResponse.json({ profile: updatedProfile })
    }
    
    // Fallback: try with regular client
    const updateData: { display_name?: string; profile_picture?: string } = {}
    
    if (display_name && typeof display_name === "string") {
      updateData.display_name = display_name.trim()
    }
    
    if (profile_picture && typeof profile_picture === "string") {
      updateData.profile_picture = profile_picture
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ 
        error: "No valid fields to update. Username cannot be changed." 
      }, { status: 400 })
    }
    
    if (profile_picture && typeof profile_picture === "string") {
      updateData.profile_picture = profile_picture
    }
    
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select("username, display_name, profile_picture")
      .single()
    
    if (updateError) {
      console.error("[Profile API] Error updating profile:", updateError)
      
      if (updateError.code === "23505") {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 })
      }
      
      return NextResponse.json({ 
        error: "Failed to update profile",
        details: updateError.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({ profile: updatedProfile })
  } catch (error) {
    console.error("[Profile API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

