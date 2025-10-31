import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * CORS headers for API routes
 * Allows requests from the Vercel deployment domain and localhost
 */
export function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin")
  
  // Allow requests from:
  // - Same origin (no origin header)
  // - Vercel deployments (*.vercel.app, *.vercel.app/*)
  // - Localhost (development)
  const allowedOrigins = [
    /^https:\/\/.*\.vercel\.app$/,
    /^http:\/\/localhost:\d+$/,
    /^https:\/\/localhost:\d+$/,
  ]

  const isAllowedOrigin = !origin || allowedOrigins.some((pattern) => pattern.test(origin))

  return {
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin || "*" : "https://your-app.vercel.app",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  }
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOPTIONS(request: NextRequest) {
  const headers = corsHeaders(request)
  return new NextResponse(null, {
    status: 200,
    headers,
  })
}

