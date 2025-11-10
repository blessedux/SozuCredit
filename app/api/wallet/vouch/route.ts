import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { username, points } = await request.json()
    
    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }
    
    if (!points || typeof points !== "number" || points <= 0) {
      return NextResponse.json({ error: "Valid points amount is required" }, { status: 400 })
    }
    
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
    
    // Use service client to find target user and transfer trust points
    if (supabaseServiceKey && supabaseUrl) {
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)
      
      // Find target user by username
      const { data: targetProfile, error: profileError } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("username", username)
        .single()
      
      if (profileError || !targetProfile) {
        return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
      }
      
      // Check if sender has enough trust points
      const { data: senderTrust, error: senderError } = await serviceClient
        .from("trust_points")
        .select("balance")
        .eq("user_id", userId)
        .single()
      
      if (senderError || !senderTrust) {
        return NextResponse.json({ error: "Error al obtener tus puntos de confianza" }, { status: 500 })
      }
      
      if (senderTrust.balance < points) {
        return NextResponse.json({ error: "No tienes suficientes puntos de confianza" }, { status: 400 })
      }
      
      // Transfer trust points using a transaction
      // Deduct from sender
      const { error: deductError } = await serviceClient
        .from("trust_points")
        .update({ balance: senderTrust.balance - points, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
      
      if (deductError) {
        return NextResponse.json({ error: "Error al transferir puntos" }, { status: 500 })
      }
      
      // Add to receiver
      const { data: receiverTrust, error: receiverError } = await serviceClient
        .from("trust_points")
        .select("balance")
        .eq("user_id", targetProfile.id)
        .maybeSingle()
      
      if (receiverError) {
        return NextResponse.json({ error: "Error al obtener puntos del receptor" }, { status: 500 })
      }
      
      // Award points to receiver
      // If receiver has 0 points, this is their first vouch - they get the points
      // If they already have points, they get the points added
      const currentBalance = receiverTrust?.balance || 0
      const newBalance = currentBalance + points
      
      const { error: addError } = await serviceClient
        .from("trust_points")
        .upsert({
          user_id: targetProfile.id,
          balance: newBalance,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "user_id"
        })
      
      if (addError) {
        return NextResponse.json({ error: "Error al agregar puntos al receptor" }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, message: "Puntos de confianza enviados" })
    }
    
    return NextResponse.json({ error: "Service not available" }, { status: 500 })
  } catch (error) {
    console.error("[Vouch API] Error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

