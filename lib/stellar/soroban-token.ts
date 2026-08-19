/**
 * Soroban token helpers.
 *
 * Reads the balance of a Soroban token contract (SEP-0041) for a given holder.
 * BlendUSDC on testnet does not appear in Horizon trustlines.
 */

import {
  Asset,
  Contract,
  Keypair,
  Address,
  Account,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  xdr,
} from "@stellar/stellar-sdk"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { Api } from "@stellar/stellar-sdk/rpc"
import { getBlendUsdcAsset } from "@/lib/stellar/asset-registry"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const DEFAULT_TOKEN_DECIMALS = 7

function unitsToDecimal(raw: bigint, decimals: number): number {
  if (decimals <= 0) return Number(raw)
  return Number(raw) / 10 ** decimals
}

function resolveSorobanRpcUrl(network: "testnet" | "mainnet"): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "mainnet"
      ? "https://soroban.stellar.org"
      : "https://soroban-testnet.stellar.org")
  )
}

function getNetworkPassphrase(network: "testnet" | "mainnet"): string {
  return network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

function scValToBalanceStroops(val: xdr.ScVal): bigint {
  switch (val.switch().name) {
    case "scvI128": {
      const p = val.i128()
      const hi = BigInt(p.hi().toString())
      const lo = BigInt(p.lo().toString())
      return (hi << BigInt(64)) + lo
    }
    case "scvU128": {
      const p = val.u128()
      const hi = BigInt(p.hi().toString())
      const lo = BigInt(p.lo().toString())
      return (hi << BigInt(64)) + lo
    }
    case "scvI64":
      return BigInt(val.i64().toString())
    case "scvU64":
      return BigInt(val.u64().toString())
    default:
      return BigInt(0)
  }
}

function stroopsToDecimal(stroops: bigint, decimals = DEFAULT_TOKEN_DECIMALS): number {
  return unitsToDecimal(stroops, decimals)
}

function normalizeHolderAddress(holderAddress: string): string {
  return holderAddress.trim().toUpperCase()
}

async function getSimulationSourceAccount(
  server: rpc.Server,
): Promise<{ account: Account; publicKey: string }> {
  const secret = process.env.STELLAR_FUNDER_SECRET?.trim()
  if (secret) {
    const kp = Keypair.fromSecret(secret)
    const loaded = await server.getAccount(kp.publicKey())
    return { account: loaded, publicKey: kp.publicKey() }
  }
  return { account: new Account(DUMMY_ACCOUNT, "0"), publicKey: DUMMY_ACCOUNT }
}

function parseSimulationBalance(result: rpc.Api.SimulateTransactionSuccessResponse): bigint | null {
  const retval = result.result?.retval
  if (!retval) return null

  if (typeof retval === "string") {
    try {
      return scValToBalanceStroops(xdr.ScVal.fromXDR(retval, "base64"))
    } catch {
      return null
    }
  }

  if (retval instanceof xdr.ScVal) {
    return scValToBalanceStroops(retval)
  }

  return null
}

async function readBalanceViaSimulate(
  tokenAddress: string,
  holderAddress: string,
  network: "testnet" | "mainnet",
  decimals = DEFAULT_TOKEN_DECIMALS,
): Promise<number | null> {
  const rpcUrl = resolveSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  const networkPassphrase = getNetworkPassphrase(network)
  const { account } = await getSimulationSourceAccount(server)
  const contract = new Contract(tokenAddress)
  const holder = normalizeHolderAddress(holderAddress)

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call("balance", Address.fromString(holder).toScVal()))
    .setTimeout(30)
    .build()

  const result = await server.simulateTransaction(tx)

  if (Api.isSimulationError(result)) {
    console.warn("[SorobanToken] balance() simulation error:", result.error)
    return null
  }

  if (!Api.isSimulationSuccess(result)) return null

  const stroops = parseSimulationBalance(result)
  if (stroops === null) return null
  return stroopsToDecimal(stroops, decimals)
}

/** Direct ledger read when simulation fails (e.g. archived state edge cases). */
async function readBalanceViaLedger(
  tokenAddress: string,
  holderAddress: string,
  network: "testnet" | "mainnet",
  decimals = DEFAULT_TOKEN_DECIMALS,
): Promise<number | null> {
  const rpcUrl = resolveSorobanRpcUrl(network)
  const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
  const holder = normalizeHolderAddress(holderAddress)

  const keys = [
    xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Balance"),
      Address.fromString(holder).toScVal(),
    ]),
  ]

  for (const key of keys) {
    try {
      const entry = await server.getContractData(tokenAddress, key)
      const val = entry?.val
      if (val instanceof xdr.ScVal) {
        return stroopsToDecimal(scValToBalanceStroops(val), decimals)
      }
    } catch {
      // try next key shape
    }
  }

  return null
}

/**
 * Read the Soroban token balance for `userAddress` from contract `tokenAddress`.
 * Returns a decimal value (divided by 10^decimals; PizzaToken uses 0).
 */
export async function getSorobanTokenBalance(
  tokenAddress: string,
  userAddress: string,
  network: "testnet" | "mainnet" = "testnet",
  decimals = DEFAULT_TOKEN_DECIMALS,
): Promise<number> {
  const holder = normalizeHolderAddress(userAddress)
  const token = tokenAddress.trim().toUpperCase()

  const hasFunder = Boolean(process.env.STELLAR_FUNDER_SECRET?.trim())
  const attempts = hasFunder
    ? [
        () => readBalanceViaSimulate(token, holder, network, decimals),
        () => readBalanceViaLedger(token, holder, network, decimals),
      ]
    : [
        () => readBalanceViaLedger(token, holder, network, decimals),
        () => readBalanceViaSimulate(token, holder, network, decimals),
      ]

  for (const attempt of attempts) {
    try {
      const value = await attempt()
      if (value !== null && Number.isFinite(value) && value >= 0) {
        return value
      }
    } catch (err) {
      console.warn(
        "[SorobanToken] balance read attempt failed:",
        err instanceof Error ? err.message : err,
      )
    }
  }

  return 0
}

export function getBlendUsdcContractId(network: "testnet" | "mainnet"): string {
  return getBlendUsdcAsset(network).contractId
}

/** Circle testnet USDC Stellar Asset Contract — what Stellar Expert often shows on C wallets. */
export function getCircleTestnetUsdcSacContractId(): string | null {
  const override = process.env.TESTNET_CIRCLE_USDC_SAC_CONTRACT_ADDRESS?.trim()
  if (override?.startsWith("C") && override.length === 56) {
    return override.toUpperCase()
  }
  try {
    const issuer =
      process.env.CIRCLE_TESTNET_USDC_ISSUER?.trim() ||
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    return new Asset("USDC", issuer).contractId(Networks.TESTNET)
  } catch {
    return null
  }
}

export async function getSorobanUsdcOnContractWallet(
  contractAddress: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<{ blend: number; circleSac: number; total: number }> {
  const wallet = normalizeHolderAddress(contractAddress)
  if (!wallet.startsWith("C") || wallet.length !== 56) {
    return { blend: 0, circleSac: 0, total: 0 }
  }

  const blend = await getSorobanTokenBalance(getBlendUsdcContractId(network), wallet, network)
  let circleSac = 0
  if (network === "testnet") {
    const sacId = getCircleTestnetUsdcSacContractId()
    if (sacId) {
      circleSac = await getSorobanTokenBalance(sacId, wallet, network)
    }
  }

  if (blend > 0 || circleSac > 0) {
    console.log("[SorobanToken] C wallet USDC:", {
      wallet,
      blend,
      circleSac,
      blendContract: getBlendUsdcContractId(network),
      sacContract: getCircleTestnetUsdcSacContractId(),
    })
  }

  return { blend, circleSac, total: blend + circleSac }
}

/** Spendable USDC on a C smart account (Blend + Circle SAC on testnet). */
export async function getWalletSpendableUsdcOnC(
  userPublicKey: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<number> {
  const pk = normalizeHolderAddress(userPublicKey)
  if (pk.startsWith("C") && pk.length === 56) {
    const { total } = await getSorobanUsdcOnContractWallet(pk, network)
    return total
  }
  return getDepositableUsdcBalance(userPublicKey, network)
}

/**
 * Balance available to deposit into a DeFindex vault.
 * When `depositAssetContractId` is set, reads that token only (vault deposit asset).
 * Otherwise uses legacy defaults (Blend on testnet C, Horizon USDC on mainnet G).
 */
export async function getDepositableUsdcBalance(
  userPublicKey: string,
  network: "testnet" | "mainnet" = "testnet",
  depositAssetContractId?: string | null,
): Promise<number> {
  const pk = normalizeHolderAddress(userPublicKey)

  if (depositAssetContractId?.startsWith("C") && depositAssetContractId.length === 56) {
    return getSorobanTokenBalance(depositAssetContractId, pk, network)
  }

  if (pk.startsWith("C") && pk.length === 56) {
    const { blend } = await getSorobanUsdcOnContractWallet(pk, network)
    return blend
  }

  if (network === "testnet" && pk.startsWith("G")) {
    return getSorobanTokenBalance(getBlendUsdcContractId("testnet"), pk, "testnet")
  }

  if (network === "mainnet") {
    const { getUSDCBalance } = await import("@/lib/turnkey/stellar-wallet")
    return getUSDCBalance(userPublicKey)
  }

  return getSorobanTokenBalance(getBlendUsdcContractId("testnet"), pk, "testnet")
}
