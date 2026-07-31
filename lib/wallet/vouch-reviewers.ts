/**
 * Vouch review authorization — env UUID allowlist (fail closed).
 * Set VOUCH_REVIEWER_USER_IDS=uuid1,uuid2 on Staging/Production.
 */

export function getVouchReviewerIds(): string[] {
  return (process.env.VOUCH_REVIEWER_USER_IDS ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** True only when userId is explicitly listed. Empty allowlist → nobody. */
export function isVouchReviewer(userId: string): boolean {
  const ids = getVouchReviewerIds()
  if (ids.length === 0) return false
  return ids.includes(userId)
}
