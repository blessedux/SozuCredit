import type { NextRequest } from "next/server"

/**
 * True if the request carries Supabase SSR session cookies (@supabase/ssr).
 * Uses names like `sb-<project-ref>-auth-token` and chunked `...auth-token.0`.
 * Do not use legacy `sb-access-token` — createServerClient does not set those.
 */
export function hasSupabaseAuthCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) =>
    /^sb-.+-auth-token(\.[0-9]+)?$/.test(name),
  )
}
