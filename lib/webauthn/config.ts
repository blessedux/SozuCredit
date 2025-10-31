export const rpName = "MicroCredit Platform"
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
