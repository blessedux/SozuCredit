export const rpName = "MicroCredit Platform"

// Get rpID - use environment variable or detect from request
// For server-side, we need to get it from the request or environment
export function getRpID(request?: Request): string {
  // If we have a request, try to get it from the Origin header
  if (request) {
    try {
      const origin = request.headers.get("origin")
      if (origin) {
        const url = new URL(origin)
        return url.hostname
      }
    } catch {
      // Fall through to defaults
    }
  }
  
  // Check environment variable for production
  if (process.env.NEXT_PUBLIC_RP_ID) {
    return process.env.NEXT_PUBLIC_RP_ID
  }
  
  // Client-side
  if (typeof window !== "undefined") {
    return window.location.hostname
  }
  
  // Default fallback
  return "localhost"
}

// Default export for backwards compatibility (uses localhost if called server-side without request)
export const rpID = typeof window !== "undefined" ? window.location.hostname : "localhost"
export const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"

export const challengeStore = new Map<string, { challenge: string; timestamp: number }>()

// Clean up old challenges (older than 5 minutes)
export function cleanupChallenges() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  for (const [key, value] of challengeStore.entries()) {
    if (value.timestamp < fiveMinutesAgo) {
      challengeStore.delete(key)
    }
  }
}
