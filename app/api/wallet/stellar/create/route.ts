import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet"
import { getStellarConfig } from "@/lib/turnkey/config"
export async function OPTIONS(request: Request) {
  return handleOPTIONS(request as any)
}

/**
 * Non-custodial wallet: we never generate keys on the server.
 * - If the client sends publicKey in the body, we register it (upsert for this user).
 * - If no publicKey is sent, we return the existing wallet if any, or 400 asking the client to create the wallet first (passkey login or WalletCreator).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get the authenticated user (required: only signed-in user can register or get wallet)
    const { data: { user } } = await supabase.auth.getUser()

    let userId: string | null = null

    if (user) {
      userId = user.id
      console.log("[Stellar Wallet API] Using Supabase auth, userId:", userId)
    } else {
      // Dev / passkey-only: userId from headers (sessionStorage auth)
      userId = request.headers.get("x-user-id")
      console.log("[Stellar Wallet API] Using x-user-id (dev/passkey):", userId ? "present" : "missing")

      if (!userId) {
        console.error("[Stellar Wallet API] No userId provided")
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401, headers: corsHeaders(request as any) }
        )
      }
    }

    const useServiceClient = !user
    let body: { publicKey?: string } = {}
    try {
      body = await request.json()
    } catch {
      // No body is ok
    }

    const clientPublicKey = typeof body?.publicKey === "string" ? body.publicKey.trim() : null

    // Path 1: Client sends the public key they derived (non-custodial) → register it (always upsert so client key wins)
    if (clientPublicKey && clientPublicKey.length > 0) {
      console.log("[Stellar Wallet API] Registering client-derived public key (non-custodial):", clientPublicKey.substring(0, 10) + "...")
      const stellarConfig = getStellarConfig()
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
          { error: "Server configuration error" },
          { status: 500, headers: corsHeaders(request as any) }
        )
      }
      const { createClient: createServiceClient } = await import("@supabase/supabase-js")
      const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey) as any
      const { data: updated, error } = await serviceClient
        .from("stellar_wallets")
        .upsert(
          {
            user_id: userId,
            public_key: clientPublicKey,
            turnkey_wallet_id: null,
            network: stellarConfig.network,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single()
      if (error) {
        console.error("[Stellar Wallet API] Upsert error:", error)
        return NextResponse.json(
          { error: "Failed to register wallet" },
          { status: 500, headers: corsHeaders(request as any) }
        )
      }
      return NextResponse.json(
        {
          walletId: updated.public_key,
          publicKey: updated.public_key,
          network: updated.network,
          trustlineCreated: false,
          trustlineError: null,
          needsClientSigning: false,
        },
        { headers: corsHeaders(request as any) }
      )
    }

    // Path 2: No publicKey in body → return existing wallet if any; otherwise 400
    const existingWallet = await getStellarWallet(userId, useServiceClient)
    if (existingWallet && existingWallet.publicKey && existingWallet.publicKey.trim().length > 0) {
      console.log("[Stellar Wallet API] Returning existing wallet:", existingWallet.publicKey.substring(0, 10) + "...")
      return NextResponse.json(
        {
          walletId: existingWallet.turnkeyWalletId || existingWallet.publicKey,
          publicKey: existingWallet.publicKey,
          network: existingWallet.network,
        },
        { headers: corsHeaders(request as any) }
      )
    }

    // No wallet and no publicKey sent: client must create wallet client-side first (passkey login or WalletCreator)
    console.log("[Stellar Wallet API] No wallet and no publicKey in request – client must create wallet first")
    return NextResponse.json(
      {
        error: "Wallet must be created client-side first. Sign in with your passkey or use Create Wallet; then your public key will be registered automatically.",
        code: "WALLET_CREATE_CLIENT_SIDE",
      },
      { status: 400, headers: corsHeaders(request as any) }
    )
  } catch (error) {
    console.error("[Stellar Wallet API] Error creating wallet:", error)

    const isDevelopment = process.env.NODE_ENV === "development"

    return NextResponse.json(
      {
        error: "Failed to create wallet",
        ...(isDevelopment && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
      { status: 500, headers: corsHeaders(request as any) }
    )
  }
}

