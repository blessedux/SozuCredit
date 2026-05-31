"use client"

import type { SmartAccountKit } from "smart-account-kit"
import type { xdr } from "@stellar/stellar-sdk"

/**
 * Sign Soroban USDC transfer auth entries for a passkey smart account (C).
 *
 * The prepared transaction must use a classic G address as `source` (fee payer).
 * The C smart account only appears in the token transfer args + auth entries.
 */
export async function signSorobanPreparedTxWithPasskey(params: {
  kit: SmartAccountKit
  unsignedXdr: string
  networkPassphrase: string
  credentialId?: string | null
}): Promise<string> {
  const { TransactionBuilder, Operation, Transaction } = await import("@stellar/stellar-sdk")

  const parsed = TransactionBuilder.fromXDR(params.unsignedXdr, params.networkPassphrase)
  if (!(parsed instanceof Transaction)) {
    throw new Error("Fee bump transactions are not supported")
  }
  const tx = parsed

  if (tx.operations.length !== 1) {
    throw new Error("Expected a single Soroban operation.")
  }

  const op = tx.operations[0]
  if (op.type !== "invokeHostFunction") {
    throw new Error("Expected invokeHostFunction operation.")
  }

  if (!tx.source.startsWith("G")) {
    throw new Error(
      "Invalid prepared transaction: fee payer must be a classic G address, not a C smart account.",
    )
  }

  const invokeOp = op as {
    type: "invokeHostFunction"
    func: xdr.HostFunction
    auth?: xdr.SorobanAuthorizationEntry[]
  }
  const authEntries = invokeOp.auth ?? []
  const signedAuth = []
  for (const entry of authEntries) {
    signedAuth.push(
      await params.kit.signAuthEntry(entry, {
        credentialId: params.credentialId ?? undefined,
      }),
    )
  }

  const sourceAccount = await params.kit.rpc.getAccount(tx.source)
  const rebuilt = new TransactionBuilder(sourceAccount, {
    fee: tx.fee,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: invokeOp.func,
        auth: signedAuth,
      }),
    )
    .setTimeout(60)
    .build()

  const prepared = await params.kit.rpc.prepareTransaction(rebuilt)
  return prepared.toEnvelope().toXDR("base64")
}

/** @deprecated Use signSorobanPreparedTxWithPasskey with unsignedXdr from buildSorobanUsdcTransferXdr */
export async function signSorobanEnvelopeWithPasskey(params: {
  kit: SmartAccountKit
  envelopeXdr: string
  networkPassphrase: string
  credentialId?: string | null
}): Promise<string> {
  return signSorobanPreparedTxWithPasskey({
    kit: params.kit,
    unsignedXdr: params.envelopeXdr,
    networkPassphrase: params.networkPassphrase,
    credentialId: params.credentialId,
  })
}
