"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Transaction, Networks } from "@stellar/stellar-sdk";

type WalletState = {
  publicKey: string | null;
  credentialId: string | null;
  userId: string | null;
};

type Status = "idle" | "busy" | "done" | "error";

export function SdpRegisterFlow() {
  const [wallet, setWallet] = useState<WalletState>({
    publicKey: null,
    credentialId: null,
    userId: null,
  });
  const [orgName, setOrgName] = useState<string>("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(() => {
    if (typeof window === "undefined") return;
    setWallet({
      publicKey: sessionStorage.getItem("stellar_public_key"),
      credentialId: sessionStorage.getItem("credential_id"),
      userId: sessionStorage.getItem("dev_username"),
    });
  }, []);

  const loadOrgName = useCallback(async () => {
    try {
      const res = await fetch("/api/sdp/context", { credentials: "include" });
      if (res.ok) {
        const d = await res.json().catch(() => ({})) as { organizationName?: string };
        if (d.organizationName) setOrgName(d.organizationName);
      }
    } catch {
      // non-fatal — org name is just display text
    }
  }, []);

  useEffect(() => {
    loadWallet();
    loadOrgName();
    window.addEventListener("storage", loadWallet);
    return () => window.removeEventListener("storage", loadWallet);
  }, [loadWallet, loadOrgName]);

  /**
   * Single action: SEP-10 passkey sign → SEP-24 deposit redirect.
   * Trustline is handled automatically by the wallet creation flow.
   */
  const requestFunds = async () => {
    setError(null);
    if (!wallet.publicKey) {
      setError("No wallet found. Please sign in first.");
      return;
    }

    setStatus("busy");
    try {
      // ── Step 1: SEP-10 challenge ──────────────────────────────────────────
      const chRes = await fetch("/api/sdp/sep10/challenge", { credentials: "include" });
      const chData = await chRes.json().catch(() => ({})) as {
        transaction_xdr?: string;
        network_passphrase?: string;
        server_account_id?: string;
        web_auth_domain?: string;
        home_domains?: string[];
        error?: string;
      };
      if (!chRes.ok) throw new Error(chData.error ?? "Could not start authentication");

      const networkPassphrase =
        chData.network_passphrase ??
        (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
          ? Networks.PUBLIC
          : Networks.TESTNET);

      const tx = new Transaction(chData.transaction_xdr as string, networkPassphrase);

      // ── Step 2: Sign with passkey (biometric prompt) ──────────────────────
      const { signTransactionWithPasskeyApproval } = await import(
        "@/lib/stellar/client-signing"
      );
      const signed = await signTransactionWithPasskeyApproval(
        tx,
        wallet.credentialId ?? "",
        wallet.publicKey,
        wallet.userId ?? ""
      );

      // ── Step 3: Exchange signed XDR for SDP JWT ───────────────────────────
      const tokRes = await fetch("/api/sdp/sep10/token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_xdr: signed.transactionXdr,
          network_passphrase: networkPassphrase,
          server_account_id: chData.server_account_id,
          web_auth_domain: chData.web_auth_domain,
          home_domains: chData.home_domains,
        }),
      });
      const tokData = await tokRes.json().catch(() => ({})) as { error?: string };
      if (!tokRes.ok) throw new Error(tokData.error ?? "Authentication failed");

      // ── Step 4: Start SEP-24 deposit → redirect to verification ──────────
      const depRes = await fetch("/api/sdp/sep24/deposit", {
        method: "POST",
        credentials: "include",
      });
      const depData = await depRes.json().catch(() => ({})) as { url?: string; error?: string };
      if (!depRes.ok) throw new Error(depData.error ?? "Could not start verification");

      if (typeof depData.url === "string" && depData.url.startsWith("http")) {
        setStatus("done");
        window.location.assign(depData.url);
      } else {
        throw new Error("No verification URL returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  // ── Not yet signed in ────────────────────────────────────────────────────
  if (!wallet.publicKey) {
    return (
      <div className="max-w-sm mx-auto mt-12 space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">You have a payment waiting</h1>
          <p className="text-sm text-white/55">
            Sign in with your passkey to claim it.
          </p>
        </div>
        <Link
          href="/auth?sdpInvite=1"
          className="inline-flex items-center justify-center w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold py-3 px-6 transition-colors"
        >
          Sign in with passkey
        </Link>
      </div>
    );
  }

  // ── Signed in — single claim action ──────────────────────────────────────
  return (
    <div className="max-w-sm mx-auto mt-12 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-white text-center">
          {status === "done" ? "Redirecting…" : "Claim your payment"}
        </h1>
        {orgName && (
          <p className="text-sm text-white/55 text-center">
            from <span className="text-white">{orgName}</span>
          </p>
        )}
      </div>

      {status !== "done" && (
        <button
          type="button"
          onClick={() => void requestFunds()}
          disabled={status === "busy"}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 transition-colors flex items-center justify-center gap-2"
        >
          {status === "busy" ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Authenticating…
            </>
          ) : (
            "Request funds"
          )}
        </button>
      )}

      {status === "busy" && (
        <p className="text-xs text-white/45 text-center">
          Your passkey prompt will appear. Follow your device&apos;s biometric or PIN confirmation.
        </p>
      )}

      {(status === "idle" || status === "error") && (
        <p className="text-xs text-white/40 text-center">
          You&apos;ll see a passkey confirmation, then be redirected to complete your identity check.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 p-3">
          <p className="text-sm text-red-400">{error}</p>
          {error.includes("wallet") && (
            <Link href="/auth?sdpInvite=1" className="text-xs text-red-300 underline mt-1 block">
              Sign in again
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
