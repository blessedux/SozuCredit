"use client";

/**
 * Deposit USDC into a faucet vault from the user's own smart account.
 * Trimmed version of the wallet send flow (hooks/use-send-payment.ts):
 * fixed recipient (the vault contract), USDC-only amount, passkey signing.
 */

import { useCallback, useState } from "react";
import { getUserId } from "@/lib/wallet-utils";

export type FaucetDepositPhase = "preparing" | "signing" | "submitting";

function getStoredWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("stellar_public_key") ??
    sessionStorage.getItem("stellar_public_key")
  );
}

export function useFaucetDeposit() {
  const [isDepositing, setIsDepositing] = useState(false);
  const [phase, setPhase] = useState<FaucetDepositPhase | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (params: {
      vaultAddress: string;
      amount: number;
    }): Promise<{ txHash: string } | null> => {
      const { vaultAddress, amount } = params;
      setError(null);

      if (!Number.isFinite(amount) || amount <= 0) {
        setError("invalid_amount");
        return null;
      }

      const userId = getUserId();
      const stored = getStoredWalletAddress()?.trim().toUpperCase() ?? "";
      if (!userId || !stored.startsWith("C")) {
        setError("not_authenticated");
        return null;
      }

      setIsDepositing(true);
      setPhase("preparing");

      try {
        // Align wallet material (C account, signer G, credential id).
        let senderC = stored;
        let passkeySignerG: string | undefined;
        let sessionCredentialId: string | undefined;
        try {
          const { alignWalletForSendFast } = await import("@/lib/wallet/align-send-wallet");
          const aligned = await alignWalletForSendFast(userId, senderC);
          senderC = aligned.contractId;
          passkeySignerG = aligned.signerG;
          sessionCredentialId = aligned.credentialId;
        } catch {
          /* server will supply signer_public_key */
        }

        // Build the unsigned Soroban transfer (user C → vault C).
        const buildResponse = await fetch("/api/wallet/stellar/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({
            destination: vaultAddress,
            amount: amount.toString(),
            sender: senderC,
            ...(passkeySignerG ? { signer: passkeySignerG } : {}),
          }),
        });
        if (!buildResponse.ok) {
          const err = (await buildResponse.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || "build_failed");
        }
        const build = (await buildResponse.json()) as Record<string, unknown>;

        const unsignedXdr =
          typeof build.unsignedXdr === "string"
            ? build.unsignedXdr
            : typeof build.envelopeXdr === "string"
              ? build.envelopeXdr
              : null;
        if (!unsignedXdr) throw new Error("build_failed");

        const signMethod = build.signMethod as string | undefined;
        const signerPublicKey =
          typeof build.signerPublicKey === "string" && build.signerPublicKey.startsWith("G")
            ? build.signerPublicKey
            : passkeySignerG ?? null;
        if (!signerPublicKey) throw new Error("signer_missing");

        const { getCurrentCredentialId, storeCredentialIdInSession } = await import(
          "@/lib/storage/key-utils"
        );
        const credentialId =
          (typeof build.ozCredentialId === "string" ? build.ozCredentialId : null) ||
          sessionCredentialId ||
          (await getCurrentCredentialId(signerPublicKey));
        if (!credentialId) throw new Error("credential_missing");
        storeCredentialIdInSession(credentialId);

        const walletContractId =
          typeof build.walletAddress === "string" && build.walletAddress.startsWith("C")
            ? build.walletAddress.trim().toUpperCase()
            : senderC;

        setPhase("signing");

        let signedEnvelopeXdr: string;
        if (signMethod === "oz_passkey" || signMethod === "oz_passkey_local") {
          const { getSmartAccountKit } = await import("@/lib/stellar/smartAccounts/client");
          const { signSorobanPreparedTxWithPasskey } = await import(
            "@/lib/stellar/smartAccounts/signSorobanUsdc"
          );
          const { extractSorobanDataXdr } = await import("@/lib/stellar/soroban-prepared-envelope");
          const { kit, config } = await getSmartAccountKit();
          const sorobanDataXdr =
            typeof build.sorobanDataXdr === "string" && build.sorobanDataXdr.length > 0
              ? build.sorobanDataXdr
              : extractSorobanDataXdr(unsignedXdr, config.networkPassphrase);
          signedEnvelopeXdr = await signSorobanPreparedTxWithPasskey({
            kit,
            unsignedXdr,
            sorobanDataXdr,
            networkPassphrase: config.networkPassphrase,
            credentialId,
            smartAccountContractId: walletContractId,
            webauthnVerifierAddress: config.webauthnVerifierAddress,
            supportsOzKitApi: build.supportsOzKitApi === true,
            signMethod: signMethod ?? "oz_passkey",
          });
        } else if (signMethod === "smart_g_signer") {
          const { signSorobanUsdcWithGSigner } = await import(
            "@/lib/stellar/smartAccounts/signSorobanTransferG"
          );
          const { getStellarConfig } = await import("@/lib/turnkey/config");
          const { Networks } = await import("@stellar/stellar-sdk");
          const networkPassphrase =
            getStellarConfig().network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
          signedEnvelopeXdr = await signSorobanUsdcWithGSigner({
            unsignedXdr,
            signerPublicKey,
            credentialId,
            userId,
            networkPassphrase,
          });
        } else {
          throw new Error(`unsupported_sign_method:${signMethod ?? "unknown"}`);
        }

        setPhase("submitting");

        const submitResponse = await fetch("/api/wallet/stellar/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": userId },
          body: JSON.stringify({ signedEnvelopeXdr }),
        });
        if (!submitResponse.ok) {
          const err = (await submitResponse.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || "submit_failed");
        }
        const result = (await submitResponse.json()) as {
          success?: boolean;
          transactionHash?: string;
        };
        if (result.success !== true || !result.transactionHash) {
          throw new Error("submit_failed");
        }

        return { txHash: result.transactionHash };
      } catch (err) {
        console.error("[Faucet Deposit]", err);
        setError(err instanceof Error ? err.message : "deposit_failed");
        return null;
      } finally {
        setIsDepositing(false);
        setPhase(null);
      }
    },
    [],
  );

  return { deposit, isDepositing, phase, error, clearError: () => setError(null) };
}
