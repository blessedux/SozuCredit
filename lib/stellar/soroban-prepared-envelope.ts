import { Transaction, xdr } from "@stellar/stellar-sdk"

/** Soroban resource/fees blob from a server-prepared envelope (needed after cloneFrom rebuild). */
export function extractSorobanDataXdr(
  envelopeXdr: string,
  networkPassphrase: string,
): string | null {
  try {
    const tx = new Transaction(envelopeXdr, networkPassphrase)
    const ext = tx.toEnvelope().v1().tx().ext()
    const sorobanData = ext.sorobanData()
    return sorobanData.toXDR("base64")
  } catch {
    return null
  }
}

export function parseSorobanDataXdr(sorobanDataXdr: string): xdr.SorobanTransactionData {
  return xdr.SorobanTransactionData.fromXDR(sorobanDataXdr, "base64")
}
