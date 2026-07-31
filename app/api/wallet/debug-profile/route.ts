/**
 * GET /api/wallet/debug-profile
 *
 * Diagnostic endpoint: returns the full DB state for the authenticated user so
 * you can immediately see if profiles.username, stellar_wallets, etc. are set.
 *
 * ONLY call this in dev/staging — it exposes internal DB state.
 * Protect it with the internal secret header or remove in production.
 */
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { debugRoutesEnabled } from "@/lib/debug-routes"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)

  if (!debugRoutesEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Service not configured" }, { status: 500, headers })
  }

  const userId = request.headers.get("x-user-id")
  const tag = request.nextUrl.searchParams.get("tag")

  if (!userId && !tag) {
    return NextResponse.json(
      { error: "Provide x-user-id header or ?tag= query param" },
      { status: 400, headers }
    )
  }

  const svc = createServiceClient(supabaseUrl, supabaseServiceKey)

  try {
    let profileQuery = svc.from("profiles").select("id, username, display_name, created_at")

    if (userId) {
      profileQuery = profileQuery.eq("id", userId) as typeof profileQuery
    } else if (tag) {
      profileQuery = profileQuery.ilike("username", tag) as typeof profileQuery
    }

    const { data: profiles, error: pErr } = await profileQuery.limit(5)

    // Fetch wallets for all found profiles
    const userIds = (profiles ?? []).map((p: any) => p.id)
    const { data: wallets } = userIds.length
      ? await svc.from("stellar_wallets").select("user_id, public_key, network, created_at, updated_at").in("user_id", userIds)
      : { data: [] }

    // If userId, also pull auth metadata
    let authMeta: any = null
    if (userId) {
      const { data: au } = await svc.auth.admin.getUserById(userId)
      authMeta = {
        email: au?.user?.email,
        username_meta: au?.user?.user_metadata?.username,
        created_at: au?.user?.created_at,
      }
    }

    return NextResponse.json(
      {
        profiles,
        wallets,
        authMeta,
        diagnosis: (profiles ?? []).map((p: any) => {
          const userWallets = (wallets ?? []).filter((w: any) => w.user_id === p.id)
          return {
            userId: p.id,
            username: p.username ?? "⚠️  NULL — not resolvable by tag",
            walletCount: userWallets.length,
            walletPublicKeys: userWallets.map((w: any) => w.public_key),
            usernameOk: Boolean(p.username),
            walletOk: userWallets.length > 0,
          }
        }),
      },
      { headers }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500, headers })
  }
}
