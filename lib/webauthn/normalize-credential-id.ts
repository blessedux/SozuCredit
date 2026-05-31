export function normalizeCredentialId(id: string): string {
  return String(id).replace(/\s+/g, "").trim()
}
