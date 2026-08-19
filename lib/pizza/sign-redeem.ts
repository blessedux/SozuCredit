"use client"

import { getUserId } from "@/lib/wallet-utils"
import { CIRCLE_TESTNET_USDC_SAC_ID } from "@/lib/stellar/pizza-token"

type RedeemView = {
  id: string
  status: string
  guestAddress: string
  storeAddress: string
  tokenId: string
  transfer: {
    contractId: string
    method: string
    from: string
    to: string
    amount: string
  }
}

export type PizzaRedeemSignResult =
  | { ok: true; txHash: string }
  | { ok: false; error: string }

async function signAndSubmitSep41Transfer(params: {
  userId: string
  sender: string
  destination: string
  amount: string
  contractId: string
}): Promise<{ txHash: string }> {
  const buildResponse = await fetch("/api/wallet/stellar/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": params.userId },
    body: JSON.stringify({
      destination: params.destination,
      amount: params.amount,
      sender: params.sender,
      contractId: params.contractId,
    }),
  })
  if (!buildResponse.ok) {
    const error = (await buildResponse.json().catch(() => ({}))) as { error?: string }
    throw new Error(error.error || "Failed to build PizzaToken transfer")
  }
  const build = await buildResponse.json()
  const unsignedXdr =
    typeof build.unsignedXdr === "string"
      ? build.unsignedXdr
      : typeof build.envelopeXdr === "string"
        ? build.envelopeXdr
        : null
  if (!unsignedXdr) throw new Error("No unsigned transaction returned")

  const signMethod = build.signMethod as string | undefined
  const signerPublicKey =
    typeof build.signerPublicKey === "string" && build.signerPublicKey.startsWith("G")
      ? build.signerPublicKey
      : null
  if (!signerPublicKey) {
    throw new Error("Passkey signer missing. Sign in with passkey on this device.")
  }

  const { getCurrentCredentialId, storeCredentialIdInSession } = await import(
    "@/lib/storage/key-utils"
  )
  const credentialId =
    (typeof build.ozCredentialId === "string" ? build.ozCredentialId : null) ||
    (await getCurrentCredentialId(signerPublicKey))
  if (!credentialId) {
    throw new Error("Passkey credential not found. Sign in with passkey, then retry.")
  }
  storeCredentialIdInSession(credentialId)

  const { getStellarConfig } = await import("@/lib/turnkey/config")
  const stellarConfig = getStellarConfig()
  const { Networks } = await import("@stellar/stellar-sdk")
  const networkPassphrase =
    stellarConfig.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET

  let signedEnvelopeXdr: string
  const walletContractId =
    typeof build.walletAddress === "string" && build.walletAddress.startsWith("C")
      ? build.walletAddress
      : params.sender

  if (signMethod === "oz_passkey" || signMethod === "oz_passkey_local") {
    const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client")
    const { signSorobanPreparedTxWithPasskey } = await import(
      "@/lib/stellar/smartAccounts/signSorobanUsdc"
    )
    const { extractSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope")
    const { kit, config } = await getSmartAccountKit()
    const sorobanDataXdr =
      typeof build.sorobanDataXdr === "string" && build.sorobanDataXdr.length > 0
        ? build.sorobanDataXdr
        : extractSorobanDataXdr(unsignedXdr, config.networkPassphrase)
    signedEnvelopeXdr = await signSorobanPreparedTxWithPasskey({
      kit,
      unsignedXdr,
      sorobanDataXdr,
      networkPassphrase: config.networkPassphrase,
      credentialId,
      smartAccountContractId: walletContractId,
      webauthnVerifierAddress: config.webauthnVerifierAddress,
      supportsOzKitApi: build.supportsOzKitApi === true,
      signMethod: signMethod ?? "oz_passkey",
    })
  } else if (signMethod === "smart_g_signer") {
    const { signSorobanUsdcWithGSigner } = await import(
      "@/lib/stellar/smartAccounts/signSorobanTransferG"
    )
    signedEnvelopeXdr = await signSorobanUsdcWithGSigner({
      unsignedXdr,
      signerPublicKey,
      credentialId,
      userId: params.userId,
      networkPassphrase,
    })
  } else {
    throw new Error(`Unsupported sign method: ${signMethod ?? "unknown"}`)
  }

  const submitResponse = await fetch("/api/wallet/stellar/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": params.userId },
    body: JSON.stringify({ signedEnvelopeXdr }),
  })
  if (!submitResponse.ok) {
    const submitErr = (await submitResponse.json().catch(() => ({}))) as { error?: string }
    throw new Error(submitErr.error || "Failed to submit PizzaToken transfer")
  }
  const result = await submitResponse.json()
  const txHash = typeof result.transactionHash === "string" ? result.transactionHash : ""
  if (!result.success || !/^[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("PizzaToken transfer did not return a transaction hash")
  }
  return { txHash: txHash.toLowerCase() }
}

export async function signPizzaRedeemIntent(params: {
  intentId: string
  guestAddress: string
}): Promise<PizzaRedeemSignResult> {
  try {
    const userId = getUserId()
    if (!userId) return { ok: false, error: "Not authenticated" }

    const guest = params.guestAddress.trim().toUpperCase()
    const res = await fetch(`/api/pizza/redeems/${encodeURIComponent(params.intentId)}`)
    if (!res.ok) {
      return { ok: false, error: "Redeem intent not found" }
    }
    const body = (await res.json()) as { redeem?: RedeemView }
    const redeem = body.redeem
    if (!redeem?.transfer) return { ok: false, error: "Redeem intent is missing a transfer" }

    if (redeem.status === "submitted" && redeem) {
      return { ok: true, txHash: "already-submitted" }
    }

    const contractId = redeem.transfer.contractId.trim().toUpperCase()
    if (contractId === CIRCLE_TESTNET_USDC_SAC_ID) {
      return { ok: false, error: "Pizza redeem must not use Circle USDC" }
    }
    if (redeem.transfer.method !== "transfer") {
      return { ok: false, error: "Unexpected redeem method" }
    }
    if (redeem.transfer.from.trim().toUpperCase() !== guest) {
      return { ok: false, error: "This redeem is for a different wallet" }
    }
    if (redeem.transfer.amount !== "1") {
      return { ok: false, error: "Redeem amount must be 1 PIZZA" }
    }

    const { txHash } = await signAndSubmitSep41Transfer({
      userId,
      sender: guest,
      destination: redeem.transfer.to,
      amount: "1",
      contractId,
    })

    const report = await fetch(`/api/pizza/redeems/${encodeURIComponent(params.intentId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash }),
    })
    if (!report.ok) {
      const err = (await report.json().catch(() => ({}))) as { error?: string }
      return { ok: false, error: err.error || "Pay did not accept the transaction hash" }
    }
    return { ok: true, txHash }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Pizza sign failed" }
  }
}
