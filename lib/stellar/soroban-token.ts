/**
 * Soroban token helpers.
 *
 * Reads the balance of a Soroban token contract (SEP-0041 / standard token
 * interface) for a given user address. This is used to check BlendUSDC
 * holdings on testnet, which is a Soroban contract rather than a classic
 * Stellar asset and therefore doesn't appear in Horizon account balances.
 */

import {
  Contract,
  Address,
  Account,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  scValToNative,
} from "@stellar/stellar-sdk"
import * as rpc from "@stellar/stellar-sdk/rpc"
import { Api } from "@stellar/stellar-sdk/rpc"

const DUMMY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const STROOPS_PER_UNIT = 10_000_000

/**
 * Read the Soroban token balance for `userAddress` from contract `tokenAddress`.
 * Returns a decimal value (divided by 10^7).
 *
 * Returns 0 on any RPC / simulation failure rather than throwing, so callers
 * can use it as a best-effort check.
 */
export async function getSorobanTokenBalance(
  tokenAddress: string,
  userAddress: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<number> {
  try {
    const rpcUrl =
      process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
      (network === "mainnet"
        ? "https://soroban.stellar.org"
        : "https://soroban-testnet.stellar.org")

    const networkPassphrase =
      network === "mainnet"
        ? Networks.PUBLIC
        : Networks.TESTNET

    const server = new rpc.Server(rpcUrl, { allowHttp: network === "testnet" })
    const contract = new Contract(tokenAddress)

    const tempAccount = new Account(DUMMY_ACCOUNT, "0")
    const tx = new TransactionBuilder(tempAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(contract.call("balance", Address.fromString(userAddress).toScVal()))
      .setTimeout(10)
      .build()

    const result = await server.simulateTransaction(tx)

    if (Api.isSimulationError(result)) {
      console.warn("[SorobanToken] balance() simulation error:", (result as any).error)
      return 0
    }

    if (!Api.isSimulationSuccess(result) || !result.result) {
      return 0
    }

    const raw = scValToNative(result.result.retval)
    // SEP-0041 balance() returns i128 — scValToNative gives bigint or number
    const stroops = typeof raw === "bigint" ? raw : BigInt(String(raw))
    return Number(stroops) / STROOPS_PER_UNIT
  } catch (err) {
    console.warn(
      "[SorobanToken] getSorobanTokenBalance failed:",
      err instanceof Error ? err.message : err
    )
    return 0
  }
}

/**
 * Get the depositable BlendUSDC balance for a user on the active network.
 *
 * On testnet: reads the Soroban BlendUSDC token contract.
 * On mainnet: delegates to the classic Stellar getUSDCBalance (Circle USDC).
 */
export async function getDepositableUsdcBalance(
  userPublicKey: string,
  network: "testnet" | "mainnet" = "testnet"
): Promise<number> {
  if (network === "testnet") {
    const blendUsdcAddress =
      process.env.TESTNET_USDC_CONTRACT_ADDRESS ??
      "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU"
    return getSorobanTokenBalance(blendUsdcAddress, userPublicKey, "testnet")
  }

  // Mainnet: classic Stellar USDC
  const { getUSDCBalance } = await import("@/lib/turnkey/stellar-wallet")
  return getUSDCBalance(userPublicKey)
}
