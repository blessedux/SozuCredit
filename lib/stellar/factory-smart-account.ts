import "server-only"

import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"

function getNetworkPassphrase(): string {
  const cfg = getStellarConfig()
  return cfg.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

function getSorobanRpcUrl(): string | null {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    null
  )
}

/**
 * True when `contractId` is the factory smart account for classic signer `signerG`.
 */
export async function contractIsFactoryForSigner(
  contractId: string,
  signerG: string,
): Promise<boolean> {
  const factoryId = process.env.SMART_ACCOUNT_FACTORY_ID?.trim()
  const viewMethod = process.env.SMART_ACCOUNT_GET_ADDRESS_VIEW?.trim()
  const rpcUrl = getSorobanRpcUrl()
  const funderSecret = process.env.STELLAR_FUNDER_SECRET?.trim()

  const c = contractId.trim().toUpperCase()
  const g = signerG.trim().toUpperCase()
  if (!factoryId || !viewMethod || !rpcUrl || !funderSecret) return false
  if (!c.startsWith("C") || !g.startsWith("G")) return false

  let funder: Keypair
  try {
    funder = Keypair.fromSecret(funderSecret)
  } catch {
    return false
  }

  try {
    const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
    const account = await server.getAccount(funder.publicKey())
    const contract = new Contract(factoryId)
    const op = contract.call(viewMethod, Address.fromString(g).toScVal())
    const rawTx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: getNetworkPassphrase(),
    })
      .addOperation(op)
      .setTimeout(30)
      .build()

    const sim = (await server.simulateTransaction(rawTx)) as {
      error?: string
      result?: { retval?: string }
    }
    if (sim.error != null || !sim.result?.retval) return false

    const retval = xdr.ScVal.fromXDR(sim.result.retval, "base64")
    const addr = Address.fromScVal(retval).toString().trim().toUpperCase()
    return addr === c
  } catch {
    return false
  }
}
