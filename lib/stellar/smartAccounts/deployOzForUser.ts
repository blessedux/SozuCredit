"use client"

import type { SmartAccountKit } from "smart-account-kit"
import { Address, hash, rpc, StrKey, xdr } from "@stellar/stellar-sdk"
import base64url from "base64url"
import { Client as SmartAccountClient } from "smart-account-kit-bindings"
import {
  buildExternalSignerKeyData,
  credentialIdToBuffer,
  resolveCredentialIdBytes,
} from "@/lib/stellar/smartAccounts/passkeyPublicKey"

/** Kit fields used for deploy — avoid intersecting SmartAccountKit (private fields break types). */
type KitDeployInternals = {
  deployerKeypair: { publicKey(): string }
  networkPassphrase: string
  rpcUrl: string
  accountWasmHash: string
  webauthnVerifierAddress: string
  timeoutInSeconds?: number
  signWithDeployer: (tx: { sign: (opts: unknown) => Promise<void>; signed?: unknown; send: () => Promise<unknown> }) => Promise<void>
  setConnectedState?: (contractId: string, credentialId: string) => void
  initializeWallet?: (contractId: string) => void
}

function asDeployKit(kit: SmartAccountKit): KitDeployInternals {
  return kit as unknown as KitDeployInternals
}

function sorobanServer(rpcUrl: string): rpc.Server {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") })
}

/** Per-user deploy salt so a new account does not reuse another user's C for the same passkey. */
export function ozDeploySalt(credentialId: string, userId: string): Buffer {
  const credBuf = base64url.toBuffer(credentialId)
  return hash(Buffer.concat([credBuf, Buffer.from(userId.trim(), "utf8")]))
}

export function deriveOzContractIdForUser(params: {
  credentialId: string
  userId: string
  networkPassphrase: string
  deployerPublicKey: string
}): string {
  const salt = ozDeploySalt(params.credentialId, params.userId)
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: hash(Buffer.from(params.networkPassphrase)),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(params.deployerPublicKey).toScAddress(),
          salt,
        }),
      ),
    }),
  )
  return StrKey.encodeContract(hash(preimage.toXDR()))
}

export async function isOzContractDeployedOnChain(
  rpcUrl: string,
  contractId: string,
): Promise<boolean> {
  try {
    await sorobanServer(rpcUrl).getContractData(
      contractId,
      xdr.ScVal.scvLedgerKeyContractInstance(),
    )
    return true
  } catch {
    return false
  }
}

async function waitForContractOnChain(rpcUrl: string, contractId: string, maxMs = 45_000): Promise<void> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (await isOzContractDeployedOnChain(rpcUrl, contractId)) return
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(
    `Deployed smart account ${contractId.slice(0, 8)}… is not visible on Soroban RPC yet. Retry wallet setup in a moment.`,
  )
}

function contractIdFromDeploySend(sent: {
  result?: { options?: { contractId?: string } }
  getTransactionResponse?: { status?: string; returnValue?: unknown }
}): string | null {
  try {
    const fromClient = sent.result?.options?.contractId?.trim().toUpperCase()
    if (fromClient?.startsWith("C") && fromClient.length === 56) return fromClient
  } catch {
    /* fall through */
  }
  const rv = sent.getTransactionResponse?.returnValue
  if (rv) {
    try {
      const addr = Address.fromScVal(rv as xdr.ScVal).toString().trim().toUpperCase()
      if (addr.startsWith("C") && addr.length === 56) return addr
    } catch {
      /* ignore */
    }
  }
  return null
}

function isContractAlreadyExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("ExistingValue") || msg.includes("contract already exists")
}

function activateKitWallet(
  kit: KitDeployInternals,
  contractId: string,
  credentialId: string,
): void {
  kit.setConnectedState?.(contractId, credentialId)
  kit.initializeWallet?.(contractId)
}

/**
 * Deploy OZ smart account with user-scoped salt (not kit default hash(credentialId) only).
 */
export async function deployOzSmartAccountForUser(params: {
  kit: SmartAccountKit
  credentialId: string
  publicKey65: Uint8Array
  userId: string
}): Promise<{ contractId: string }> {
  const kit = asDeployKit(params.kit)
  const derivedId = deriveOzContractIdForUser({
    credentialId: params.credentialId,
    userId: params.userId,
    networkPassphrase: kit.networkPassphrase,
    deployerPublicKey: kit.deployerKeypair.publicKey(),
  })

  if (await isOzContractDeployedOnChain(kit.rpcUrl, derivedId)) {
    activateKitWallet(kit, derivedId, params.credentialId)
    return { contractId: derivedId }
  }

  // Match smart-account-kit: suffix is raw credential id bytes (prefer stored rawId).
  const credentialIdBuffer = resolveCredentialIdBytes(params.credentialId)
  const salt = ozDeploySalt(params.credentialId, params.userId)
  const keyData = buildExternalSignerKeyData(params.publicKey65, credentialIdBuffer)
  const signer = {
    tag: "External" as const,
    values: [kit.webauthnVerifierAddress, keyData] as [string, Buffer],
  }

  try {
    const deployTx = await SmartAccountClient.deploy(
      { signers: [signer], policies: new Map() },
      {
        networkPassphrase: kit.networkPassphrase,
        rpcUrl: kit.rpcUrl,
        wasmHash: kit.accountWasmHash,
        publicKey: kit.deployerKeypair.publicKey(),
        salt,
        timeoutInSeconds: kit.timeoutInSeconds ?? 30,
      },
    )

    await kit.signWithDeployer(deployTx as Parameters<KitDeployInternals["signWithDeployer"]>[0])
    const sent = (await (deployTx as { send: () => Promise<unknown> }).send()) as {
      result?: { options?: { contractId?: string } }
      getTransactionResponse?: { status?: string; returnValue?: unknown }
      sendTransactionResponse?: { hash?: string }
    }

    const status = sent.getTransactionResponse?.status
    const txHash = sent.sendTransactionResponse?.hash
    if (status === "FAILED") {
      throw new Error(
        `Smart account deploy failed on-chain.${txHash ? ` Tx: ${txHash}.` : ""} Check Soroban explorer.`,
      )
    }
    if (status !== "SUCCESS") {
      if (await isOzContractDeployedOnChain(kit.rpcUrl, derivedId)) {
        activateKitWallet(kit, derivedId, params.credentialId)
        return { contractId: derivedId }
      }
      throw new Error(
        `Smart account deploy did not succeed (status=${status ?? "unknown"}).${txHash ? ` Tx: ${txHash}.` : ""} ` +
          "The OpenZeppelin kit deployer may need testnet XLM — fund the deployer G address from smart-account-kit docs.",
      )
    }

    const contractId = contractIdFromDeploySend(sent) ?? derivedId
    if (contractId !== derivedId) {
      console.warn("[deployOzSmartAccountForUser] on-chain C differs from local derivation", {
        deployed: contractId.slice(0, 12),
        derived: derivedId.slice(0, 12),
      })
    }

    await waitForContractOnChain(kit.rpcUrl, contractId)
    activateKitWallet(kit, contractId, params.credentialId)
    return { contractId }
  } catch (err) {
    if (isContractAlreadyExistsError(err) || (await isOzContractDeployedOnChain(kit.rpcUrl, derivedId))) {
      activateKitWallet(kit, derivedId, params.credentialId)
      return { contractId: derivedId }
    }
    throw err
  }
}
