import { redirect } from "next/navigation"

/** @deprecated Use `/ledger/vaults`. */
export default function LegacyMulticurrencyRedirect() {
  redirect("/ledger/vaults")
}
