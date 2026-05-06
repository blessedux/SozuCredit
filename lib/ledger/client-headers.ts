/** Headers for ledger APIs in dev (passkey session stores UUID in `dev_username`). */
export function ledgerUserHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const uid = sessionStorage.getItem("dev_username")
  return uid ? { "x-user-id": uid } : {}
}
