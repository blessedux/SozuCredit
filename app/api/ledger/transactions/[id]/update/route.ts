import { after, NextResponse } from "next/server"
import { z } from "zod"
import { getApiUserClient } from "@/lib/ledger/supabase-admin"
import {
  merchantLegalKey,
  resolveMerchantLegalFromTx,
  trimDisplayName,
} from "@/lib/ledger/merchant-alias"
import {
  enrichLedgerTransactionRow,
  type LedgerTransactionRowInput,
} from "@/lib/ledger/map-ledger-transaction"

const updateSchema = z.object({
  merchant: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  card_last_four: z.union([z.string().regex(/^\d{4}$/), z.null()]).optional(),
  cardholder_name: z.union([z.string().max(120), z.null()]).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().min(3).max(8).optional(),
  type: z.enum(["income", "expense", "transfer", "refund", "unknown"]).optional(),
  category: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  date: z.string().datetime({ offset: true }).optional(),
  /** Hide from ledger UI / summaries (e.g. promo email misread as purchase). */
  dismissed: z.boolean().optional(),
  /** Clear with null. Income/refund only when set to an id. */
  source_vault_id: z.union([z.string().min(1), z.null()]).optional(),
  /**
   * When true, persist `merchant` as the display alias for the bank legal name on this receipt
   * (from `merchant_legal` or parsed `raw_text`), apply to other rows with the same legal name,
   * and use it for future Gmail imports.
   */
  remember_merchant_alias: z.boolean().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [ctx, { id }] = await Promise.all([getApiUserClient(request), params])
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data: existing, error: existingErr } = await ctx.db
    .from("ledger_transactions")
    .select("id, merchant, merchant_legal, raw_text, type, source_vault_id")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (existingErr) {
    return NextResponse.json({ error: existingErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const rememberAlias = parsed.data.remember_merchant_alias === true
  const legalForAlias = rememberAlias ? resolveMerchantLegalFromTx(existing) : null
  const displayForAlias =
    rememberAlias && legalForAlias
      ? parsed.data.merchant !== undefined
        ? trimDisplayName(parsed.data.merchant)
        : trimDisplayName(existing.merchant)
      : null
  const existingDisplay = trimDisplayName(existing.merchant)
  const shouldApplyAlias =
    rememberAlias &&
    Boolean(legalForAlias) &&
    Boolean(displayForAlias) &&
    displayForAlias !== existingDisplay

  const nextType = parsed.data.type ?? existing.type
  const vaultIdInput = parsed.data.source_vault_id
  if (vaultIdInput !== undefined && vaultIdInput !== null) {
    if (nextType !== "income" && nextType !== "refund") {
      return NextResponse.json(
        { error: "source_vault_id solo aplica a ingresos o reembolsos" },
        { status: 400 }
      )
    }
    const { data: vault, error: vErr } = await ctx.db
      .from("ledger_vaults")
      .select("id")
      .eq("id", vaultIdInput)
      .eq("user_id", ctx.userId)
      .maybeSingle()
    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }
    if (!vault) {
      return NextResponse.json({ error: "Vault no encontrado" }, { status: 400 })
    }
  }

  const patch: Record<string, unknown> = {}
  if (parsed.data.merchant !== undefined) patch.merchant = parsed.data.merchant
  if (parsed.data.note !== undefined) patch.note = parsed.data.note
  if (parsed.data.card_last_four !== undefined) patch.card_last_four = parsed.data.card_last_four
  if (parsed.data.cardholder_name !== undefined) patch.cardholder_name = parsed.data.cardholder_name
  if (parsed.data.amount != null) patch.amount = parsed.data.amount
  if (parsed.data.currency != null) patch.currency = parsed.data.currency.toUpperCase()
  if (parsed.data.type != null) patch.type = parsed.data.type
  if (parsed.data.category != null) patch.category = parsed.data.category
  if (parsed.data.confidence != null) patch.confidence = parsed.data.confidence
  if (parsed.data.date != null) patch.date = parsed.data.date
  if (parsed.data.dismissed === true) patch.dismissed_at = new Date().toISOString()
  if (parsed.data.dismissed === false) patch.dismissed_at = null
  if (parsed.data.source_vault_id !== undefined) {
    patch.source_vault_id = parsed.data.source_vault_id
  }

  if (nextType !== "income" && nextType !== "refund") {
    patch.source_vault_id = null
  }

  if (shouldApplyAlias && legalForAlias) {
    const prevLegal = existing.merchant_legal?.trim()
    patch.merchant_legal = prevLegal || legalForAlias
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data, error } = await ctx.db
    .from("ledger_transactions")
    .update(patch)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("*, ledger_vaults ( id, name ), email_sources ( from_addr )")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (shouldApplyAlias && legalForAlias && displayForAlias) {
    const key = merchantLegalKey(legalForAlias)
    const iso = new Date().toISOString()
    after(async () => {
      const [aliasRes, bulkRes, legacyRes] = await Promise.all([
        ctx.db.from("ledger_merchant_aliases").upsert(
          {
            user_id: ctx.userId,
            legal_key: key,
            display_name: displayForAlias,
            updated_at: iso,
          },
          { onConflict: "user_id,legal_key" }
        ),
        ctx.db
          .from("ledger_transactions")
          .update({ merchant: displayForAlias })
          .eq("user_id", ctx.userId)
          .eq("merchant_legal", legalForAlias),
        ctx.db
          .from("ledger_transactions")
          .update({ merchant: displayForAlias, merchant_legal: legalForAlias })
          .eq("user_id", ctx.userId)
          .is("merchant_legal", null)
          .eq("merchant", legalForAlias),
      ])

      if (aliasRes.error || bulkRes.error || legacyRes.error) {
        console.error("ledger alias propagation failed", {
          userId: ctx.userId,
          txId: id,
          legalKey: key,
          aliasError: aliasRes.error?.message ?? null,
          bulkError: bulkRes.error?.message ?? null,
          legacyError: legacyRes.error?.message ?? null,
        })
      }
    })
  }

  return NextResponse.json(enrichLedgerTransactionRow(data as LedgerTransactionRowInput))
}
