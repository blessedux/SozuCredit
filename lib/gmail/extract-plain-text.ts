/**
 * Strip HTML to approximate plain text (receipt keywords, "Detalle Comercio", etc.).
 * Used for Gmail payloads and for backfilling rows where `raw_text` still contains HTML.
 */
export function approxPlainTextFromEmailHtml(html: string): string {
  const s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|tr|td|li|h[1-6]|table|thead|tbody)(\s[^>]*)?>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim()
}

/** If stored body looks like HTML, normalize it so heuristics can run. */
export function normalizeStoredEmailBodyText(stored: string | null | undefined): string {
  const t = (stored ?? "").trim()
  if (!t) return ""
  if (/<(html|body|table|div|p|span)\b/i.test(t)) {
    return approxPlainTextFromEmailHtml(t)
  }
  return t
}

/**
 * Pull best-effort plain text from Gmail API `users.messages.get` payload.
 * Includes `text/html` stripped to text — many bank receipts are HTML-only, and
 * fields like "Detalle Comercio …" only appear there.
 */
export function extractPlainTextFromGmailPayload(payload: {
  mimeType?: string
  body?: { data?: string }
  parts?: unknown[]
}): string {
  const chunks: string[] = []

  function decode(data: string) {
    try {
      const normalized = data.replace(/-/g, "+").replace(/_/g, "/")
      return Buffer.from(normalized, "base64").toString("utf8")
    } catch {
      return ""
    }
  }

  function walk(part: unknown) {
    if (!part || typeof part !== "object") return
    const p = part as {
      mimeType?: string
      body?: { data?: string }
      parts?: unknown[]
    }
    if (p.mimeType === "text/plain" && p.body?.data) {
      const t = decode(p.body.data)
      if (t) chunks.push(t)
    }
    if (p.mimeType === "text/html" && p.body?.data) {
      const raw = decode(p.body.data)
      const t = approxPlainTextFromEmailHtml(raw)
      if (t) chunks.push(t)
    }
    if (Array.isArray(p.parts)) {
      for (const c of p.parts) walk(c)
    }
  }

  walk(payload)
  return chunks.join("\n\n").trim()
}

export function getHeader(
  headers: { name?: string; value?: string }[] | undefined,
  name: string
): string | null {
  if (!headers) return null
  const h = headers.find((x) => (x.name || "").toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}
