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
      
      // Enforce: Cannot vouch if balance is 0
      if (senderTrust.balance === 0) {
        return NextResponse.json({ 
          error: "No puedes apoyar a otros usuarios sin puntos de confianza. Necesitas al menos 1 punto." 
        }, { status: 400 })
      }
      
      if (senderTrust.balance < points) {
        return NextResponse.json({ error: "No tienes suficientes puntos de confianza" }, { status: 400 })
      }
      
      // Prevent self-vouching
      if (userId === targetProfile.id) {
        return NextResponse.json({ error: "No puedes apoyarte a ti mismo" }, { status: 400 })
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
      
      const newBalance = (receiverTrust?.balance || 0) + points
      
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
      
      // Record the vouch in user_vouches table
      // IMPORTANT: Service client should bypass RLS, but we need to ensure it works
      console.log("[Vouch API] Attempting to insert vouch record...")
      console.log("[Vouch API] Voucher ID:", userId)
      console.log("[Vouch API] Vouched User ID:", targetProfile.id)
      console.log("[Vouch API] Trust Points:", points)
      
      const { data: vouchRecord, error: vouchError } = await serviceClient
        .from("user_vouches")
        .insert({
          voucher_id: userId,
          vouched_user_id: targetProfile.id,
          trust_points_transferred: points,
          message: null // Can be extended later to accept messages
        })
        .select()
        .single()
      
      if (vouchError) {
        console.error("[Vouch API] ❌ Error recording vouch:", vouchError)
        console.error("[Vouch API] Error code:", vouchError.code)
        console.error("[Vouch API] Error message:", vouchError.message)
        console.error("[Vouch API] Error details:", vouchError.details)
        console.error("[Vouch API] Error hint:", vouchError.hint)
        console.error("[Vouch API] Full error object:", JSON.stringify(vouchError, null, 2))
        
        // Try to insert without .single() to see if that's the issue
        console.log("[Vouch API] Retrying insert without .single()...")
        const { data: vouchRecordRetry, error: vouchErrorRetry } = await serviceClient
          .from("user_vouches")
          .insert({
            voucher_id: userId,
            vouched_user_id: targetProfile.id,
            trust_points_transferred: points,
            message: null
          })
          .select()
        
        if (vouchErrorRetry) {
          console.error("[Vouch API] ❌ Retry also failed:", vouchErrorRetry)
        } else {
          console.log("[Vouch API] ✅ Retry succeeded:", vouchRecordRetry)
          // Use the retry result
          const finalRecord = Array.isArray(vouchRecordRetry) ? vouchRecordRetry[0] : vouchRecordRetry
          return NextResponse.json({ 
            success: true, 
            message: "Puntos de confianza enviados",
            vouch: finalRecord ? {
              id: finalRecord.id,
              voucher_id: finalRecord.voucher_id,
              vouched_user_id: finalRecord.vouched_user_id,
              trust_points_transferred: finalRecord.trust_points_transferred,
              created_at: finalRecord.created_at
            } : null
          })
        }
        
        // Don't fail the request if vouch recording fails, but log it
        // The points transfer already succeeded, so we continue
      } else {
        console.log("[Vouch API] ✅ Vouch recorded successfully:", vouchRecord?.id)
      }
      
      // Get the trustworthiness status if available
      const vouchWithTrustworthiness = vouchRecord ? {
        id: vouchRecord.id,
        voucher_id: vouchRecord.voucher_id,
        vouched_user_id: vouchRecord.vouched_user_id,
        trust_points_transferred: vouchRecord.trust_points_transferred,
        is_trustworthy: (vouchRecord as any).is_trustworthy,
        created_at: vouchRecord.created_at
      } : null
      
      return NextResponse.json({ 
        success: true, 
        message: "Puntos de confianza enviados",
        vouch: vouchWithTrustworthiness
      })
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

