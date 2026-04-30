import { createClient as createServiceClient, createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { createClient as createServerSupabase } from "@/lib/supabase/server"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

/**
 * GET /api/wallet/sozu-tag
 *
 * Returns the authenticated user's Sozu tag (`profiles.username`) and primary Stellar address
 * for partner apps (e.g. Sozu Pay Dashboard) that share the same Supabase project but run on
 * another origin (no shared session cookie).
 *
 * Auth (first match wins):
 * 1) `Authorization: Bearer <Supabase access_token>` — JWT from the same Supabase Auth pool.
 * 2) Cookie session — same as Sozu Credit web (optional).
 * 3) Server-to-server: `X-Sozu-Internal-Secret` must equal env `SOZU_INTERNAL_API_SECRET`, and
 *    `X-User-Id` must be the target user's UUID (only use from your trusted backend).
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers }
      )
    }

    let userId: string | null = null

    const internalSecret = process.env.SOZU_INTERNAL_API_SECRET?.trim()
    const headerSecret = request.headers.get("x-sozu-internal-secret")
    const headerUserId = request.headers.get("x-user-id")

    if (
      internalSecret &&
      internalSecret.length >= 16 &&
      headerSecret &&
      headerSecret === internalSecret &&
      headerUserId
    ) {
      userId = headerUserId.trim()
    }

    if (!userId) {
      const authHeader = request.headers.get("authorization")
      if (authHeader?.startsWith("Bearer ")) {
        const jwt = authHeader.slice(7).trim()
        if (jwt) {
          const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
          const { data: userData, error: jwtError } = await supabaseAuth.auth.getUser(jwt)
          if (jwtError || !userData.user) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers })
          }
          userId = userData.user.id
        }
      }
    }

    if (!userId) {
      const supabase = await createServerSupabase()
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        userId = userData.user.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle()

    if (profileError) {
      console.error("[Sozu Tag API] profile error:", profileError)
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500, headers })
    }

    const { data: wallets, error: walletError } = await serviceClient
      .from("stellar_wallets")
      .select("public_key, network")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)

    if (walletError) {
      console.error("[Sozu Tag API] wallet error:", walletError)
      return NextResponse.json({ error: "Failed to load wallet" }, { status: 500, headers })
    }

    const wallet = wallets?.[0] ?? null

    return NextResponse.json(
      {
        tag: profile?.username ?? null,
        stellarAddress: wallet?.public_key ?? null,
        network: wallet?.network ?? null,
      },
      { headers }
    )
  } catch (e) {
    console.error("[Sozu Tag API] unexpected:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers })
  }
}
