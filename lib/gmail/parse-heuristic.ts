import { extractStructuredReceiptFields } from "@/lib/gmail/parse-structured-receipt"

/**
 * Chile-issued bank / wallet / acquirer cues (subject + body + snippet). Used so `$ 22.000` is
 * treated as CLP (peso sign + thousands with dots), not USD — Mach, large banks, and Mercado Pago
 * Chile denominate in CLP even when the email never says "CLP".
 */
export function chileFinancialEmailContext(combinedText: string): boolean {
  const t = combinedText.replace(/\s+/g, " ")
  return (
    /\bclp\b/i.test(t) ||
    /\brecib(?:iste|imos)\b/i.test(t) ||
    /\b(?:mach|banco\s*(?:de\s*)?chile|bancochile|bci\b|banco\s+bci|santander|banco\s+santander|mercado\s*pago|mercadopago|banco\s*estado|bancoestado|scotiabank|tenpo|cmr\b|ripley|falabella|consorcio|it[\u00fa]u\s*chile|global\s*66|banco\s*security|los\s+h[eé]roes|prepago|cuenta\s+rut|notificaci[oó]n\s+bancaria|comprobante\s+de\s+pago|detalle\s+comercio|tarjeta\s+de\s+cr[eé]dito|tarjeta\s+de\s+d[eé]bito|webpay|transbank|khipu|servipag|redcompra|multicaja|\.cl\b)\b/i.test(
      t
    )
  )
}

/** `22.000` / `1.234.567` / `1.234,56` — Chile-style grouping, not a US decimal like `22.00`. */
function amountTokenLooksChileanPesoGrouping(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return true
  if (/^\d{1,3}(\.\d{3})+\.\d{2}$/.test(s)) return false
  return false
}

/** Prefer dotted `$ 45.000` over FX-ish `$ …` lines when scanning left→right (tipo de cambio footers). */
function pickBestPesoTokenAfterDollar(text: string): string | null {
  const re = /\$\s*([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]+)?|\d{1,8})\b/g
  let firstGrouped: string | null = null
  let firstLargeBare: string | null = null
  let firstSmall: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim()
    if (!firstGrouped && amountTokenLooksChileanPesoGrouping(raw)) firstGrouped = raw
    if (!firstLargeBare && /^\d{4,8}$/.test(raw)) firstLargeBare = raw
    if (!firstSmall && /^\d{1,5}$/.test(raw) && !raw.includes(".") && !raw.includes(",")) firstSmall = raw
  }
  return firstGrouped ?? firstLargeBare ?? firstSmall
}

/**
 * Very small amount/currency guesser for receipts (MVP). Not a replacement for LLM parsing.
 * When the body matches Chile-style "Detalle Comercio …", fills merchant + card metadata.
 */
export function parseHeuristicReceipt(combinedText: string): {
  amount: number | null
  currency: string
  type: "expense" | "income" | "unknown"
  merchant: string | null
  confidence: number
  card_last_four: string | null
  cardholder_name: string | null
} {
  const structured = extractStructuredReceiptFields(combinedText)
  const t = combinedText.replace(/\s+/g, " ")
  const chileCtx = chileFinancialEmailContext(t)

  let currency = "CLP"
  if (/\bARS\b/i.test(t)) currency = "ARS"
  else if (/\bUSDC\b/i.test(t)) currency = "USDC"
  /* USD/EUR only from explicit amount+code patterns below (not loose "USD" in disclaimers). */

  /** Payroll / deposits often include "pago" (e.g. pago de remuneraciones) — classify income signals first. */
  const incomeSignals =
    /\b(recibiste|recibimos|deposito|depósito|deposit\b|ingreso|ingresaron|abono|abonamos|acredit|acreditación|acreditado|acreditamos|transferencia\s+entrante|transferencia\s+recibida|te\s+(?:han|hemos)\s+transferido|remuneraciones|remuneración|nómina|nomina|haberes|liquidación\s+de\s+sueldos?|credit\s+to\s+your\s+account|has\s+been\s+credited)\b/i
  const expenseSignals =
    /\b(compra|cargo|débito|debito|factura|detalle\s+comercio|boleta\s+tributaria|pago\s+con\s+tarjeta|comprobante\s+de\s+pago\s+.*detalle\s+comercio)\b/i
  const looseExpense =
    /\b(compra|pago|cargo|débito|debito|factura|boleta)\b/i.test(t) && !incomeSignals.test(t)

  let type: "expense" | "income" | "unknown"
  if (incomeSignals.test(t)) type = "income"
  else if (expenseSignals.test(t) || looseExpense) type = "expense"
  else type = "unknown"

  let amount: number | null = null
  let confidence = 0.35

  const tryParse = (raw: string, cur: string) => {
    const s = raw.trim()
    if (!s) return null
    if (cur === "CLP" || cur === "ARS") {
      if (s.includes(",")) {
        const n = Number(s.replace(/\./g, "").replace(",", "."))
        return Number.isFinite(n) ? n : null
      }
      const n = Number(s.replace(/\./g, ""))
      return Number.isFinite(n) ? n : null
    }
    const n = Number(s.replace(/,/g, ""))
    return Number.isFinite(n) ? n : null
  }

  /** `$ 15.000`-style grouping is overwhelmingly CLP even when the bank name is missing from the snippet. */
  const hasChilePesoAmountSyntax = /\$\s*\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/.test(t)
  const chileMoneyCue = chileCtx || !!structured.commerce || expenseSignals.test(t) || hasChilePesoAmountSyntax

  const clp = /([\d][\d.,]*)\s*CLP/i.exec(t)
  if (clp) {
    amount = tryParse(clp[1], "CLP")
    currency = "CLP"
    confidence = 0.55
  } else {
    const ars = /([\d][\d.,]*)\s*ARS/i.exec(t)
    if (ars) {
      amount = tryParse(ars[1], "ARS")
      currency = "ARS"
      confidence = 0.55
    } else {
      /**
       * Prefer Chile `$` / Monto lines before USD/EUR so tipo de cambio footers (`950 USD`) don't steal the amount,
       * and tokens like `45.000 USD` parse as CLP (peso grouping), not fractional USD.
       */
      let pesoToken: string | null = null
      if (chileMoneyCue) {
        pesoToken = pickBestPesoTokenAfterDollar(t)
        if (!pesoToken) {
          const montoBare =
            /\bMonto\s*(?:\([^)]{0,48}\)\s*)?([\d]{1,3}(?:\.[\d]{3})+(?:,[\d]+)?)\b/i.exec(t)
          if (montoBare?.[1] && amountTokenLooksChileanPesoGrouping(montoBare[1])) {
            pesoToken = montoBare[1]
          }
        }
      }

      if (pesoToken && chileMoneyCue) {
        const rawPeso = pesoToken.trim()
        const barePesoInteger =
          Boolean(rawPeso) &&
          !rawPeso.includes(".") &&
          !rawPeso.includes(",") &&
          /^\d{4,8}$/.test(rawPeso)
        if (
          amountTokenLooksChileanPesoGrouping(rawPeso) ||
          /^\d{1,5}$/.test(rawPeso) ||
          barePesoInteger ||
          type === "income" ||
          /\b(depósito|deposito|acredit|abono|transferencia\s+recibida|cuenta\s+corriente|cuenta\s+rut)\b/i.test(t)
        ) {
          amount = tryParse(rawPeso, "CLP")
          currency = "CLP"
          confidence = 0.52
        }
      }

      if (amount === null) {
        const usdStrict =
          /\$\s*([\d][\d.,]*)\s*(USD|US\$)\b/i.exec(t) || /\bUS\$\s*([\d][\d.,]*)\b/i.exec(t)
        const usdLoose = /\b([\d][\d.,]*)\s*USD\b/i.exec(t)
        const usdExplicit = usdStrict ?? (!chileMoneyCue ? usdLoose : null)
        const eurExplicit =
          /\b([\d][\d.,]*)\s*EUR\b/i.exec(t) || /\bEUR\s*([\d][\d.,]*)\b/i.exec(t)

        const assignUsdOrGroupedClp = (raw: string) => {
          const trimmed = raw.trim()
          if (amountTokenLooksChileanPesoGrouping(trimmed)) {
            amount = tryParse(trimmed, "CLP")
            currency = "CLP"
            confidence = 0.52
          } else {
            amount = tryParse(trimmed, "USD")
            currency = "USD"
            confidence = 0.5
          }
        }
        const assignEurOrGroupedClp = (raw: string) => {
          const trimmed = raw.trim()
          if (amountTokenLooksChileanPesoGrouping(trimmed)) {
            amount = tryParse(trimmed, "CLP")
            currency = "CLP"
            confidence = 0.52
          } else {
            amount = tryParse(trimmed, "EUR")
            currency = "EUR"
            confidence = 0.5
          }
        }

        if (usdExplicit) {
          assignUsdOrGroupedClp(usdExplicit[1])
        } else if (eurExplicit) {
          assignEurOrGroupedClp(eurExplicit[1])
        }
      }
    }
  }

  if (amount !== null && (amount <= 0 || amount > 1e12)) {
    amount = null
    confidence = 0.2
  }

  if (structured.commerce) {
    confidence = Math.min(0.94, confidence + 0.14)
  } else if (/\bcomprobante\s+de\s+pago\b/i.test(combinedText)) {
    confidence = Math.min(0.9, confidence + 0.06)
  }

  return {
    amount,
    currency,
    type: type === "unknown" ? "expense" : type,
    merchant: structured.commerce,
    confidence,
    card_last_four: structured.card_last_four,
    cardholder_name: structured.cardholder_name,
  }
}
