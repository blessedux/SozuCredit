/** Strip `$`, whitespace, and invalid chars from a Sozu tag input. */
export function normalizeSozuTag(raw: string): string {
  return raw.trim().replace(/^\$+/, "").replace(/[^a-zA-Z0-9_]/g, "")
}

export function isValidSozuTag(tag: string): boolean {
  return tag.length >= 3 && tag.length <= 30 && /^[a-zA-Z0-9_]+$/.test(tag)
}

export function formatSozuTagLabel(tag: string): string {
  const normalized = normalizeSozuTag(tag)
  return normalized ? `$${normalized}` : ""
}
