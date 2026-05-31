"use client"

import type { Transaction, xdr } from "@stellar/stellar-sdk"

/**
 * Passkey approval only (no transaction.sign) — used before Soroban authorizeEntry.
 */
async function assertPasskeyForSorobanSend(params: {
  unsignedXdr: string
  networkPassphrase: string
  userId: string
  credentialId: string
}): Promise<void> {
  const { TransactionBuilder, Transaction } = await import("@stellar/stellar-sdk")

  const tx = TransactionBuilder.fromXDR(params.unsignedXdr, params.networkPassphrase)
  if (!(tx instanceof Transaction)) {
    throw new Error("Invalid prepared transaction")
  }
  const transactionHash = tx.hash().toString("hex")

  const challengeResponse = await fetch("/api/wallet/stellar/signing-challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactionHash,
      userId: params.userId,
    }),
  })

  if (!challengeResponse.ok) {
    const error = await challengeResponse.json().catch(() => ({}))
    throw new Error(
      (error as { error?: string }).error || "Failed to generate signing challenge",
    )
  }

  const challengeData = await challengeResponse.json()
  const { getPasskeyForTransaction } = await import("@/lib/turnkey/passkeys")
  const credential = await getPasskeyForTransaction({
    challenge: challengeData.challenge,
    rpId: challengeData.rpId,
    rp: challengeData.rp,
    allowCredentials: challengeData.allowCredentials,
    timeout: challengeData.timeout,
    userVerification: challengeData.userVerification,
  })

  if (!credential) {
    throw new Error(
      "Payment cancelled. Approve the transfer with your passkey to continue.",
    )
  }

  const verifyResponse = await fetch("/api/wallet/stellar/verify-assertion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      transactionHash,
      userId: params.userId,
      challenge: challengeData.challenge,
    }),
  })

  if (!verifyResponse.ok) {
    const error = await verifyResponse.json().catch(() => ({}))
    throw new Error((error as { error?: string }).error || "Passkey verification failed")
  }

  const verifyResult = await verifyResponse.json()
  if (!verifyResult.success || !verifyResult.verified) {
    throw new Error("Passkey verification failed. Please try again.")
  }
}

/**
 * Sign a prepared Soroban USDC transfer using the passkey-derived G signer.
 * Works with factory smart accounts; does not call get_context_rules on the C contract.
 */
export async function signSorobanUsdcWithGSigner(params: {
  unsignedXdr: string
  signerPublicKey: string
  credentialId: string
  userId: string
  networkPassphrase: string
}): Promise<string> {
  const {
    TransactionBuilder,
    Operation,
    authorizeEntry,
    rpc,
    Transaction,
  } = await import("@stellar/stellar-sdk")

  const signer = params.signerPublicKey.trim().toUpperCase()
  if (!signer.startsWith("G") || signer.length !== 56) {
    throw new Error("Signer must be a classic G address.")
  }

  const parsed = TransactionBuilder.fromXDR(params.unsignedXdr, params.networkPassphrase)
  if (!(parsed instanceof Transaction)) {
    throw new Error("Fee bump transactions are not supported")
  }
  if (parsed.source !== signer) {
    throw new Error(
      `Transaction source mismatch. Expected ${signer.slice(0, 8)}…, got ${parsed.source.slice(0, 8)}…`,
    )
  }

  await assertPasskeyForSorobanSend({
    unsignedXdr: params.unsignedXdr,
    networkPassphrase: params.networkPassphrase,
    userId: params.userId,
    credentialId: params.credentialId,
  })

  const { retrieveKeypair } = await import("@/lib/storage/browser-keys")
  const keypair = await retrieveKeypair(params.credentialId, params.userId)
  if (!keypair || keypair.publicKey() !== signer) {
    throw new Error("Signer key not found. Sign out and sign in again with your passkey.")
  }

  if (parsed.operations.length !== 1 || parsed.operations[0].type !== "invokeHostFunction") {
    throw new Error("Expected a single Soroban USDC transfer operation.")
  }

  const invokeOp = parsed.operations[0] as {
    type: "invokeHostFunction"
    func: xdr.HostFunction
    auth?: xdr.SorobanAuthorizationEntry[]
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    "https://soroban-testnet.stellar.org"
  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
  const latest = await server.getLatestLedger()
  const expiration = latest.sequence + 60

  const signedAuth: xdr.SorobanAuthorizationEntry[] = []
  for (const entry of invokeOp.auth ?? []) {
    try {
      signedAuth.push(
        await authorizeEntry(entry, keypair, expiration, params.networkPassphrase),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Could not authorize smart-wallet transfer (${msg}). If this persists, sign out and sign in again to refresh your wallet.`,
      )
    }
  }

  const sourceAccount = await server.getAccount(signer)
  const rebuilt = new TransactionBuilder(sourceAccount, {
    fee: parsed.fee,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: invokeOp.func,
        auth: signedAuth.length > 0 ? signedAuth : undefined,
      }),
    )
    .setTimeout(60)
    .build()

  let prepared: Transaction
  try {
    prepared = await server.prepareTransaction(rebuilt)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Transaction simulation failed: ${msg}`)
  }

  prepared.sign(keypair)
  return prepared.toEnvelope().toXDR("base64")
}
