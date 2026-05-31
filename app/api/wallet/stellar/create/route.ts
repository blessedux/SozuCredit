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

    const clientPublicKey = typeof body?.publicKey === "string" ? body.publicKey.trim().toUpperCase() : null

    // Path 1: Client sends a public key → only smart accounts (C…) may be stored; G triggers factory provision.
    if (clientPublicKey && clientPublicKey.length > 0) {
      if (clientPublicKey.startsWith("C") && clientPublicKey.length !== 56) {
        return NextResponse.json(
          { error: "Invalid smart account address." },
          { status: 400, headers: corsHeaders(request as any) }
        )
      }
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

      // ── Profile username guard ─────────────────────────────────────────────
      // If the DB trigger handle_new_user() failed to set profiles.username,
      // the user won't be resolvable by tag. Fix it here before the wallet is
      // usable so every activated wallet is immediately payable.
      try {
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("username")
          .eq("id", userId)
          .maybeSingle()

        if (!profile?.username) {
          console.warn("[Stellar Wallet API] Profile has no username — attempting repair from auth metadata")
          // Fetch user metadata from Supabase Auth
          const { data: authUser } = await serviceClient.auth.admin.getUserById(userId)
          const metaUsername: string | undefined =
            authUser?.user?.user_metadata?.username ||
            authUser?.user?.user_metadata?.name

          if (metaUsername && typeof metaUsername === "string" && metaUsername.trim().length >= 3) {
            const cleanTag = metaUsername.trim()
            // Only set if not already taken by someone else
            const { data: conflict } = await serviceClient
              .from("profiles")
              .select("id")
              .eq("username", cleanTag)
              .neq("id", userId)
              .maybeSingle()

            if (!conflict) {
              const { error: repairErr } = await serviceClient
                .from("profiles")
                .upsert(
                  { id: userId, username: cleanTag, display_name: cleanTag },
                  { onConflict: "id" }
                )
              if (repairErr) {
                console.error("[Stellar Wallet API] Profile repair failed:", repairErr.message)
              } else {
                console.log("[Stellar Wallet API] ✅ Profile username repaired to:", cleanTag)
              }
            } else {
              console.warn("[Stellar Wallet API] Cannot repair — username already taken by another user:", cleanTag)
            }
          } else {
            console.warn("[Stellar Wallet API] No usable username in auth metadata for userId:", userId)
          }
        } else {
          console.log("[Stellar Wallet API] Profile username OK:", profile.username)
        }
      } catch (profileCheckErr: any) {
        // Non-fatal — wallet registration still proceeds
        console.error("[Stellar Wallet API] Profile username check error (non-fatal):", profileCheckErr?.message)
      }
      // ──────────────────────────────────────────────────────────────────────

      let publicKey = clientPublicKey.toUpperCase()
      let signerPublicKey: string | null =
        publicKey.startsWith("G") ? publicKey : null
      let smartAccountProvisioned = false

      const { data: existingWallet } = await serviceClient
        .from("stellar_wallets")
        .select("public_key, wallet_type")
        .eq("user_id", userId)
        .maybeSingle()

      const alreadyOz =
        existingWallet?.wallet_type === "oz" ||
        (typeof existingWallet?.public_key === "string" &&
          existingWallet.public_key.startsWith("C") &&
          existingWallet.wallet_type !== "factory")

      // Legacy G-only registration: provision factory C when configured (OZ is client-first via ensureSmartWallet).
      if (!alreadyOz && publicKey.startsWith("G")) {
        if (!process.env.SMART_ACCOUNT_FACTORY_ID?.trim()) {
          return NextResponse.json(
            {
              error:
                "Smart account required. Sign in again so the app can link your passkey wallet (C…).",
              code: "SMART_ACCOUNT_REQUIRED",
            },
            { status: 422, headers: corsHeaders(request as any) }
          )
        }
        try {
          const { provisionSmartWalletForSigner } = await import(
            "@/lib/stellar/smart-account-provision"
          )
          const provisioned = await provisionSmartWalletForSigner(publicKey)
          if (!("error" in provisioned)) {
            publicKey = provisioned.contractId
            signerPublicKey = provisioned.signerPublicKey
            smartAccountProvisioned = true
            console.log(
              "[Stellar Wallet API] ✅ Smart account provisioned:",
              publicKey.substring(0, 10) + "..."
            )
          } else {
            return NextResponse.json(
              { error: provisioned.error, code: "SMART_ACCOUNT_PROVISION_FAILED" },
              { status: 502, headers: corsHeaders(request as any) }
            )
          }
        } catch (provErr) {
          const msg = provErr instanceof Error ? provErr.message : String(provErr)
          return NextResponse.json(
            { error: msg, code: "SMART_ACCOUNT_PROVISION_FAILED" },
            { status: 502, headers: corsHeaders(request as any) }
          )
        }
      }

      if (publicKey.startsWith("G")) {
        return NextResponse.json(
          {
            error:
              "Only smart accounts (C…) are supported. Use passkey login to register your wallet.",
            code: "LEGACY_G_NOT_ALLOWED",
          },
          { status: 422, headers: corsHeaders(request as any) }
        )
      }

      const upsertRow: Record<string, string | null> = {
        user_id: userId,
        public_key: publicKey,
        signer_public_key: signerPublicKey,
        wallet_type: publicKey.startsWith("C") ? "oz" : null,
        turnkey_wallet_id: null,
        network: stellarConfig.network,
        updated_at: new Date().toISOString(),
      }

      let { data: updated, error } = await serviceClient
        .from("stellar_wallets")
        .upsert(upsertRow, { onConflict: "user_id" })
        .select()
        .single()

      if (error?.message?.includes("signer_public_key")) {
        const { signer_public_key: _s, ...withoutSigner } = upsertRow
        const retry = await serviceClient
          .from("stellar_wallets")
          .upsert(withoutSigner, { onConflict: "user_id" })
          .select()
          .single()
        updated = retry.data
        error = retry.error
      }

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
          signerPublicKey: signerPublicKey,
          smartAccountProvisioned,
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

