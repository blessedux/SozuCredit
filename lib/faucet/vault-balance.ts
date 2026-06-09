import "server-only";

import {
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import { getConfiguredFunderPublicKey } from "@/lib/stellar/soroban-fee-payer";
import { getStellarConfig } from "@/lib/turnkey/config";

const TOKEN_DECIMALS = 7;

function getFaucetContractId(): string | null {
  const id = process.env.FAUCET_CONTRACT_ID?.trim().toUpperCase();
  if (id?.startsWith("C") && id.length === 56) return id;
  return null;
}

function getSorobanRpcUrl(): string {
  const network = getStellarConfig().network;
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "testnet"
      ? "https://soroban-testnet.stellar.org"
      : "https://soroban.stellar.org")
  );
}

/** On-chain USDC balance held by the faucet vault contract (minor units). */
export async function getFaucetVaultBalanceMinor(): Promise<bigint | null> {
  const contractId = getFaucetContractId();
  const funderPk = getConfiguredFunderPublicKey();
  if (!contractId || !funderPk) return null;

  const cfg = getStellarConfig();
  if (cfg.network !== "testnet") return null;

  const server = new rpc.Server(getSorobanRpcUrl(), { allowHttp: true });
  const account = await server.getAccount(funderPk);
  const faucet = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(faucet.call("balance"))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (Api.isSimulationError(sim) || !sim.result?.retval) return null;

  const native = scValToNative(sim.result.retval);
  if (typeof native === "bigint") return native;
  if (typeof native === "number") return BigInt(Math.trunc(native));
  if (typeof native === "string") return BigInt(native);
  return null;
}

/** True when the vault contract can cover a claim of `amountUsdc`. */
export async function vaultCanCoverClaim(amountUsdc: number): Promise<boolean> {
  const minor = await getFaucetVaultBalanceMinor();
  if (minor === null) return true; // no contract configured — skip on-chain check
  return minor >= usdcToMinor(amountUsdc);
}

export function minorToUsdc(minor: bigint): number {
  return Number(minor) / 10 ** TOKEN_DECIMALS;
}

export function usdcToMinor(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** TOKEN_DECIMALS));
}
