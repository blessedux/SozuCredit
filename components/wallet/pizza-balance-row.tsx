"use client"

import { pizzaBalanceToShow } from "@/lib/stellar/pizza-token"
import { formatWalletText } from "@/lib/wallet-texts"
import { useWalletLanguage } from "@/lib/wallet-language"

export function PizzaBalanceRow({
  tokenBalances,
  onSend,
}: {
  tokenBalances?: Array<{
    assetId?: string
    symbol?: string
    balance: number
  }> | null
  onSend?: () => void
}) {
  const { t } = useWalletLanguage()
  const count = pizzaBalanceToShow(tokenBalances)
  if (count == null) return null

  const label = formatWalletText(t.pizzaBalanceRow, { count: String(count) })

  if (onSend) {
    return (
      <button
        type="button"
        onClick={onSend}
        className="mt-3 text-center text-sm tabular-nums text-white/70 underline-offset-4 hover:text-white hover:underline"
        data-testid="pizza-balance-row"
      >
        {label}
      </button>
    )
  }

  return (
    <p
      className="mt-3 text-center text-sm tabular-nums text-white/70"
      data-testid="pizza-balance-row"
    >
      {label}
    </p>
  )
}
