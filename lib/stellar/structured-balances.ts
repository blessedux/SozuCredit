import { Horizon } from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"
import type { WalletBalanceRow } from "@/lib/ledger/types"

export async function fetchWalletBalancesFromHorizon(publicKey: string): Promise<WalletBalanceRow[]> {
  const stellarConfig = getStellarConfig()
  const server = new Horizon.Server(stellarConfig.horizonUrl, {
    allowHttp: stellarConfig.network === "testnet",
  })
  const account = await server.loadAccount(publicKey)
  const rows: WalletBalanceRow[] = []
  for (const b of account.balances as {
    asset_type: string
    asset_code?: string
    asset_issuer?: string
    balance: string
  }[]) {
    const code =
      b.asset_type === "native" ? "XLM" : (b.asset_code ?? b.asset_type)
    rows.push({
      domain: "wallet",
      assetCode: code,
      issuer: b.asset_issuer,
      amount: b.balance,
    })
  }
  return rows
}
