"use client"

import type { SmartAccountKit } from "smart-account-kit"
import type { xdr } from "@stellar/stellar-sdk"

export async function signSorobanEnvelopeWithPasskey(params: {
  kit: SmartAccountKit
  envelopeXdr: string
  networkPassphrase: string
  credentialId?: string | null
}): Promise<string> {
  const { Transaction, TransactionBuilder, Operation } = await import("@stellar/stellar-sdk")

  const tx = new Transaction(params.envelopeXdr, params.networkPassphrase)
  if (tx.operations.length !== 1) {
    throw new Error("Expected a single Soroban operation.")
  }

  const op = tx.operations[0]
  if (op.type !== "invokeHostFunction") {
    throw new Error("Expected invokeHostFunction operation.")
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
      })
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
      })
    )
    .setTimeout(60)
    .build()

  const prepared = await params.kit.rpc.prepareTransaction(rebuilt)
  return prepared.toEnvelope().toXDR("base64")
}
