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
          .select("username, display_name")
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
      .select("username, display_name")
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
    const { username, display_name } = await request.json()
    
    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }
    
    const trimmedUsername = username.trim()
    
    // Validate username format (alphanumeric and underscore, 3-30 chars)
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
      return NextResponse.json({ 
        error: "Username must be 3-30 characters and contain only letters, numbers, and underscores" 
      }, { status: 400 })
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
      
      // Check if username is already taken by another user
      const { data: existingProfile, error: checkError } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("username", trimmedUsername)
        .neq("id", userId)
        .maybeSingle()
      
      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 means no rows found, which is what we want
        console.error("[Profile API] Error checking username:", checkError)
        return NextResponse.json({ error: "Error checking username availability" }, { status: 500 })
      }
      
      if (existingProfile) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 })
      }
      
      // Update profile
      const updateData: { username: string; display_name?: string } = {
        username: trimmedUsername,
      }
      
      if (display_name && typeof display_name === "string") {
        updateData.display_name = display_name.trim()
      } else {
        updateData.display_name = trimmedUsername
      }
      
      const { data: updatedProfile, error: updateError } = await serviceClient
        .from("profiles")
        .update(updateData)
        .eq("id", userId)
        .select("username, display_name")
        .single()
      
      if (updateError) {
        console.error("[Profile API] Error updating profile:", updateError)
        
        // Check if it's a unique constraint violation
        if (updateError.code === "23505") {
          return NextResponse.json({ error: "Username is already taken" }, { status: 409 })
        }
        
        return NextResponse.json({ 
          error: "Failed to update profile",
          details: updateError.message 
        }, { status: 500 })
      }
      
      if (!updatedProfile) {
        // Profile doesn't exist, create it
        const { data: newProfile, error: createError } = await serviceClient
          .from("profiles")
          .insert({
            id: userId,
            username: trimmedUsername,
            display_name: display_name?.trim() || trimmedUsername
          })
          .select("username, display_name")
          .single()
        
        if (createError) {
          console.error("[Profile API] Error creating profile:", createError)
          return NextResponse.json({ 
            error: "Failed to create profile",
            details: createError.message 
          }, { status: 500 })
        }
        
        return NextResponse.json({ profile: newProfile })
      }
      
      return NextResponse.json({ profile: updatedProfile })
    }
    
    // Fallback: try with regular client
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({
        username: trimmedUsername,
        display_name: display_name?.trim() || trimmedUsername
      })
      .eq("id", userId)
      .select("username, display_name")
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

