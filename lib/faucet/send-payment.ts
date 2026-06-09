import "server-only";

/**
 * sendFaucetPayment — V1 testnet payout.
 *
 * Preferred rail: the deployed Sozu Faucet vault contract
 * (contracts/faucet, env FAUCET_CONTRACT_ID). The server (treasury G =
 * contract admin) invokes `claim(to, amount)` and the contract pays out
 * Circle USDC from its own balance.
 *
 * Fallback rail (no FAUCET_CONTRACT_ID): direct SEP-41 transfer from the
 * treasury G account.
 *
 * Deliberately isolated: this module is the only place that knows how faucet
 * funds move, so it can be swapped for mainnet USDC or a richer Soroban
 * faucet/campaign-vault contract without touching the claim API or UI.
 */

import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import { getAssetById, getBlendUsdcAsset } from "@/lib/stellar/asset-registry";
import { normalizeHolderAddress } from "@/lib/stellar/stellar-holder";
import { ensureTestnetAccountFunded } from "@/lib/stellar/soroban-fee-payer";
import { getStellarConfig } from "@/lib/turnkey/config";
import {
  getFaucetVaultBalanceMinor,
  minorToUsdc,
  vaultCanCoverClaim,
} from "@/lib/faucet/vault-balance";

const TOKEN_DECIMALS = 7;

export type SendFaucetPaymentParams = {
  toWalletAddress: string;
  /** Whole-token amount, e.g. 1 = 1 USDC. */
  amount: number;
  /** For logging/tracing only. */
  faucetSlug: string;
};

export type SendFaucetPaymentResult = {
  txHash: string;
};

function getTreasuryKeypair(): Keypair {
  const secret =
    process.env.FAUCET_TREASURY_SECRET?.trim() ||
    process.env.STELLAR_FUNDER_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Faucet treasury not configured. Set FAUCET_TREASURY_SECRET (or STELLAR_FUNDER_SECRET) in env.",
    );
  }
  try {
    return Keypair.fromSecret(secret);
  } catch {
    throw new Error("FAUCET_TREASURY_SECRET is not a valid Stellar secret key.");
  }
}

/** Deployed Sozu Faucet vault contract (contracts/faucet). */
function getFaucetContractId(): string | null {
  const id = process.env.FAUCET_CONTRACT_ID?.trim().toUpperCase();
  if (id?.startsWith("C") && id.length === 56) return id;
  return null;
}

/** Token to dispense on the fallback rail: Circle USDC SAC by default. */
function getFaucetTokenContractId(network: "testnet" | "mainnet"): string {
  const override = process.env.FAUCET_TOKEN_CONTRACT_ID?.trim().toUpperCase();
  if (override?.startsWith("C") && override.length === 56) return override;
  const circle = getAssetById("circle_usdc_sac", network);
  if (circle) return circle.contractId;
  return getBlendUsdcAsset(network).contractId;
}

function getSorobanRpcUrl(network: "testnet" | "mainnet"): string {
  return (
    process.env.SOROBAN_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() ||
    (network === "testnet"
      ? "https://soroban-testnet.stellar.org"
      : "https://soroban.stellar.org")
  );
}

function amountToI128ScVal(amount: number, decimals: number): xdr.ScVal {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid faucet amount: ${amount}`);
  }
  const minor = BigInt(Math.round(amount * 10 ** decimals));
  return nativeToScVal(minor, { type: "i128" });
}

async function waitForResult(
  server: rpc.Server,
  hash: string,
  maxAttempts = 45,
): Promise<"SUCCESS" | "FAILED" | "PENDING"> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const tx = await server.getTransaction(hash);
      if (tx.status === Api.GetTransactionStatus.SUCCESS) return "SUCCESS";
      if (tx.status === Api.GetTransactionStatus.FAILED) return "FAILED";
    } catch {
      /* NOT_FOUND — keep polling */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return "PENDING";
}

/** Build, sign with treasury, submit, and wait for a single-op Soroban tx. */
async function submitTreasuryInvocation(params: {
  operation: xdr.Operation;
  faucetSlug: string;
}): Promise<string> {
  const treasury = getTreasuryKeypair();
  const treasuryPk = treasury.publicKey();

  await ensureTestnetAccountFunded(treasuryPk);

  const server = new rpc.Server(getSorobanRpcUrl("testnet"), { allowHttp: true });
  const account = await server.getAccount(treasuryPk);

  const rawTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(params.operation)
    .setTimeout(60)
    .build();

  // Treasury is the tx source → its require_auth resolves to source-account
  // credentials, so the signature below is the only auth required.
  const prepared = await server.prepareTransaction(rawTx);
  prepared.sign(treasury);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR" || !sent.hash) {
    const detail = sent.errorResult
      ? sent.errorResult.result()?.switch?.().name ?? "unknown"
      : "no hash";
    throw new Error(
      `Faucet payment rejected by Soroban RPC (${detail}) [faucet=${params.faucetSlug}]`,
    );
  }

  const outcome = await waitForResult(server, sent.hash);
  if (outcome === "FAILED") {
    throw new Error(
      `Faucet payment failed on-chain (tx ${sent.hash.slice(0, 8)}…). ` +
        "Check the faucet vault / treasury USDC balance.",
    );
  }
  if (outcome === "PENDING") {
    throw new Error(
      `Faucet payment still pending after timeout (tx ${sent.hash.slice(0, 8)}…).`,
    );
  }
  return sent.hash;
}

export async function sendFaucetPayment(
  params: SendFaucetPaymentParams,
): Promise<SendFaucetPaymentResult> {
  const cfg = getStellarConfig();

  // V1 is explicitly testnet-only. Mainnet payout will be a different rail.
  if (cfg.network !== "testnet") {
    throw new Error("Faucet payments are testnet-only in V1.");
  }

  const to = normalizeHolderAddress(params.toWalletAddress);
  const amountScVal = amountToI128ScVal(params.amount, TOKEN_DECIMALS);
  const faucetContractId = getFaucetContractId();

  if (!(await vaultCanCoverClaim(params.amount))) {
    const minor = await getFaucetVaultBalanceMinor();
    const have = minor !== null ? minorToUsdc(minor) : 0;
    throw new Error(
      `Faucet vault underfunded: has ${have} USDC, need ${params.amount} USDC. ` +
        `Fund via ./scripts/faucet-vault.sh fund or lower FAUCET_CLAIM_AMOUNT.`,
    );
  }

  // Preferred: vault contract claim(to, amount), admin-gated.
  if (faucetContractId) {
    const faucet = new Contract(faucetContractId);
    const txHash = await submitTreasuryInvocation({
      operation: faucet.call("claim", Address.fromString(to).toScVal(), amountScVal),
      faucetSlug: params.faucetSlug,
    });
    return { txHash };
  }

  // Fallback: direct treasury SEP-41 transfer.
  const treasuryPk = getTreasuryKeypair().publicKey();
  const token = new Contract(getFaucetTokenContractId("testnet"));
  const txHash = await submitTreasuryInvocation({
    operation: token.call(
      "transfer",
      Address.fromString(treasuryPk).toScVal(),
      Address.fromString(to).toScVal(),
      amountScVal,
    ),
    faucetSlug: params.faucetSlug,
  });
  return { txHash };
}
