/**
 * Whether diagnostic / test API routes should respond.
 * Production stays closed unless ALLOW_DEBUG_ROUTES=true (staging may set this).
 */
export function debugRoutesEnabled(): boolean {
  if (process.env.ALLOW_DEBUG_ROUTES === "true") return true
  if (process.env.VERCEL_ENV === "preview") return true
  return process.env.NODE_ENV !== "production"
}
