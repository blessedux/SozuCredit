export type InstitutionKind =
  | "bank"
  | "digital_wallet"
  | "payments_rail"
  | "card_network"
  | "merchant_platform"
  | "manual"
  | "unknown_email"

export type InstitutionInfo = {
  tag: string
  label: string
  kind: InstitutionKind
}

type Rule = { test: RegExp; tag: string; label: string; kind: InstitutionKind }

/** Order matters: first match wins (put specific domains before generic “banco”). */
const RULES: Rule[] = [
  { test: /\bmach\b|@mach\.|mach\.cl|\.mach\./i, tag: "mach", label: "Mach", kind: "digital_wallet" },
  { test: /tenpo|@tenpo/i, tag: "tenpo", label: "Tenpo", kind: "digital_wallet" },
  { test: /global\s*66|global66/i, tag: "global66", label: "Global66", kind: "digital_wallet" },
  { test: /mercado\s*pago|mercadopago|mercadolibre|@\w*mercadolibre/i, tag: "mercadopago", label: "Mercado Pago", kind: "merchant_platform" },
  { test: /\bflow\b|flow\.cl|@\w*\.flow\./i, tag: "flow", label: "Flow", kind: "payments_rail" },
  { test: /transbank|webpay|onepay/i, tag: "transbank", label: "Transbank / Webpay", kind: "payments_rail" },
  { test: /banco\s*estado|bancoestado|@\w*bancoestado/i, tag: "banco_estado", label: "BancoEstado", kind: "bank" },
  { test: /bci\b|banco\s*credito|bcicl/i, tag: "bci", label: "BCI", kind: "bank" },
  { test: /scotiabank|scotia\b/i, tag: "scotiabank", label: "Scotiabank", kind: "bank" },
  { test: /santander/i, tag: "santander", label: "Santander", kind: "bank" },
  { test: /itau/i, tag: "itau", label: "Itaú", kind: "bank" },
  { test: /security\b|banco\s*security/i, tag: "security", label: "Banco Security", kind: "bank" },
  { test: /consorcio/i, tag: "consorcio", label: "Consorcio", kind: "bank" },
  { test: /ripley\s*banco|banco\s*ripley/i, tag: "ripley", label: "Banco Ripley", kind: "bank" },
  { test: /falabella|cmr\b/i, tag: "falabella", label: "Falabella / CMR", kind: "bank" },
  { test: /paypal/i, tag: "paypal", label: "PayPal", kind: "payments_rail" },
  { test: /stripe/i, tag: "stripe", label: "Stripe", kind: "payments_rail" },
  { test: /apple\.com|icloud\.com/i, tag: "apple", label: "Apple", kind: "merchant_platform" },
  { test: /visa\b/i, tag: "visa", label: "Visa", kind: "card_network" },
  { test: /mastercard|master\s*card/i, tag: "mastercard", label: "Mastercard", kind: "card_network" },
  { test: /american\s*express|amex\b/i, tag: "amex", label: "American Express", kind: "card_network" },
  { test: /revolut/i, tag: "revolut", label: "Revolut", kind: "digital_wallet" },
  { test: /n26\b/i, tag: "n26", label: "N26", kind: "digital_wallet" },
  { test: /wise\.com|transferwise/i, tag: "wise", label: "Wise", kind: "digital_wallet" },
  { test: /\bbanco\b|banking\b|cuenta\b/i, tag: "bank_generic", label: "Banco (genérico)", kind: "bank" },
]

function shortenEmail(from: string): string {
  const s = from.trim()
  if (s.length <= 42) return s
  return `${s.slice(0, 39)}…`
}

export function deriveExpenseInstitution(input: {
  fromAddr?: string | null
  merchant?: string | null
  origin: "gmail" | "manual"
}): InstitutionInfo {
  if (input.origin === "manual") {
    return { tag: "manual", label: "Manual / app", kind: "manual" }
  }

  const hay = `${input.fromAddr ?? ""}\n${input.merchant ?? ""}`.toLowerCase()
  for (const r of RULES) {
    if (r.test.test(hay)) {
      return { tag: r.tag, label: r.label, kind: r.kind }
    }
  }

  const raw = input.fromAddr?.trim()
  if (raw) {
    const domain = raw.match(/@([\w.-]+\.[a-z]{2,})/i)?.[1]
    if (domain) {
      const d = domain.toLowerCase()
      return {
        tag: `email:${d}`,
        label: d,
        kind: "unknown_email",
      }
    }
    return { tag: "email_other", label: shortenEmail(raw), kind: "unknown_email" }
  }

  return { tag: "email_unknown", label: "Correo (sin remitente)", kind: "unknown_email" }
}

export type InstitutionSlice = {
  tag: string
  label: string
  kind: InstitutionKind
  amount: number
  count: number
  pct: number
}

export function aggregateExpenseInstitutions(
  rows: Array<{
    date: string
    amount: number
    currency: string
    type: string
    merchant: string | null
    source_email_id: string | null
    from_addr: string | null
  }>,
  windowTest: (dateIso: string) => boolean,
  primaryCurrency: string
): InstitutionSlice[] {
  const primary = primaryCurrency.toUpperCase()
  const bucket = new Map<string, { label: string; kind: InstitutionKind; amount: number; count: number }>()
  let total = 0

  for (const r of rows) {
    if (r.type !== "expense") continue
    if (r.currency.toUpperCase() !== primary) continue
    if (!windowTest(r.date)) continue

    const amt = Math.abs(r.amount)
    total += amt

    const origin = r.source_email_id ? ("gmail" as const) : ("manual" as const)
    const inst = deriveExpenseInstitution({
      fromAddr: r.from_addr,
      merchant: r.merchant,
      origin,
    })

    const prev = bucket.get(inst.tag) ?? {
      label: inst.label,
      kind: inst.kind,
      amount: 0,
      count: 0,
    }
    prev.amount += amt
    prev.count += 1
    prev.label = inst.label
    prev.kind = inst.kind
    bucket.set(inst.tag, prev)
  }

  const list: InstitutionSlice[] = [...bucket.entries()].map(([tag, v]) => ({
    tag,
    label: v.label,
    kind: v.kind,
    amount: v.amount,
    count: v.count,
    pct: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
  }))

  return list.sort((a, b) => b.amount - a.amount)
}
