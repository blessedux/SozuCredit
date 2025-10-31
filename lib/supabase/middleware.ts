import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  // CRITICAL: Check for wallet route at the VERY START - before creating NextResponse
  // This ensures /wallet is allowed before any other processing
  const pathname = request.nextUrl.pathname
  
  if (pathname === "/wallet") {
    // Log immediately to verify this code path is being hit
    console.log("[Middleware] ✅ /wallet route detected - ALLOWING immediately")
    // Return immediately with a fresh NextResponse
    return NextResponse.next()
  }
  
  let supabaseResponse = NextResponse.next({
    request,
  })

  // CRITICAL: Check routes FIRST before any Supabase calls
  // This prevents unnecessary Supabase client creation for routes that don't need it
  const isWalletRoute = pathname === "/wallet"
  const isAuthRoute = pathname.startsWith("/auth")
  const isApiRoute = pathname.startsWith("/api")
  const isDevMode = process.env.NODE_ENV === "development"
  
  // Always allow wallet route FIRST - it handles its own auth via sessionStorage
  // Skip all Supabase checks for wallet route (this is a backup check)
  if (isWalletRoute) {
    // Log in both dev and prod to verify it's being called
    console.log("[Middleware] ✅ ALLOWING /wallet route immediately (handles own auth via sessionStorage)")
    // Return immediately - no Supabase client creation needed
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
    throw new Error(
      "Your project's URL and Key are required to create a Supabase client!\n\n" +
      "Check your Supabase project's API settings to find these values:\n" +
      "https://supabase.com/dashboard/project/_/settings/api"
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
  
  // Redirect to login if not authenticated and not on auth pages or wallet
  if (!user && !isAuthRoute && request.nextUrl.pathname !== "/" && !isWalletRoute) {
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
    const hasSessionCookie = request.cookies.has("sb-access-token") || request.cookies.has("sb-refresh-token")
    
    if (hasSessionCookie) {
      // We have a Supabase session cookie, safe to redirect server-side
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
