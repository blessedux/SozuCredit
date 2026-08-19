"use client"

import { pizzaBalanceToShow } from "@/lib/stellar/pizza-token"
import { formatWalletText } from "@/lib/wallet-texts"
import { useWalletLanguage } from "@/lib/wallet-language"

export function PizzaBalanceRow({
  tokenBalances,
}: {
  tokenBalances?: Array<{
    assetId?: string
    symbol?: string
    balance: number
  }> | null
}) {
  const { t } = useWalletLanguage()
  const count = pizzaBalanceToShow(tokenBalances)
  if (count == null) return null

  return (
    <p
      className="mt-3 text-center text-sm tabular-nums text-white/70"
      data-testid="pizza-balance-row"
    >
      {formatWalletText(t.pizzaBalanceRow, { count: String(count) })}
    </p>
  )
}
