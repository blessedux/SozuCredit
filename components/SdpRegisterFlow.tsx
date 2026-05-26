"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Transaction, Networks } from "@stellar/stellar-sdk";

type WalletState = {
  publicKey: string | null;
  credentialId: string | null;
  userId: string | null;
};

type Step = "idle" | "sep10-busy" | "sep10-done" | "deposit-busy" | "done";

export function SdpRegisterFlow() {
  const [wallet, setWallet] = useState<WalletState>({
    publicKey: null,
    credentialId: null,
    userId: null,
  });
  const [orgName, setOrgName] = useState<string>("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pollTx, setPollTx] = useState<unknown[] | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  // Read wallet state from sessionStorage (SozuCredit stores keys here post-login)
  const loadWallet = useCallback(() => {
    if (typeof window === "undefined") return;
    setWallet({
      publicKey: sessionStorage.getItem("stellar_public_key"),
      credentialId: sessionStorage.getItem("credential_id"),
      userId: sessionStorage.getItem("dev_username"),
    });
  }, []);

  // Read invite org name from cookie via the context API
  const loadOrgName = useCallback(async () => {
    try {
      const res = await fetch("/api/sdp/sep10/challenge", { credentials: "include" });
      // We just want to check if the context loads; org name comes from a future info endpoint.
      // If it 400s with the "no wallet" error we still want to show the UI.
      if (res.status === 400) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        if (d.error?.includes("invitation")) {
          setOrgName("Unknown Organization");
        }
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    loadWallet();
    loadOrgName();
    window.addEventListener("storage", loadWallet);
    return () => window.removeEventListener("storage", loadWallet);
  }, [loadWallet, loadOrgName]);

  const runSep10WithPasskey = async () => {
    setError(null);
    if (!wallet.publicKey) {
      setError("No Stellar wallet found. Please set up your wallet first.");
      return;
    }
    if (!wallet.userId) {
      setError("Session missing. Please log in again.");
      return;
    }

    setStep("sep10-busy");
    try {
      // 1. Fetch challenge from SDP via our proxy
      const chRes = await fetch("/api/sdp/sep10/challenge", { credentials: "include" });
      const chData = await chRes.json().catch(() => ({})) as {
        transaction_xdr?: string;
        network_passphrase?: string;
        server_account_id?: string;
        web_auth_domain?: string;
        home_domains?: string[];
        error?: string;
      };
      if (!chRes.ok) throw new Error(chData.error ?? "Challenge request failed");

      // 2. Build the Stellar transaction from the XDR
      const networkPassphrase =
        chData.network_passphrase ??
        (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
          ? Networks.PUBLIC
          : Networks.TESTNET);
      const tx = new Transaction(chData.transaction_xdr as string, networkPassphrase);

      // 3. Sign with passkey — triggers biometric prompt + signs locally with IndexedDB keypair
      const { signTransactionWithPasskeyApproval } = await import(
        "@/lib/stellar/client-signing"
      );
      const signed = await signTransactionWithPasskeyApproval(
        tx,
        wallet.credentialId ?? "",
        wallet.publicKey,
        wallet.userId
      );

      const signedXdr = signed.transactionXdr;

      // 4. Submit signed XDR + context to our token route → gets JWT cookie
      const tokRes = await fetch("/api/sdp/sep10/token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_xdr: signedXdr,
          network_passphrase: networkPassphrase,
          server_account_id: chData.server_account_id,
          web_auth_domain: chData.web_auth_domain,
          home_domains: chData.home_domains,
        }),
      });
      const tokData = await tokRes.json().catch(() => ({})) as { error?: string };
      if (!tokRes.ok) throw new Error(tokData.error ?? "Token exchange failed");

      setStep("sep10-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
      setStep("idle");
    }
  };

  const openDeposit = async () => {
    setError(null);
    setStep("deposit-busy");
    try {
      const res = await fetch("/api/sdp/sep24/deposit", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Deposit start failed");
      const url = data.url;
      if (typeof url === "string" && url.startsWith("http")) {
        window.location.assign(url);
      } else {
        throw new Error("No interactive URL returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open verification page");
      setStep("sep10-done");
    }
  };

  const pollTransactions = async () => {
    setPollError(null);
    try {
      const res = await fetch("/api/sdp/sep24/transactions", { credentials: "include" });
      const data = await res.json().catch(() => ({})) as { transactions?: unknown[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Poll failed");
      setPollTx(data.transactions ?? []);
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "Poll failed");
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="space-y-4 max-w-lg">
        <h1 className="text-xl font-semibold">Disbursement registration</h1>
        <p className="text-sm text-gray-400">
          Sign in or create your Sozu account on the auth page (passkey). That derives your Stellar wallet. Then return here to continue disbursement registration.
        </p>
        <Link
          href="/auth?sdpInvite=1"
          className="inline-block rounded-md bg-white text-gray-900 py-2 px-4 text-sm font-medium"
        >
          Sign in or create account
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">Receive your payment</h1>
        {orgName && (
          <p className="text-sm text-gray-400 mt-1">
            From <span className="text-white">{orgName}</span>
          </p>
        )}
        <p className="text-sm text-gray-400 mt-1">
          Wallet{" "}
          <span className="text-gray-200 font-mono text-xs break-all">
            {wallet.publicKey}
          </span>
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Complete three steps to register your wallet and receive disbursements. Step 1 will prompt your biometric / passkey to sign in securely.
        </p>
      </div>

      {/* Step 1 — SEP-10 passkey authentication */}
      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">1. Authenticate with your passkey</h2>
        <p className="text-xs text-gray-400">
          Tap the button below. You will see a biometric / passkey prompt to securely prove ownership of your wallet.
        </p>
        {step === "sep10-done" ? (
          <p className="text-sm text-emerald-400">Authenticated with disbursement platform.</p>
        ) : (
          <>
            <button
              type="button"
              disabled={step === "sep10-busy"}
              onClick={() => void runSep10WithPasskey()}
              className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
            >
              {step === "sep10-busy" ? "Authenticating…" : "Authenticate"}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </>
        )}
      </section>

      {/* Step 2 — USDC trustline */}
      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">2. USDC trustline</h2>
        <p className="text-xs text-gray-400">
          Your wallet needs a USDC trustline to receive stablecoin payments. Check your wallet settings if you have not set one up.
        </p>
        <Link href="/wallet" className="text-sm text-blue-400 hover:underline">
          Check trustline in Wallet
        </Link>
      </section>

      {/* Step 3 — SEP-24 identity verification */}
      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">3. Complete identity verification</h2>
        <p className="text-xs text-gray-400">
          You will be redirected to the disbursement organization to complete phone or ID verification. Do not share any codes with third parties.
        </p>
        <button
          type="button"
          disabled={step !== "sep10-done" || step === ("deposit-busy" as Step)}
          onClick={() => void openDeposit()}
          className="rounded-md bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 px-4 py-2 text-sm font-medium"
        >
          {step === "deposit-busy" ? "Opening…" : "Continue to verification"}
        </button>
        {error && step === "sep10-done" && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </section>

      {/* Status poll */}
      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">Registration status</h2>
        <button
          type="button"
          disabled={step !== "sep10-done"}
          onClick={() => void pollTransactions()}
          className="rounded-md border border-white/20 px-4 py-2 text-sm disabled:opacity-50 text-white"
        >
          Refresh status
        </button>
        {pollError && <p className="text-sm text-red-400">{pollError}</p>}
        {pollTx && (
          <pre className="text-xs text-gray-400 overflow-auto max-h-48 p-2 bg-black/50 rounded">
            {JSON.stringify(pollTx, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
