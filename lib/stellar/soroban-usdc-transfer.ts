import "server-only"

import {
  Address,
  Contract,
  TransactionBuilder,
  Networks,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { getBlendUsdcContractId } from "@/lib/stellar/soroban-token"
import { getStellarConfig } from "@/lib/turnkey/config"

const USDC_DECIMALS = 7

function getNetworkPassphrase(network: "testnet" | "mainnet"): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

function getSorobanRpcUrl(network: "testnet" | "mainnet"): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "testnet"
      ? "https://soroban-testnet.stellar.org"
      : "https://soroban.stellar.org")
  )
}

export function getUsdcTokenContractId(network: "testnet" | "mainnet"): string {
  return getBlendUsdcContractId(network)
}

function amountToI128ScVal(amount: string): xdr.ScVal {
  const num = parseFloat(amount)
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid amount: ${amount}`)
  }
  const stroops = BigInt(Math.round(num * 10 ** USDC_DECIMALS))
  const mask64 = BigInt("0xffffffffffffffff")
  const lo = stroops & mask64
  const hi = stroops >> BigInt(64)
  return xdr.ScVal.scvI128(
    new xdr.Int128Parts({
      lo: lo as unknown as xdr.Uint64,
      hi: hi as unknown as xdr.Uint64,
    })
  )
}

/**
 * Build an unsigned Soroban USDC transfer (SEP-41 transfer).
 * Fee payer / tx source is `signerPublicKey` (classic G).
 * `fromAddress` / `toAddress` may be C (smart account) or G.
 */
export async function buildSorobanUsdcTransferXdr(params: {
  signerPublicKey: string
  fromAddress: string
  toAddress: string
  amount: string
  network?: "testnet" | "mainnet"
}): Promise<{ unsignedXdr: string; paymentRail: "smart" }> {
  const cfg = getStellarConfig()
  const network = params.network ?? cfg.network
  const signer = params.signerPublicKey.trim().toUpperCase()
  const from = params.fromAddress.trim().toUpperCase()
  const to = params.toAddress.trim().toUpperCase()

  if (!/^G[A-Z0-9]{55}$/.test(signer)) {
    throw new Error("signerPublicKey must be a classic G address for Soroban transfers.")
  }

  const rpcUrl = getSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  const networkPassphrase = getNetworkPassphrase(network)
  const tokenId = getUsdcTokenContractId(network)
  const token = new Contract(tokenId)

  const account = await server.getAccount(signer)
  const amountScVal = amountToI128ScVal(params.amount)

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(
      token.call(
        "transfer",
        Address.fromString(from).toScVal(),
        Address.fromString(to).toScVal(),
        amountScVal
      )
    )
    .setTimeout(30)
    .build()

  const prepared = await server.prepareTransaction(rawTx)
  return { unsignedXdr: prepared.toXDR(), paymentRail: "smart" }
}

/**
 * OZ passkey smart account (C) as source — returns envelope for WebAuthn auth signing.
 */
export async function buildOzSmartUsdcTransferEnvelope(params: {
  fromContractId: string
  toAddress: string
  amount: string
  network?: "testnet" | "mainnet"
}): Promise<{ envelopeXdr: string; paymentRail: "smart"; signMethod: "oz_passkey" }> {
  const cfg = getStellarConfig()
  const network = params.network ?? cfg.network
  const from = params.fromContractId.trim().toUpperCase()
  const to = params.toAddress.trim().toUpperCase()

  if (!from.startsWith("C")) {
    throw new Error("fromContractId must be a smart account (C…).")
  }

  const rpcUrl = getSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  const networkPassphrase = getNetworkPassphrase(network)
  const token = new Contract(getUsdcTokenContractId(network))

  const account = await server.getAccount(from)
  const amountScVal = amountToI128ScVal(params.amount)

  const rawTx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(
      token.call(
        "transfer",
        Address.fromString(from).toScVal(),
        Address.fromString(to).toScVal(),
        amountScVal
      )
    )
    .setTimeout(60)
    .build()

  const prepared = await server.prepareTransaction(rawTx)
  return {
    envelopeXdr: prepared.toEnvelope().toXDR("base64"),
    paymentRail: "smart",
    signMethod: "oz_passkey",
  }
}

export async function submitSignedSorobanEnvelope(signedEnvelopeXdr: string): Promise<string> {
  const cfg = getStellarConfig()
  const network = cfg.network
  const rpcUrl = getSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  const networkPassphrase = getNetworkPassphrase(network)
  const { Transaction } = await import("@stellar/stellar-sdk")
  const tx = new Transaction(signedEnvelopeXdr, networkPassphrase)
  const result = await server.sendTransaction(tx)
  if (result.status === "ERROR") {
    throw new Error(`Soroban submit failed: ${String(result.errorResult)}`)
  }
  if (!result.hash) throw new Error("No transaction hash from Soroban RPC")
  return result.hash
}
