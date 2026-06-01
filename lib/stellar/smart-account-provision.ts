import "server-only"

import {
  Address,
  Asset,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { getStellarConfig } from "@/lib/turnkey/config"
import { resolveSorobanRpcUrl } from "@/lib/stellar/soroban-env"

function getNetworkPassphrase(): string {
  const cfg = getStellarConfig()
  return cfg.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET
}

function getSorobanRpcUrl(): string {
  return resolveSorobanRpcUrl()
}

function getFactoryId(): string | null {
  return process.env.SMART_ACCOUNT_FACTORY_ID?.trim() || null
}

async function getSmartAccountAddressFromView(
  server: rpc.Server,
  factoryId: string,
  signerPublicKey: string,
  funderKeypair: Keypair
): Promise<string | null> {
  const viewMethod = process.env.SMART_ACCOUNT_GET_ADDRESS_VIEW?.trim()
  if (!viewMethod) return null

  const networkPassphrase = getNetworkPassphrase()
  const account = await server.getAccount(funderKeypair.publicKey())
  const contract = new Contract(factoryId)
  const signerScVal = Address.fromString(signerPublicKey).toScVal()
  const op = contract.call(viewMethod, signerScVal)

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(30)
    .build()

  const sim = (await server.simulateTransaction(rawTx)) as {
    error?: string
    result?: { retval?: string }
  }
  if (sim.error != null || !sim.result?.retval) return null

  const retval = xdr.ScVal.fromXDR(sim.result.retval, "base64")
  const addr = Address.fromScVal(retval).toString()
  return addr.startsWith("C") ? addr : null
}

export async function deploySmartAccountForSigner(
  signerPublicKey: string
): Promise<{ contractId: string } | { error: string }> {
  const g = signerPublicKey.trim().toUpperCase()
  if (!/^G[A-Z0-9]{55}$/.test(g)) {
    return { error: "signerPublicKey must be a classic G address." }
  }

  const factoryId = getFactoryId()
  const rpcUrl = getSorobanRpcUrl()
  if (!factoryId) {
    const { describeMissingSmartWalletEnv } = await import("@/lib/stellar/soroban-env")
    return {
      error:
        describeMissingSmartWalletEnv() ||
        "Smart account factory not configured (SMART_ACCOUNT_FACTORY_ID).",
    }
  }

  const funderSecret = process.env.STELLAR_FUNDER_SECRET?.trim()
  if (!funderSecret) {
    return { error: "STELLAR_FUNDER_SECRET is not set." }
  }

  let funder: Keypair
  try {
    funder = Keypair.fromSecret(funderSecret)
  } catch {
    return { error: "Invalid STELLAR_FUNDER_SECRET." }
  }

  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
  const networkPassphrase = getNetworkPassphrase()

  let account
  try {
    account = await server.getAccount(funder.publicKey())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Funder account not on Soroban RPC: ${msg}` }
  }

  const knownAddress = await getSmartAccountAddressFromView(server, factoryId, g, funder)
  const contract = new Contract(factoryId)
  const methodName = process.env.SMART_ACCOUNT_FACTORY_METHOD?.trim() || "create_account"
  const op = contract.call(methodName, Address.fromString(g).toScVal())

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(60)
    .build()

  try {
    const preparedTx = await server.prepareTransaction(rawTx)
    preparedTx.sign(funder)
    const result = await server.sendTransaction(preparedTx)
    if (result.status === "ERROR") {
      return { error: `Factory deploy failed: ${String(result.errorResult)}` }
    }
    const contractId = knownAddress
    if (!contractId) {
      return {
        error:
          "Smart account deployed but contract id unknown. Set SMART_ACCOUNT_GET_ADDRESS_VIEW on the factory.",
      }
    }
    return { contractId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

export async function fundSmartAccountWithXlm(
  contractId: string,
  amount = "2"
): Promise<{ ok: true; hash: string } | { error: string }> {
  const c = contractId.trim().toUpperCase()
  if (!c.startsWith("C")) return { error: "contractId must be C…" }

  const funderSecret = process.env.STELLAR_FUNDER_SECRET?.trim()
  if (!funderSecret) return { error: "STELLAR_FUNDER_SECRET is not set." }

  let funder: Keypair
  try {
    funder = Keypair.fromSecret(funderSecret)
  } catch {
    return { error: "Invalid STELLAR_FUNDER_SECRET." }
  }

  const cfg = getStellarConfig()
  const horizon = new Horizon.Server(cfg.horizonUrl, {
    allowHttp: cfg.network === "testnet",
  })
  const networkPassphrase = getNetworkPassphrase()

  try {
    const source = await horizon.loadAccount(funder.publicKey())
    const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase })
      .addOperation(
        Operation.payment({
          destination: c,
          asset: Asset.native(),
          amount,
        })
      )
      .setTimeout(30)
      .build()
    tx.sign(funder)
    const result = await horizon.submitTransaction(tx)
    if (!result.successful) {
      return { error: "XLM funding transaction failed." }
    }
    return { ok: true, hash: result.hash }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.toLowerCase().includes("insufficient")) {
      return { error: "Funder has insufficient XLM." }
    }
    return { error: msg }
  }
}

export async function provisionSmartWalletForSigner(
  signerPublicKey: string
): Promise<
  | { contractId: string; signerPublicKey: string; funded: boolean }
  | { error: string }
> {
  const deployed = await deploySmartAccountForSigner(signerPublicKey)
  if ("error" in deployed) return deployed

  const fund = await fundSmartAccountWithXlm(deployed.contractId)
  return {
    contractId: deployed.contractId,
    signerPublicKey: signerPublicKey.trim().toUpperCase(),
    funded: "ok" in fund,
  }
}
