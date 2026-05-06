import { findLongestSubstringMatch } from "@/lib/ledger/category-rules-helpers"
import type { LedgerTransactionType } from "@/lib/ledger/types"
import { DEFAULT_CATEGORIES } from "@/lib/ledger/types"

export type BuiltinCategoryHint = {
  match_text: string
  category: (typeof DEFAULT_CATEGORIES)[number]
  type?: LedgerTransactionType
}

/**
 * Substring hints for purchase-confirmation style email/receipt text (Spanish/LatAm-heavy).
 * Longest match wins (see findLongestSubstringMatch). User-defined DB rules override these in sync.
 */
export const BUILTIN_CATEGORY_HINTS: readonly BuiltinCategoryHint[] = [
  // Groceries / food retail
  { match_text: "minimarket", category: "food", type: "expense" },
  { match_text: "mini market", category: "food", type: "expense" },
  { match_text: "minimercado", category: "food", type: "expense" },
  { match_text: "mini mercado", category: "food", type: "expense" },
  { match_text: "supermercado", category: "groceries", type: "expense" },
  { match_text: "hipermercado", category: "groceries", type: "expense" },
  { match_text: "jumbo", category: "groceries", type: "expense" },
  { match_text: "lider", category: "groceries", type: "expense" },
  { match_text: "líder", category: "groceries", type: "expense" },
  { match_text: "unimarc", category: "groceries", type: "expense" },
  { match_text: "santa isabel", category: "groceries", type: "expense" },
  { match_text: "tottus", category: "groceries", type: "expense" },
  { match_text: "cencosud", category: "groceries", type: "expense" },
  { match_text: "la polar", category: "groceries", type: "expense" },
  { match_text: "almacén", category: "groceries", type: "expense" },
  { match_text: "almacen", category: "groceries", type: "expense" },

  // Restaurants / delivery
  { match_text: "uber eats", category: "food", type: "expense" },
  { match_text: "ubereats", category: "food", type: "expense" },
  { match_text: "rappi", category: "food", type: "expense" },
  { match_text: "pedidosya", category: "food", type: "expense" },
  { match_text: "pedidos ya", category: "food", type: "expense" },
  { match_text: "ifood", category: "food", type: "expense" },
  { match_text: "i food", category: "food", type: "expense" },
  { match_text: "restaurante", category: "food", type: "expense" },
  { match_text: "restaurant", category: "food", type: "expense" },
  { match_text: "cafetería", category: "food", type: "expense" },
  { match_text: "cafeteria", category: "food", type: "expense" },
  { match_text: "café", category: "food", type: "expense" },
  { match_text: "cafe", category: "food", type: "expense" },
  { match_text: "panadería", category: "food", type: "expense" },
  { match_text: "panaderia", category: "food", type: "expense" },
  { match_text: "bar restaurant", category: "food", type: "expense" },

  // Health / pharmacy
  { match_text: "farmacia", category: "health", type: "expense" },
  { match_text: "pharmacy", category: "health", type: "expense" },
  { match_text: "droguería", category: "health", type: "expense" },
  { match_text: "drogueria", category: "health", type: "expense" },
  { match_text: "cruz verde", category: "health", type: "expense" },
  { match_text: "salcobrand", category: "health", type: "expense" },
  { match_text: "ahumada", category: "health", type: "expense" },
  { match_text: "farmacias", category: "health", type: "expense" },
  { match_text: "laboratorio clínico", category: "health", type: "expense" },
  { match_text: "laboratorio clinico", category: "health", type: "expense" },
  { match_text: "clínica", category: "health", type: "expense" },
  { match_text: "clinica", category: "health", type: "expense" },
  { match_text: "hospital", category: "health", type: "expense" },
  { match_text: "dentista", category: "health", type: "expense" },
  { match_text: "dental", category: "health", type: "expense" },
  { match_text: "copago", category: "health", type: "expense" },
  { match_text: "isapre", category: "health", type: "expense" },
  { match_text: "fonasa", category: "health", type: "expense" },

  // Transport
  { match_text: "transantiago", category: "transport", type: "expense" },
  { match_text: "metro de santiago", category: "transport", type: "expense" },
  { match_text: "tag ", category: "transport", type: "expense" },
  { match_text: " peaje", category: "transport", type: "expense" },
  { match_text: "peaje ", category: "transport", type: "expense" },
  { match_text: "uber ", category: "transport", type: "expense" },
  { match_text: "cabify", category: "transport", type: "expense" },
  { match_text: "didi", category: "transport", type: "expense" },
  { match_text: "shell ", category: "transport", type: "expense" },
  { match_text: " copec", category: "transport", type: "expense" },
  { match_text: "copec ", category: "transport", type: "expense" },
  { match_text: " esso", category: "transport", type: "expense" },
  { match_text: "combustible", category: "transport", type: "expense" },
  { match_text: "estacionamiento", category: "transport", type: "expense" },
  { match_text: "parking", category: "transport", type: "expense" },

  // Utilities / telco
  { match_text: "enel ", category: "utilities", type: "expense" },
  { match_text: "enel distribución", category: "utilities", type: "expense" },
  { match_text: "cge ", category: "utilities", type: "expense" },
  { match_text: "aguas andinas", category: "utilities", type: "expense" },
  { match_text: "aguas cordillera", category: "utilities", type: "expense" },
  { match_text: "aguas decant", category: "utilities", type: "expense" },
  { match_text: "gasco", category: "utilities", type: "expense" },
  { match_text: "lipigas", category: "utilities", type: "expense" },
  { match_text: "movistar", category: "utilities", type: "expense" },
  { match_text: "entel ", category: "utilities", type: "expense" },
  { match_text: " claro", category: "utilities", type: "expense" },
  { match_text: " wom ", category: "utilities", type: "expense" },
  { match_text: "wom ", category: "utilities", type: "expense" },
  { match_text: "vtr ", category: "utilities", type: "expense" },
  { match_text: " gtd", category: "utilities", type: "expense" },

  // Subscriptions / software (English + common brands)
  { match_text: "netflix", category: "subscriptions", type: "expense" },
  { match_text: "spotify", category: "subscriptions", type: "expense" },
  { match_text: "youtube premium", category: "subscriptions", type: "expense" },
  { match_text: "apple icloud", category: "subscriptions", type: "expense" },
  { match_text: "icloud", category: "subscriptions", type: "expense" },
  { match_text: "google one", category: "subscriptions", type: "expense" },
  { match_text: "amazon prime", category: "subscriptions", type: "expense" },
  { match_text: "prime video", category: "subscriptions", type: "expense" },
  { match_text: "disney+", category: "subscriptions", type: "expense" },
  { match_text: "disney plus", category: "subscriptions", type: "expense" },
  { match_text: "openai", category: "software", type: "expense" },
  { match_text: "cursor ", category: "software", type: "expense" },
  { match_text: "github", category: "software", type: "expense" },
  { match_text: "vercel", category: "software", type: "expense" },

  // Pets
  { match_text: "veterinaria", category: "pets", type: "expense" },
  { match_text: "vet ", category: "pets", type: "expense" },
  { match_text: "pet shop", category: "pets", type: "expense" },
  { match_text: "mascotas", category: "pets", type: "expense" },

  // Travel
  { match_text: "latam airlines", category: "travel", type: "expense" },
  { match_text: "sky airline", category: "travel", type: "expense" },
  { match_text: "jetsmart", category: "travel", type: "expense" },
  { match_text: "booking.com", category: "travel", type: "expense" },
  { match_text: "airbnb", category: "travel", type: "expense" },
  { match_text: "hotel ", category: "travel", type: "expense" },
  { match_text: "pasaje", category: "travel", type: "expense" },

  // Housing
  { match_text: "arriendo", category: "rent", type: "expense" },
  { match_text: " administración", category: "rent", type: "expense" },
  { match_text: "administracion", category: "rent", type: "expense" },
  { match_text: "common expenses", category: "rent", type: "expense" },

  // Debt / cards (often billing notices)
  { match_text: "tarjeta de crédito", category: "debt", type: "expense" },
  { match_text: "tarjeta de credito", category: "debt", type: "expense" },
  { match_text: "crédito hipotecario", category: "debt", type: "expense" },
  { match_text: "credito hipotecario", category: "debt", type: "expense" },
  { match_text: "cuota tarjeta", category: "debt", type: "expense" },

  // Business-ish (generic)
  { match_text: "cowork", category: "business", type: "expense" },
  { match_text: "servicios contables", category: "business", type: "expense" },

  // Transfers (weak signals — model should confirm)
  { match_text: "transferencia bancaria", category: "transfers", type: "transfer" },
  { match_text: "transferencia a", category: "transfers", type: "transfer" },
]

let cheatsheetCache: string | null = null

/** Compact grouped cheat sheet for LLM prompts (single source of truth with BUILTIN_CATEGORY_HINTS). */
export function getBuiltinCategoryHintsCheatsheet(): string {
  if (cheatsheetCache) return cheatsheetCache
  const byCat = new Map<string, string[]>()
  for (const h of BUILTIN_CATEGORY_HINTS) {
    const list = byCat.get(h.category) ?? []
    list.push(h.match_text.trim())
    byCat.set(h.category, list)
  }
  const lines = [...byCat.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, phrases]) => {
      const uniq = [...new Set(phrases)].slice(0, 14)
      const extra = phrases.length > 14 ? " …" : ""
      return `- ${cat}: ${uniq.join(", ")}${extra}`
    })
  cheatsheetCache = lines.join("\n")
  return cheatsheetCache
}

export function buildLedgerClassificationHaystack(input: {
  merchant?: string | null
  subject?: string | null
  snippet?: string | null
  rawText?: string | null
  fromAddr?: string | null
  cardLastFour?: string | null
  cardholderName?: string | null
}): string {
  return [
    input.merchant && String(input.merchant),
    input.subject && String(input.subject),
    input.snippet && String(input.snippet),
    input.rawText && String(input.rawText).slice(0, 6_000),
    input.fromAddr && String(input.fromAddr),
    input.cardLastFour && `card_last_four ${input.cardLastFour}`,
    input.cardholderName && `cardholder ${input.cardholderName}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export function matchBuiltinCategoryHint(haystack: string): BuiltinCategoryHint | null {
  return findLongestSubstringMatch(BUILTIN_CATEGORY_HINTS, haystack)
}
