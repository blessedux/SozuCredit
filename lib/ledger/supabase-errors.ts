/** Supabase/PostgREST errors when ledger tables are not migrated yet. */
export function isMissingLedgerTable(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message && !error?.code) return false
  const m = error.message ?? ""
  // PostgreSQL undefined_table only — do not use generic "does not exist" (matches undefined_column 42703, etc.).
  if (error.code === "42P01") return true
  // PostgREST: table not in schema cache.
  if (m.includes("Could not find the table") && m.includes("ledger")) return true
  return false
}
