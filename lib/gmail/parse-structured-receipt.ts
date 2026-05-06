/**
 * Extracts structured fields from common Chile bank/card receipt emails
 * ("Comprobante de pago", Detalle Comercio, últimos 4 dígitos, nombre en tarjeta).
 * Works on subject + snippet + plain body combined text.
 *
 * Currency and amount normalization for Chile live in `parse-heuristic.ts` (CLP-first, `$` = peso).
 */
export type StructuredReceiptFields = {
  commerce: string | null
  card_last_four: string | null
  cardholder_name: string | null
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

/**
 * Commerce name after "Detalle Comercio" up to the next "Monto" segment.
 * Example: `Comprobante de pago Detalle Comercio ZIGZABOO Monto (moneda original)` → ZIGZABOO
 */
function extractCommerce(text: string): string | null {
  const flat = collapseSpaces(text.replace(/\s+/g, " "))
  let m = /Detalle\s+Comercio\s*[:\s]*\s*(.+?)(?=\s+Monto\b)/i.exec(flat)
  if (!m?.[1]) {
    m = /Detalle\s+Comercio\s*[:\s]*\s*(.+?)(?=\s+Tarjeta\b|\s+Últimos\b|\s+Ultimos\b|\s+Nombre\s+en\s+tarjeta\b|$)/i.exec(
      flat
    )
  }
  if (!m?.[1]) {
    m = /Detalle\s+Comercio\s*[:\s]*\s*([^\n\r]+)/i.exec(text)
  }
  if (!m?.[1]) return null
  const v = collapseSpaces(m[1].replace(/^[\s:.-]+/, ""))
  if (!v || v.length < 2) return null
  return v.slice(0, 200)
}

/** e.g. `Últimos 4 dígitos de la tarjeta 2937` */
function extractCardLastFour(text: string): string | null {
  const m =
    /Últimos\s*4\s*d[ií]gitos?\s+de\s+la\s*tarjeta\s*[:\s]*(\d{4})\b/i.exec(text) ||
    /Ultimos\s*4\s*digitos?\s+de\s+la\s*tarjeta\s*[:\s]*(\d{4})\b/i.exec(text)
  return m?.[1] ?? null
}

/** e.g. `Nombre en tarjeta JOAQUÍN IGNACIO FARFÁN....` — stops before common next labels. */
function extractCardholderName(text: string): string | null {
  const m =
    /Nombre\s+en\s+tarjeta\s*[:\s]*([\s\S]+?)(?=\s*(?:Fecha|Hora|Comprobante|Detalle\s+Comercio|Monto|Tarjeta|Últimos|Ultimos|Número|Numero)\b|$)/i.exec(
      text
    )
  if (!m?.[1]) return null
  const v = collapseSpaces(m[1].replace(/\.+$/g, "").trim())
  if (!v || v.length < 2) return null
  return v.slice(0, 120)
}

export function extractStructuredReceiptFields(text: string): StructuredReceiptFields {
  if (!text?.trim()) {
    return { commerce: null, card_last_four: null, cardholder_name: null }
  }
  return {
    commerce: extractCommerce(text),
    card_last_four: extractCardLastFour(text),
    cardholder_name: extractCardholderName(text),
  }
}
