import type { Transaction } from "@/hooks/use-wallet-data"
import { formatAddress } from "@/lib/wallet-utils"
import type { PaymentReceipt } from "@/lib/payment/payment-receipt"
import { getSenderDisplayLabel } from "@/lib/payment/payment-receipt"

function formatCounterpartyLabel(
  address: string,
  addressToTagMap: Record<string, string>,
): string {
  const tag = addressToTagMap[address]
  if (tag) return `$${tag.replace(/^\$+/, "")}`
  return formatAddress(address, 6, 6)
}

export function transactionToPaymentReceipt(
  tx: Transaction,
  walletAddress: string,
  walletNetwork: "testnet" | "mainnet",
  addressToTagMap: Record<string, string>,
): PaymentReceipt | null {
  const paymentOp = tx.operations.find((op) => op.type === "payment")
  if (!paymentOp) return null

  const isSent = paymentOp.from === walletAddress
  const otherAddress = isSent ? paymentOp.to : paymentOp.from
  const otherLabel = formatCounterpartyLabel(otherAddress, addressToTagMap)
  const selfLabel = getSenderDisplayLabel()

  return {
    amount: paymentOp.amount,
    currency: "USDC",
    fromLabel: isSent ? selfLabel : otherLabel,
    toLabel: isSent ? otherLabel : selfLabel,
    toAddress: isSent ? otherAddress : walletAddress,
    transactionHash: tx.hash,
    network: walletNetwork,
    memo: tx.memo ?? paymentOp.memo ?? null,
    completedAt: tx.createdAt,
  }
}
