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

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const STROOPS_PER_UNIT = 10_000_000

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

function stroopsToDecimal(stroops: bigint): number {
  return Number(stroops) / STROOPS_PER_UNIT
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
  return stroopsToDecimal(stroops)
}

/** Direct ledger read when simulation fails (e.g. archived state edge cases). */
async function readBalanceViaLedger(
  tokenAddress: string,
  holderAddress: string,
  network: "testnet" | "mainnet",
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
        return stroopsToDecimal(scValToBalanceStroops(val))
      }
    } catch {
      // try next key shape
    }
  }

  return null
}

/**
 * Read the Soroban token balance for `userAddress` from contract `tokenAddress`.
 * Returns a decimal value (divided by 10^7).
 */
export async function getSorobanTokenBalance(
  tokenAddress: string,
  userAddress: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<number> {
  const holder = normalizeHolderAddress(userAddress)
  const token = tokenAddress.trim().toUpperCase()

  const attempts = [
    () => readBalanceViaSimulate(token, holder, network),
    () => readBalanceViaLedger(token, holder, network),
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

function getBlendUsdcContractId(network: "testnet" | "mainnet"): string {
  if (network === "mainnet") {
    return (
      process.env.MAINNET_USDC_CONTRACT_ADDRESS?.trim() ||
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"
    )
  }
  return (
    process.env.TESTNET_USDC_CONTRACT_ADDRESS?.trim() ||
    "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"
  )
}

function getCircleTestnetUsdcSacContractId(): string | null {
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
      wallet: `${wallet.slice(0, 8)}…`,
      blend,
      circleSac,
    })
  }

  return { blend, circleSac, total: blend + circleSac }
}

export async function getDepositableUsdcBalance(
  userPublicKey: string,
  network: "testnet" | "mainnet" = "testnet",
): Promise<number> {
  const pk = normalizeHolderAddress(userPublicKey)
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
