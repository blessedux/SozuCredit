import { ledgerUserHeaders } from "@/lib/ledger/client-headers"

/** Same Stellar address as /wallet when stored after login. */
export function walletBalancesUrl(): string {
  if (typeof window === "undefined") return "/api/wallet/balances"
  const pk = sessionStorage.getItem("stellar_public_key")
  if (!pk) return "/api/wallet/balances"
  return `/api/wallet/balances?publicKey=${encodeURIComponent(pk)}`
}

export function walletBalancesFetchInit(): RequestInit {
  return { headers: ledgerUserHeaders() }
}
