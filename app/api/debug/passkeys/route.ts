import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import type { NextRequest } from "next/server"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
    
    // Get all passkeys
    const { data: passkeys, error: passkeysError } = await serviceClient
      .from("passkeys")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
    
    if (passkeysError) {
      console.error("[Debug] Error fetching passkeys:", passkeysError)
      return NextResponse.json(
        { error: "Failed to fetch passkeys", details: passkeysError.message },
        { status: 500, headers: corsHeaders(request) }
      )
    }
    
    // Get profiles for the users
    const userIds = passkeys?.map((p: any) => p.user_id) || []
    let profilesMap: Record<string, { username?: string }> = {}
    
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await serviceClient
        .from("profiles")
        .select("id, username")
        .in("id", userIds)
      
      if (!profilesError && profiles) {
        profilesMap = profiles.reduce((acc: Record<string, { username?: string }>, profile: any) => {
          acc[profile.id] = { username: profile.username }
          return acc
        }, {})
      }
    }
    
    // Format the response for debugging
    const formatted = passkeys?.map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      username: profilesMap[p.user_id]?.username || "N/A",
      credential_id: p.credential_id,
      credential_id_length: p.credential_id?.length || 0,
      credential_id_first_20: p.credential_id?.substring(0, 20) || "N/A",
      credential_id_last_20: p.credential_id?.substring(p.credential_id.length - 20) || "N/A",
      created_at: p.created_at,
      last_used_at: p.last_used_at,
    })) || []
    
    return NextResponse.json(
      { 
        count: formatted.length,
        passkeys: formatted 
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Debug] Unexpected error:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}

