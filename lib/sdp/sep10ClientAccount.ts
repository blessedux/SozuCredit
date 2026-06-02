import type { Transaction } from "@stellar/stellar-sdk";

/**
 * SEP-10 challenge txs use the anchor/server G as `transaction.source`.
 * The recipient wallet to sign with is the first ManageData operation's `source`.
 */
export function getSep10ClientAccountId(transaction: Transaction): string | null {
  const op = transaction.operations[0];
  if (op?.type === "manageData" && typeof op.source === "string") {
    const g = op.source.trim().toUpperCase();
    if (g.startsWith("G") && g.length === 56) return g;
  }
  return null;
}
