import { updateSession } from "@/lib/supabase/middleware"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Browsing via http://0.0.0.0:PORT breaks WebAuthn (rpId invalid). Dev may bind 0.0.0.0 for Docker.
  if (request.nextUrl.hostname === "0.0.0.0") {
    const url = request.nextUrl.clone()
    url.hostname = "localhost"
    return NextResponse.redirect(url, 307)
  }

  // SDP fetches this from host.docker.internal / ngrok — must not redirect to /auth.
  if (pathname.startsWith("/.well-known")) {
    return NextResponse.next()
  }

  // /sdp/invite is a public entry point (sets invite cookie, then redirects to auth or register).
  if (pathname.startsWith("/sdp/invite")) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js (service worker)
     * - manifest.json (PWA manifest)
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
