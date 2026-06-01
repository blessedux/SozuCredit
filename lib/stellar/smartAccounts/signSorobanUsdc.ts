"use client"

import type { SmartAccountKit } from "smart-account-kit"
import type { xdr } from "@stellar/stellar-sdk"
import { ensureKitConnectedForSend } from "@/lib/stellar/smartAccounts/ensureKitConnected"
import {
  shouldFallbackPasskeySign,
  signAuthEntryWithResolvedKeyData,
} from "@/lib/stellar/smartAccounts/signSorobanWebAuthnAuth"

/**
 * Sign Soroban USDC transfer on a server-prepared envelope.
 * Uses kit.signAuthEntry when the contract exposes get_context_rules; otherwise manual
 * keyData resolve (get_context_rule). Re-prepares like SozuPay payouts after signing.
 */
export async function signSorobanPreparedTxWithPasskey(params: {
  kit: SmartAccountKit
  unsignedXdr: string
  sorobanDataXdr?: string | null
  networkPassphrase: string
  credentialId?: string | null
  smartAccountContractId?: string | null
  webauthnVerifierAddress?: string | null
  supportsOzKitApi?: boolean
  signMethod?: "oz_passkey" | "oz_passkey_local" | string
}): Promise<string> {
  const { Transaction, TransactionBuilder, Operation } = await import("@stellar/stellar-sdk")

  if (!params.credentialId) {
    throw new Error("Credential ID required for smart wallet send.")
  }

  const contractId = params.smartAccountContractId?.trim().toUpperCase()
  if (!contractId?.startsWith("C")) {
    throw new Error("Smart account contract id (C…) required for signing.")
  }

  // Determine path before any RPC calls so we only pay for what we use.
  const isDev = process.env.NODE_ENV === "development"
  // Dev override: set NEXT_PUBLIC_FORCE_SIGN_PATH="kit" or "manual" in .env.local for A/B testing.
  const forceSignPath =
    typeof window !== "undefined"
      ? (window as any).__SOZU_FORCE_SIGN_PATH ?? process.env.NEXT_PUBLIC_FORCE_SIGN_PATH
      : process.env.NEXT_PUBLIC_FORCE_SIGN_PATH
  const useKit =
    params.signMethod === "oz_passkey_local"
      ? false
      : forceSignPath === "kit"
        ? true
        : forceSignPath === "manual"
          ? false
          : // OZ WASM (3e51f5b2…) needs auth_digest signing — kit@0.2.x uses legacy payload.
            // Manual path calls startAuthentication and shows the OS passkey prompt reliably.
            false

  // ensureKitConnectedForSend contains RPC + IDB calls. Only needed for the kit path.
  if (useKit) {
    await ensureKitConnectedForSend(params.kit, params.credentialId, contractId)
  }

  let webauthnVerifier = params.webauthnVerifierAddress?.trim() ?? ""
  if (!webauthnVerifier) {
    const cfgRes = await fetch("/api/smart-accounts/config")
    const cfg = (await cfgRes.json().catch(() => ({}))) as { webauthnVerifierAddress?: string }
    webauthnVerifier = cfg.webauthnVerifierAddress?.trim() ?? ""
  }
  if (!webauthnVerifier) {
    throw new Error("Smart account verifier not configured.")
  }

  const tx = new Transaction(params.unsignedXdr, params.networkPassphrase)
  if (tx.operations.length !== 1) {
    throw new Error("Expected a single Soroban operation.")
  }

  const op = tx.operations[0]
  if (op.type !== "invokeHostFunction") {
    throw new Error("Expected invokeHostFunction operation.")
  }

  if (!tx.source.startsWith("G")) {
    throw new Error("Fee payer must be a classic G address.")
  }

  const invokeOp = op as {
    type: "invokeHostFunction"
    source?: string
    func: xdr.HostFunction
    auth?: xdr.SorobanAuthorizationEntry[]
  }

  const authEntries = invokeOp.auth ?? []
  if (authEntries.length === 0) {
    throw new Error(
      "This transfer has no Soroban auth to sign. Sign out, sign in with passkey, complete wallet setup, then retry.",
    )
  }

  console.log("[signSorobanUsdc] signing params", {
    signMethod: params.signMethod,
    supportsOzKitApi: params.supportsOzKitApi,
    forceSignPath: forceSignPath ?? "(none)",
    effectivePath: useKit ? "kit" : "manual",
    contractId: contractId?.slice(0, 8),
    credentialId: params.credentialId?.slice(0, 8),
    authEntryCount: authEntries.length,
  })

  const signOne = async (entry: xdr.SorobanAuthorizationEntry): Promise<xdr.SorobanAuthorizationEntry> => {
    const creds = entry.credentials().address()
    const fromEntry = creds.signatureExpirationLedger()
    const expirationFromPrepare =
      fromEntry != null && Number(fromEntry) > 0 ? Number(fromEntry) : undefined

    if (isDev) {
      console.log("[signSorobanUsdc] auth entry", {
        expirationLedger: expirationFromPrepare,
        path: useKit ? "kit.signAuthEntry" : "manual",
      })
    }

    if (useKit) {
      try {
        const signed = await params.kit.signAuthEntry(entry, {
          credentialId: params.credentialId ?? undefined,
          expiration: expirationFromPrepare,
        })
        if (isDev) console.log("[signSorobanUsdc] kit.signAuthEntry succeeded")
        return signed
      } catch (err) {
        if (isDev) console.warn("[signSorobanUsdc] kit.signAuthEntry threw, checking fallback:", String(err).slice(0, 120))
        if (!shouldFallbackPasskeySign(err)) throw err
      }
    }
    console.log("[signSorobanUsdc] using signAuthEntryWithResolvedKeyData")
    const result = await signAuthEntryWithResolvedKeyData({
      entry,
      credentialId: params.credentialId!,
      networkPassphrase: params.networkPassphrase,
      webauthnVerifierAddress: webauthnVerifier,
      smartAccountContractId: contractId,
      expiration: expirationFromPrepare,
    })
    if (isDev) console.log("[signSorobanUsdc] resolved-keyData signing completed")
    return result
  }

  const signedAuth: xdr.SorobanAuthorizationEntry[] = []
  for (const entry of authEntries) {
    signedAuth.push(await signOne(entry))
  }

  const signedInvoke = Operation.invokeHostFunction({
    source: invokeOp.source,
    func: invokeOp.func,
    auth: signedAuth,
  })

  const sorobanDataTrimmed = params.sorobanDataXdr?.trim()
  if (sorobanDataTrimmed) {
    try {
      const { parseSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope")
      const sorobanData = parseSorobanDataXdr(sorobanDataTrimmed)
      const builder = TransactionBuilder.cloneFrom(tx, {
        fee: tx.fee,
        networkPassphrase: params.networkPassphrase,
        sorobanData,
      })
      builder.clearOperations()
      builder.addOperation(signedInvoke)
      const built = builder.build()
      const { Api } = await import("@stellar/stellar-sdk/rpc")
      const sim = await params.kit.rpc.simulateTransaction(built)
      if (Api.isSimulationError(sim)) {
        const detail = typeof sim.error === "string" ? sim.error : JSON.stringify(sim.error)
        if (detail.includes("__check_auth") || detail.includes("InvalidAction")) {
          throw new Error(
            "Soroban auth rejected after signing (__check_auth). Sign out, sign in at http://localhost:3001, and retry.",
          )
        }
        throw new Error(`Post-sign simulation failed: ${detail.slice(0, 800)}`)
      }
      if (isDev) {
        console.log("[signSorobanUsdc] finalized via cloneFrom + assemble (refreshed Soroban resources)")
      }
      // NOTE: `assembleTransaction` performs an `instanceof Transaction` check that can
      // fail in Next.js/Turbopack when multiple stellar-sdk copies are bundled.
      // We now delegate final Soroban resource preparation to the server submit endpoint.
      return built.toEnvelope().toXDR("base64")
    } catch (cloneErr) {
      const cloneMsg = cloneErr instanceof Error ? cloneErr.message : String(cloneErr)
      // Re-throw auth errors — these are definitive failures, not builder problems.
      if (cloneMsg.includes("__check_auth") || cloneMsg.includes("Post-sign simulation failed")) {
        throw cloneErr
      }
      if (isDev) {
        console.warn(
          "[signSorobanUsdc] cloneFrom failed, falling back to re-simulate:",
          cloneMsg,
        )
      }
    }
  }

  const sourceAccount = await params.kit.rpc.getAccount(tx.source)
  const rebuilt = new TransactionBuilder(sourceAccount, {
    fee: tx.fee,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(signedInvoke)
    .setTimeout(60)
    .build()

  const { Api } = await import("@stellar/stellar-sdk/rpc")
  if (isDev) {
    console.log("[signSorobanUsdc] re-simulating with signed auth (no sorobanDataXdr on hand)")
  }
  const sim = await params.kit.rpc.simulateTransaction(rebuilt)
  if (Api.isSimulationError(sim)) {
    const detail = typeof sim.error === "string" ? sim.error : JSON.stringify(sim.error)
    if (detail.includes("__check_auth") || detail.includes("InvalidAction")) {
      const hint =
        process.env.NODE_ENV === "development"
          ? ` Simulation: ${detail.slice(0, 280)}`
          : ""
      throw new Error(
        "Soroban auth rejected (__check_auth). Common causes: (1) passkey registered on a different URL than you use now (rpID mismatch — always use the same host, e.g. only localhost:3001), " +
          "(2) smart wallet deployed before the pubkey fix (sign out, register again, complete wallet setup, fund the new C), " +
          "(3) prepared transaction expired — refresh and send again. " +
          "If Touch ID succeeded but you still see this, restart the dev server and retry on one canonical URL." +
          hint,
      )
    }
    throw new Error(`Simulation failed: ${detail.slice(0, 800)}`)
  }

  return rebuilt.toEnvelope().toXDR("base64")
}

/** @deprecated Use signSorobanPreparedTxWithPasskey */
export async function signSorobanEnvelopeWithPasskey(params: {
  kit: SmartAccountKit
  envelopeXdr: string
  networkPassphrase: string
  credentialId?: string | null
  sorobanDataXdr?: string | null
}): Promise<string> {
  return signSorobanPreparedTxWithPasskey({
    kit: params.kit,
    unsignedXdr: params.envelopeXdr,
    sorobanDataXdr: params.sorobanDataXdr,
    networkPassphrase: params.networkPassphrase,
    credentialId: params.credentialId,
  })
}
