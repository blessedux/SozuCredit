import type { Transaction } from "@/hooks/use-wallet-data"
import { formatAddress } from "@/lib/wallet-utils"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import { getSenderDisplayLabel } from "@/lib/payment/payment-receipt"

export function transactionToPaymentReceipt(
  tx: Transaction,
  walletAddress: string,
  walletNetwork: "testnet" | "mainnet",
  addressToTagMap: Record<string, string>,
): PaymentReceipt | null {
  const paymentOp = tx.operations.find((op) => op.type === "payment")
  if (!paymentOp) return null

  const wallet = walletAddress.trim().toUpperCase()
  const from = paymentOp.from.trim().toUpperCase()
  const to = paymentOp.to.trim().toUpperCase()
  const isSent = from === wallet
  const otherAddress = isSent ? paymentOp.to : paymentOp.from
  const otherKey = otherAddress.trim().toUpperCase()
  const tag =
    addressToTagMap[otherKey] ??
    addressToTagMap[otherAddress] ??
    addressToTagMap[paymentOp.from] ??
    addressToTagMap[paymentOp.to]
  const otherLabel = tag
    ? `$${tag.replace(/^\$+/, "")}`
    : formatAddress(otherAddress, 6, 6)
  const selfLabel = getSenderDisplayLabel()

  return {
    amount: paymentOp.amount,
    currency: "USDC",
    fromLabel: isSent ? selfLabel : otherLabel,
    toLabel: isSent ? otherLabel : selfLabel,
    toAddress: isSent ? otherAddress : walletAddress.trim(),
    transactionHash: tx.hash,
    network: walletNetwork,
    memo: tx.memo ?? paymentOp.memo ?? null,
    completedAt: tx.createdAt,
  }
}
