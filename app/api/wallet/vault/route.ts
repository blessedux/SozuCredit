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
      console.log("[Wallet API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers (from sessionStorage)
      userId = request.headers.get("x-user-id")
      console.log("[Wallet API] Dev mode, userId from header:", userId)
      
      if (!userId) {
        console.error("[Wallet API] No userId provided")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
    
    // For dev mode without proper Supabase session, try to use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!user) {
      // In dev mode, if service role key is available, use it
      if (supabaseServiceKey && supabaseUrl) {
        console.log("[Wallet API] Using service client for dev mode")
        try {
          // Use service client to bypass RLS for dev mode
          const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
          
          const { data: vault, error: vaultError } = await serviceClient
            .from("vaults")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle() // Use maybeSingle() instead of single() to handle missing vault
          
          if (vaultError) {
            console.error("[Wallet API] Error fetching vault with service client:", vaultError)
            // Fall through to return default vault
          } else if (vault) {
            console.log("[Wallet API] Vault found:", vault)
            return NextResponse.json({ vault })
          }
        } catch (serviceError) {
          console.error("[Wallet API] Service client error:", serviceError)
          // Fall through to return default vault
        }
      }
      
      // If vault doesn't exist or service key not available, return default vault
      console.log("[Wallet API] Returning default vault for dev mode")
      return NextResponse.json({ 
        vault: {
          id: null,
          balance: 0,
          yield_rate: 15,
          alias: null
        }
      })
    }
    
    // Normal Supabase auth flow
    const { data: vault, error: vaultError } = await supabase
      .from("vaults")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle() // Use maybeSingle() instead of single() to handle missing vault
    
    if (vaultError) {
      console.error("[Wallet API] Error fetching vault:", vaultError)
      return NextResponse.json({ 
        error: "Failed to fetch vault",
        details: vaultError.message 
      }, { status: 500 })
    }
    
    // If vault doesn't exist, return default vault
    if (!vault) {
      console.log("[Wallet API] Vault not found for user, returning default")
      return NextResponse.json({ 
        vault: {
          id: null,
          balance: 0,
          yield_rate: 15,
          alias: null
        }
      })
    }
    
    return NextResponse.json({ vault })
  } catch (error) {
    console.error("[Wallet API] Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

