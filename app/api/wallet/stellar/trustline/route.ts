import { createClient } from "@/lib/supabase/server"
import { NextResponse, NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { establishUSDCTrustline } from "@/lib/turnkey/stellar-wallet"

export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    let userId: string | null = null

    if (user) {
      userId = user.id
      console.log("[Stellar Trustline API] Using Supabase auth, userId:", userId)
    } else {
      // In dev mode, check for userId in headers
      userId = request.headers.get("x-user-id")
      console.log("[Stellar Trustline API] Dev mode, userId from header:", userId)

      if (!userId) {
        console.error("[Stellar Trustline API] No userId provided")
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: corsHeaders(request as any) }
        )
      }
    }

    // Get optional USDC issuer from request body
    const body = await request.json().catch(() => ({}))
    const usdcIssuer = body.usdcIssuer

    console.log("[Stellar Trustline API] Establishing USDC trustline for user:", userId)
    if (usdcIssuer) {
      console.log("[Stellar Trustline API] Using custom USDC issuer:", usdcIssuer)
    }

    // Establish trustline
    const result = await establishUSDCTrustline(userId, usdcIssuer)

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || "Failed to establish trustline" 
        },
        { status: 500, headers: corsHeaders(request as any) }
      )
    }

    return NextResponse.json(
      {
        success: true,
        transactionHash: result.transactionHash,
        message: result.transactionHash 
          ? "USDC trustline established successfully" 
          : "USDC trustline already exists"
      },
      { headers: corsHeaders(request as any) }
    )
  } catch (error: any) {
    console.error("[Stellar Trustline API] Error:", error)
    console.error("[Stellar Trustline API] Error message:", error.message)
    console.error("[Stellar Trustline API] Error stack:", error.stack)
    
    // Extract detailed error message
    const errorMessage = error.message || "Internal server error"
    console.error("[Stellar Trustline API] Returning error to client:", errorMessage)
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage // Return the full error message so client can see it
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}

