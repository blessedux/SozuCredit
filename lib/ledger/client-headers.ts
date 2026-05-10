import { getUserId } from "@/lib/wallet-utils"

/** Headers for ledger APIs (same session identity as /wallet via `dev_username`). */
export function ledgerUserHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const uid = getUserId()
  return uid ? { "x-user-id": uid } : {}
}
