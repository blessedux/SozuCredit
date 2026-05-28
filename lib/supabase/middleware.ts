import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { hasSupabaseAuthCookies } from "@/lib/supabase/authCookies"

export async function updateSession(request: NextRequest) {
  // CRITICAL: Check for allowed routes at the VERY START - before creating NextResponse
  // This ensures these routes are allowed before any other processing
  const pathname = request.nextUrl.pathname
  /** Ledger (cashflow) uses sessionStorage + x-user-id like /wallet; never require Supabase cookie. */
  const isLedgerRoute = pathname === "/ledger" || pathname.startsWith("/ledger/")

  // Allow test-keys route (for Phase 1 & 2 testing)
  if (pathname === "/test-keys") {
    console.log("[Middleware] ✅ /test-keys route detected - ALLOWING immediately")
    return NextResponse.next()
  }

  if (pathname === "/wallet" || pathname === "/home") {
    // Log immediately to verify this code path is being hit
    console.log(`[Middleware] ✅ ${pathname} route detected - ALLOWING immediately`)
    // Return immediately with a fresh NextResponse
    return NextResponse.next()
  }

  /** SDP disbursement UI uses sessionStorage + passkeys like /wallet; APIs enforce auth. */
  if (pathname.startsWith("/sdp/register")) {
    return NextResponse.next()
  }

  if (pathname === "/settings") {
    // Allow settings route - it handles its own auth via sessionStorage
    console.log("[Middleware] ✅ /settings route detected - ALLOWING immediately")
    return NextResponse.next()
  }

  if (isLedgerRoute) {
    return NextResponse.next()
  }

  // Allow /city (Urban Treasure map) without auth so we can test the map feature
  if (pathname.startsWith("/city")) {
    return NextResponse.next()
  }

  // Allow /tracker (Expense Tracker) without auth so we can test the UI
  if (pathname.startsWith("/tracker")) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // CRITICAL: Check routes FIRST before any Supabase calls
  // This prevents unnecessary Supabase client creation for routes that don't need it
  const isWalletRoute = pathname === "/wallet"
  const isHomeRoute = pathname === "/home"
  const isSdpRegisterRoute = pathname.startsWith("/sdp/register")
  const isSettingsRoute = pathname === "/settings"
  const isTestKeysRoute = pathname === "/test-keys"
  const isCityRoute = pathname.startsWith("/city")
  const isTrackerRoute = pathname.startsWith("/tracker")
  const isAuthRoute = pathname.startsWith("/auth")
  const isApiRoute = pathname.startsWith("/api")
  const isDevMode = process.env.NODE_ENV === "development"

  // Always allow test-keys route - it's a testing page that doesn't need auth
  if (isTestKeysRoute) {
    console.log("[Middleware] ✅ ALLOWING /test-keys route (testing page)")
    return supabaseResponse
  }

  // Always allow wallet route FIRST - it handles its own auth via sessionStorage
  // Skip all Supabase checks for wallet route (this is a backup check)
  if (isWalletRoute || isHomeRoute) {
    // Log in both dev and prod to verify it's being called
    console.log(`[Middleware] ✅ ALLOWING ${pathname} route immediately (handles own auth via sessionStorage)`)
    // Return immediately - no Supabase client creation needed
    return supabaseResponse
  }

  if (isSdpRegisterRoute) {
    return supabaseResponse
  }

  // Always allow settings route - it handles its own auth via sessionStorage
  if (isSettingsRoute) {
    console.log("[Middleware] ✅ ALLOWING /settings route immediately (handles own auth via sessionStorage)")
    return supabaseResponse
  }

  if (isLedgerRoute) {
    return supabaseResponse
  }

  // Don't redirect API routes - they handle their own authentication
  if (isApiRoute) {
    // Allow API routes to proceed without redirect
    return supabaseResponse
  }

  // Check if Supabase environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // In dev mode without Supabase, allow all routes (sessionStorage auth is checked client-side)
  if ((!supabaseUrl || !supabaseAnonKey) && isDevMode) {
    console.warn("⚠️  Supabase environment variables not set. Bypassing authentication in dev mode.")
    // Allow all routes in dev mode without Supabase - pages will check sessionStorage client-side
    return supabaseResponse
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    const missing = []
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL")
    if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    console.error(`[Middleware] Missing required environment variables: ${missing.join(", ")}`)
    console.error("[Middleware] Please set these in Vercel Dashboard → Settings → Environment Variables")

    throw new Error(
      `Missing Supabase environment variables: ${missing.join(", ")}. ` +
      "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Dashboard → Settings → Environment Variables."
    )
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Now check for user authentication (after allowing wallet/api routes)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if not authenticated and not on auth pages, wallet, settings, ledger, test-keys, city, tracker, or sdp/register
  if (
    !user &&
    !isAuthRoute &&
    request.nextUrl.pathname !== "/" &&
    !isWalletRoute &&
    !isHomeRoute &&
    !isSdpRegisterRoute &&
    !isSettingsRoute &&
    !isLedgerRoute &&
    !isTestKeysRoute &&
    !isCityRoute &&
    !isTrackerRoute
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth"
    return NextResponse.redirect(url)
  }

  // For auth pages: allow them even if user exists (let client handle redirect)
  // This prevents middleware from interfering with client-side navigation
  // Only redirect server-side if we have a valid Supabase session cookie
  if (user && isAuthRoute) {
    // Check if this is likely a sessionStorage-only auth (no Supabase session cookie)
    // If so, let the client handle the redirect to avoid refresh
    const hasSessionCookie = hasSupabaseAuthCookies(request)

    if (hasSessionCookie) {
      // SDP invite: Supabase cookie does not mean passkey wallet is in sessionStorage yet.
      if (request.nextUrl.searchParams.get("sdpInvite") === "1") {
        return supabaseResponse
      }
      const url = request.nextUrl.clone()
      url.pathname = "/wallet"
      return NextResponse.redirect(url)
    } else {
      // No Supabase session cookie - likely using sessionStorage auth
      // Let the client-side handle the redirect to preserve console logs and avoid refresh
      // Don't log this in production to avoid console spam
      if (isDevMode) {
        console.log("[Middleware] User authenticated but no session cookie, allowing client-side redirect")
      }
    }
  }

  return supabaseResponse
}
