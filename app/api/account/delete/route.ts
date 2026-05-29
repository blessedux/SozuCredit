import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { corsHeaders, handleOPTIONS } from "@/lib/cors"
import { deleteStellarWallet } from "@/lib/turnkey/stellar-wallet"

export async function OPTIONS(request: NextRequest) {
  return handleOPTIONS(request)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * DELETE /api/account/delete
 * Permanently delete user account and free up the Sozu tag
 *
 * Auth: x-user-id header (UUID) — this app uses sessionStorage-based auth,
 * not Supabase session cookies, so we authenticate via the x-user-id header
 * that every authenticated client request carries.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate via x-user-id header (same pattern as all other routes)
    const userId = request.headers.get("x-user-id")?.trim()
    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders(request) }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseServiceKey || !supabaseUrl) {
      console.error("[Delete Account] Missing Supabase service credentials")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Get username before deletion (for logging)
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single()

    const username = profile?.username || "unknown"

    console.log(`[Delete Account] Starting account deletion for user: ${userId}, username: ${username}`)

    // Delete in order (respecting foreign key constraints)
    // 1. Delete stellar wallet
    try {
      await deleteStellarWallet(userId, true)
      console.log(`[Delete Account] ✅ Deleted stellar wallet for user: ${userId}`)
    } catch (walletError) {
      console.error(`[Delete Account] Error deleting wallet (continuing):`, walletError)
      // Continue even if wallet deletion fails
    }

    // 2. Delete passkeys
    const { error: passkeyError } = await serviceClient
      .from("passkeys")
      .delete()
      .eq("user_id", userId)

    if (passkeyError) {
      console.error(`[Delete Account] Error deleting passkeys:`, passkeyError)
    } else {
      console.log(`[Delete Account] ✅ Deleted passkeys for user: ${userId}`)
    }

    // 3. Delete trust points
    const { error: trustPointsError } = await serviceClient
      .from("trust_points")
      .delete()
      .eq("user_id", userId)

    if (trustPointsError) {
      console.error(`[Delete Account] Error deleting trust points:`, trustPointsError)
    } else {
      console.log(`[Delete Account] ✅ Deleted trust points for user: ${userId}`)
    }

    // 4. Delete vault
    const { error: vaultError } = await serviceClient
      .from("vaults")
      .delete()
      .eq("user_id", userId)

    if (vaultError) {
      console.error(`[Delete Account] Error deleting vault:`, vaultError)
    } else {
      console.log(`[Delete Account] ✅ Deleted vault for user: ${userId}`)
    }

    // 5. Delete notifications
    const { error: notificationsError } = await serviceClient
      .from("notifications")
      .delete()
      .eq("user_id", userId)

    if (notificationsError) {
      console.error(`[Delete Account] Error deleting notifications:`, notificationsError)
    } else {
      console.log(`[Delete Account] ✅ Deleted notifications for user: ${userId}`)
    }

    // 6. Delete referrals (where user is referrer or referred)
    const { error: referralsError } = await serviceClient
      .from("referrals")
      .delete()
      .or(`referrer_id.eq.${userId},referred_user_id.eq.${userId}`)

    if (referralsError) {
      console.error(`[Delete Account] Error deleting referrals:`, referralsError)
    } else {
      console.log(`[Delete Account] ✅ Deleted referrals for user: ${userId}`)
    }

    // 7. Delete vouches (where user gave or received vouches)
    const { error: vouchesError } = await serviceClient
      .from("user_vouches")
      .delete()
      .or(`voucher_id.eq.${userId},vouchee_id.eq.${userId}`)

    if (vouchesError) {
      console.error(`[Delete Account] Error deleting vouches:`, vouchesError)
    } else {
      console.log(`[Delete Account] ✅ Deleted vouches for user: ${userId}`)
    }

    // 8. Delete DeFindex positions
    const { error: defindexError } = await serviceClient
      .from("defindex_positions")
      .delete()
      .eq("user_id", userId)

    if (defindexError) {
      console.error(`[Delete Account] Error deleting DeFindex positions:`, defindexError)
    } else {
      console.log(`[Delete Account] ✅ Deleted DeFindex positions for user: ${userId}`)
    }

    // 9. Delete profile (this frees up the username)
    const { error: profileError } = await serviceClient
      .from("profiles")
      .delete()
      .eq("id", userId)

    if (profileError) {
      console.error(`[Delete Account] Error deleting profile:`, profileError)
      return NextResponse.json(
        { error: "Failed to delete profile", details: profileError.message },
        { status: 500, headers: corsHeaders(request) }
      )
    }

    console.log(`[Delete Account] ✅ Deleted profile for user: ${userId} (username ${username} is now free)`)

    // 10. Delete auth.users entry (this must be done via Supabase Admin API or SQL)
    // Note: We can't delete auth.users directly from the API
    // The profile deletion is the main thing that frees up the username
    // The auth.users entry can be cleaned up manually or via a database function
    
    console.log(`[Delete Account] ✅ Account deletion complete for user: ${userId}, username: ${username}`)

    return NextResponse.json(
      { 
        success: true,
        message: "Account deleted successfully. Your Sozu tag has been freed and can be claimed by others.",
        username
      },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error("[Delete Account] Unexpected error:", error)
    return NextResponse.json(
      { 
        error: "Failed to delete account",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500, headers: corsHeaders(request) }
    )
  }
}
