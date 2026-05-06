import { deriveExpenseInstitution } from "@/lib/ledger/expense-institution"

export type LedgerTransactionRowInput = {
  source_email_id?: string | null
  merchant?: string | null
  email_sources?:
    | { from_addr: string | null }
    | { from_addr: string | null }[]
    | null
    | undefined
  ledger_vaults?:
    | { id?: string; name?: string | null }
    | { id?: string; name?: string | null }[]
    | null
    | undefined
} & Record<string, unknown>

/** Strip nested joins and attach display fields for API clients. */
export function enrichLedgerTransactionRow(row: LedgerTransactionRowInput) {
  const es = row.email_sources
  const fromAddr = Array.isArray(es) ? (es[0]?.from_addr ?? null) : (es?.from_addr ?? null)
  const origin = row.source_email_id ? ("gmail" as const) : ("manual" as const)
  const inst = deriveExpenseInstitution({
    fromAddr,
    merchant: row.merchant ?? null,
    origin,
  })
  const lv = row.ledger_vaults
  const vaultRow = Array.isArray(lv) ? lv[0] : lv
  const vaultName =
    vaultRow && typeof vaultRow === "object" && vaultRow !== null && "name" in vaultRow
      ? String((vaultRow as { name?: string }).name ?? "").trim() || null
      : null
  const originLabel = vaultName ?? inst.label
  const { email_sources: _e, ledger_vaults: _l, ...rest } = row
  return {
    ...rest,
    source: origin === "gmail" ? "gmail" : "manual",
    source_vault_name: vaultName,
    institution_tag: inst.tag,
    institution_label: originLabel,
    institution_kind: inst.kind,
  }
}
