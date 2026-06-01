import "server-only"

import {
  Address,
  Contract,
  Transaction,
  TransactionBuilder,
  FeeBumpTransaction,
  Networks,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { Api } from "@stellar/stellar-sdk/rpc"
import { getAssetByContractId } from "@/lib/stellar/asset-registry"
import type { SozuAsset, StellarNetwork } from "@/lib/stellar/asset-types"
import { normalizeHolderAddress } from "@/lib/stellar/stellar-holder"
import { getStellarConfig } from "@/lib/turnkey/config"
import {
  getConfiguredFunderPublicKey,
  getFunderKeypair,
} from "@/lib/stellar/soroban-fee-payer"
import { extractSorobanDataXdr } from "@/lib/stellar/soroban-prepared-envelope"

function getNetworkPassphrase(network: StellarNetwork): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

function getSorobanRpcUrl(network: StellarNetwork): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "testnet"
      ? "https://soroban-testnet.stellar.org"
      : "https://soroban.stellar.org")
  )
}

function amountToI128ScVal(amount: string, decimals: number): xdr.ScVal {
  const num = parseFloat(amount)
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid amount: ${amount}`)
  }
  const stroops = BigInt(Math.round(num * 10 ** decimals))
  const mask64 = BigInt("0xffffffffffffffff")
  const lo = stroops & mask64
  const hi = stroops >> BigInt(64)
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: lo as unknown as xdr.Uint64,
      hi: hi as unknown as xdr.Uint64,
    }),
  )
}

export type SendTokenParams = {
  contractId: string
  from: string
  to: string
  amount: string
  /** Classic G relayer / fee payer — never assumes from is G. */
  relayerPublicKey: string
  network?: StellarNetwork
  /** When omitted, resolved from registry or defaults to 7. */
  decimals?: number
}

/**
 * Universal Soroban SEP-41 transfer. Identifies asset by contractId only.
 */
export async function sendToken(
  params: SendTokenParams,
): Promise<{
  unsignedXdr: string
  sorobanDataXdr: string | null
  paymentRail: "smart"
  contractId: string
  asset: SozuAsset | null
}> {
  const cfg = getStellarConfig()
  const network = params.network ?? cfg.network
  const contractId = params.contractId.trim().toUpperCase()
  const from = normalizeHolderAddress(params.from)
  const to = normalizeHolderAddress(params.to)
  const relayer = params.relayerPublicKey.trim().toUpperCase()

  if (!/^G[A-Z0-9]{55}$/.test(relayer)) {
    throw new Error("relayerPublicKey must be a classic G address (fee payer).")
  }

  const registered = getAssetByContractId(contractId, network)
  const decimals = params.decimals ?? registered?.decimals ?? 7

  const rpcUrl = getSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  const token = new Contract(contractId)
  const account = await server.getAccount(relayer)
  const amountScVal = amountToI128ScVal(params.amount, decimals)

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: getNetworkPassphrase(network),
  })
    .addOperation(
      token.call(
        "transfer",
        Address.fromString(from).toScVal(),
        Address.fromString(to).toScVal(),
        amountScVal,
      ),
    )
    .setTimeout(30)
    .build()

  const prepared = await server.prepareTransaction(rawTx)
  const networkPassphrase = getNetworkPassphrase(network)
  const envelopeXdr = prepared.toEnvelope().toXDR("base64")
  return {
    /** Envelope XDR (same format as SozuPay prepare-soroban) — required for auth entries + kit.signAuthEntry. */
    unsignedXdr: envelopeXdr,
    sorobanDataXdr: extractSorobanDataXdr(envelopeXdr, networkPassphrase),
    paymentRail: "smart",
    contractId,
    asset: registered ?? null,
  }
}

function formatSorobanSubmitError(result: {
  errorResult?: xdr.TransactionResult
  errorResultXdr?: string
}): string {
  if (result.errorResult) {
    try {
      const txResult = result.errorResult.result()?.switch?.().name
      if (txResult === "txMalformed") {
        return "transaction envelope is invalid (missing Soroban data). Refresh and try send again."
      }
      if (txResult === "txBadAuth") {
        return "passkey signature was rejected. Sign out, sign in on the same URL, then retry."
      }
      if (txResult === "txInsufficientFee") {
        return "insufficient fee on the fee-payer account. Fund STELLAR_FUNDER_SECRET with XLM."
      }
      const opResults = result.errorResult.result()?.results()
      const first = opResults?.[0]
      const tr = first?.tr?.()
      const opName = tr?.switch?.().name
      if (opName) return `transaction failed (${opName})`
      if (txResult) return `transaction failed (${txResult})`
    } catch {
      /* fall through */
    }
  }
  if (result.errorResultXdr?.trim()) {
    return result.errorResultXdr.trim()
  }
  return "transaction rejected by Soroban RPC"
}

async function simulateBeforeSubmit(
  server: rpc.Server,
  tx: Transaction | FeeBumpTransaction,
): Promise<void> {
  const sim = await server.simulateTransaction(tx)
  if (Api.isSimulationError(sim)) {
    const detail = typeof sim.error === "string" ? sim.error : JSON.stringify(sim.error)
    console.error("[simulateBeforeSubmit] Simulation error:", detail.slice(0, 1000))
    if (detail.includes("__check_auth") || detail.includes("InvalidAction")) {
      throw new Error(
        "Soroban auth rejected (__check_auth): the smart account did not accept the passkey signature for this transfer.",
      )
    }
    throw new Error(`Simulation failed: ${detail.slice(0, 500)}`)
  }
}

export async function submitSignedSorobanEnvelope(
  signedEnvelopeXdr: string,
): Promise<string> {
  const cfg = getStellarConfig()
  const network = cfg.network
  const rpcUrl = getSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  const networkPassphrase = getNetworkPassphrase(network)

  // Parse using TransactionBuilder so FeeBump envelopes are handled correctly and
  // the instance matches the SDK expectations for rpc.Server.sendTransaction().
  const parsed = TransactionBuilder.fromXDR(signedEnvelopeXdr, networkPassphrase)
  const tx =
    parsed instanceof Transaction || parsed instanceof FeeBumpTransaction
      ? parsed
      : (() => {
          throw new Error("Could not parse signed envelope XDR into a Transaction.")
        })()

  // Re-prepare Soroban resources server-side (avoids client-side assembleTransaction()).
  // This also handles the case where the client built with stale sorobanData.
  let preparedTx: Transaction | FeeBumpTransaction = tx
  try {
    if (tx instanceof Transaction) {
      preparedTx = await server.prepareTransaction(tx)
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[submitSignedSorobanEnvelope] prepareTransaction skipped:", e)
    }
  }

  const funderPk = getConfiguredFunderPublicKey()
  const funderKp = getFunderKeypair()
  const txSource =
    preparedTx instanceof FeeBumpTransaction
      ? (preparedTx as any).innerTransaction?.source ?? ""
      : preparedTx.source
  if (funderKp && funderPk && txSource === funderPk && preparedTx instanceof Transaction) {
    preparedTx.sign(funderKp)
  } else if (funderPk && txSource === funderPk && !funderKp) {
    throw new Error(
      "Fee payer signature missing and STELLAR_FUNDER_SECRET is not configured on the server.",
    )
  }

  await simulateBeforeSubmit(server, preparedTx)

  const result = await server.sendTransaction(preparedTx)
  if (result.status === "ERROR") {
    throw new Error(`Soroban submit failed: ${formatSorobanSubmitError(result)}`)
  }
  if (!result.hash) throw new Error("No transaction hash from Soroban RPC")

  const ledger = await waitForSorobanTransactionResult(server, result.hash)
  if (ledger.status === "FAILED") {
    const detail = ledger.detail
    throw new Error(
      `Transaction was included on-chain but failed (${detail}). ` +
        `Your USDC balance was not reduced. View: https://stellar.expert/explorer/testnet/tx/${result.hash}`,
    )
  }
  if (ledger.status !== "SUCCESS") {
    throw new Error(
      `Transaction ${result.hash.slice(0, 8)}… is still pending on Soroban RPC. ` +
        "Check Stellar Expert in a minute before sending again.",
    )
  }
  return result.hash
}

type SorobanLedgerOutcome =
  | { status: "SUCCESS" }
  | { status: "FAILED"; detail: string }
  | { status: "PENDING" }

async function waitForSorobanTransactionResult(
  server: rpc.Server,
  hash: string,
  maxAttempts = 45,
): Promise<SorobanLedgerOutcome> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const tx = await server.getTransaction(hash)
      if (tx.status === Api.GetTransactionStatus.SUCCESS) {
        return { status: "SUCCESS" }
      }
      if (tx.status === Api.GetTransactionStatus.FAILED) {
        return { status: "FAILED", detail: formatSorobanLedgerFailure(tx) }
      }
    } catch {
      /* NOT_FOUND — keep polling */
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return { status: "PENDING" }
}

function formatSorobanLedgerFailure(tx: Api.GetFailedTransactionResponse): string {
  const failed = tx
  const events = failed.diagnosticEventsXdr ?? []
  for (const ev of events) {
    try {
      const text = ev.toXDR("base64")
      if (text.includes("instructions exceeds amount")) {
        return "Soroban resource budget too low (retry send after refreshing the page)"
      }
      if (text.includes("__check_auth") || text.includes("InvalidAction")) {
        return "passkey auth rejected (__check_auth)"
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const tr = failed.resultXdr?.result?.()?.results?.()?.[0]?.tr?.()
    const name = tr?.switch?.()?.name
    if (name) return name
  } catch {
    /* ignore */
  }
  return "on-chain execution failed"
}

/** @deprecated Use sendToken — kept for existing imports */
export async function buildSorobanUsdcTransferXdr(params: {
  signerPublicKey: string
  fromAddress: string
  toAddress: string
  amount: string
  network?: StellarNetwork
  tokenContractId?: string
}): Promise<{ unsignedXdr: string; paymentRail: "smart"; tokenContractId: string }> {
  const cfg = getStellarConfig()
  const network = params.network ?? cfg.network
  const { getBlendUsdcAsset } = await import("@/lib/stellar/asset-registry")
  const contractId =
    params.tokenContractId?.trim().toUpperCase() ||
    getBlendUsdcAsset(network).contractId

  const built = await sendToken({
    contractId,
    from: params.fromAddress,
    to: params.toAddress,
    amount: params.amount,
    relayerPublicKey: params.signerPublicKey,
    network,
  })

  return {
    unsignedXdr: built.unsignedXdr,
    paymentRail: built.paymentRail,
    tokenContractId: built.contractId,
  }
}

export async function buildOzSmartUsdcTransferEnvelope(params: {
  fromContractId: string
  toAddress: string
  amount: string
  signerPublicKey: string
  network?: StellarNetwork
  tokenContractId?: string
}): Promise<{ unsignedXdr: string; paymentRail: "smart"; signMethod: "oz_passkey" }> {
  const from = params.fromContractId.trim().toUpperCase()
  if (!from.startsWith("C")) {
    throw new Error("fromContractId must be a smart account (C…).")
  }

  const { unsignedXdr, paymentRail } = await buildSorobanUsdcTransferXdr({
    signerPublicKey: params.signerPublicKey,
    fromAddress: from,
    toAddress: params.toAddress,
    amount: params.amount,
    network: params.network,
    tokenContractId: params.tokenContractId,
  })

  return { unsignedXdr, paymentRail, signMethod: "oz_passkey" }
}
