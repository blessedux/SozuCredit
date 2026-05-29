"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { Transaction, Networks } from "@stellar/stellar-sdk";

const CTA_CLASS =
  "inline-flex items-center justify-center gap-2 w-full rounded-xl border border-orange-400/35 bg-orange-500/15 hover:bg-orange-500/25 active:bg-orange-500/30 backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed text-orange-100 font-semibold py-3 px-6 transition-colors";

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
        const d = (await res.json().catch(() => ({}))) as { organizationName?: string };
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
      setError("No encontramos tu billetera. Iniciá sesión primero.");
      return;
    }

    setStatus("busy");

    const authHeaders: HeadersInit = {
      ...(wallet.userId ? { "x-user-id": wallet.userId } : {}),
      ...(wallet.publicKey ? { "x-stellar-public-key": wallet.publicKey } : {}),
    };

    try {
      const chRes = await fetch("/api/sdp/sep10/challenge", {
        credentials: "include",
        headers: authHeaders,
      });
      const chData = (await chRes.json().catch(() => ({}))) as {
        transaction_xdr?: string;
        network_passphrase?: string;
        server_account_id?: string;
        web_auth_domain?: string;
        home_domains?: string[];
        error?: string;
      };
      if (!chRes.ok) throw new Error(chData.error ?? "No se pudo iniciar la autenticación");

      const networkPassphrase =
        chData.network_passphrase ??
        (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
          ? Networks.PUBLIC
          : Networks.TESTNET);

      const tx = new Transaction(chData.transaction_xdr as string, networkPassphrase);

      const { signTransactionWithPasskeyApproval } = await import(
        "@/lib/stellar/client-signing"
      );
      const signed = await signTransactionWithPasskeyApproval(
        tx,
        wallet.credentialId ?? "",
        wallet.publicKey,
        wallet.userId ?? ""
      );

      const tokRes = await fetch("/api/sdp/sep10/token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          transaction_xdr: signed.transactionXdr,
          network_passphrase: networkPassphrase,
          server_account_id: chData.server_account_id,
          web_auth_domain: chData.web_auth_domain,
          home_domains: chData.home_domains,
        }),
      });
      const tokData = (await tokRes.json().catch(() => ({}))) as { error?: string };
      if (!tokRes.ok) throw new Error(tokData.error ?? "No se pudo completar la autenticación");

      const depRes = await fetch("/api/sdp/sep24/deposit", {
        method: "POST",
        credentials: "include",
        headers: authHeaders,
      });
      const depData = (await depRes.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!depRes.ok) throw new Error(depData.error ?? "No se pudo iniciar la verificación");

      if (typeof depData.url === "string" && depData.url.startsWith("http")) {
        setStatus("done");
        window.location.assign(depData.url);
      } else {
        throw new Error("No se recibió la URL de verificación");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal. Intentá de nuevo.");
      setStatus("error");
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="max-w-sm mx-auto mt-12 space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">Tenés un pago esperándote</h1>
          <p className="text-sm text-white/55">
            Iniciá sesión con tu passkey para recibirlo.
          </p>
        </div>
        <Link href="/auth?sdpInvite=1" className={CTA_CLASS}>
          <Fingerprint className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
          Iniciar sesión con passkey
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-12 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-white text-center">
          {status === "done" ? "Redirigiendo…" : "Recibir tu pago"}
        </h1>
        {orgName && (
          <p className="text-sm text-white/55 text-center">
            de <span className="text-white">{orgName}</span>
          </p>
        )}
      </div>

      {status !== "done" && (
        <button
          type="button"
          onClick={() => void requestFunds()}
          disabled={status === "busy"}
          className={CTA_CLASS}
        >
          {status === "busy" ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-orange-200/30 border-t-orange-100 animate-spin" />
              Autenticando…
            </>
          ) : (
            <>
              <Fingerprint className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              Solicitar fondos
            </>
          )}
        </button>
      )}

      {status === "busy" && (
        <p className="text-xs text-white/45 text-center">
          Aparecerá el prompt de passkey. Confirmá con tu huella, rostro o PIN del dispositivo.
        </p>
      )}

      {(status === "idle" || status === "error") && (
        <p className="text-xs text-white/40 text-center">
          Verás una confirmación con passkey y luego te redirigiremos para completar tu verificación
          de identidad.
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 p-3">
          <p className="text-sm text-red-400">{error}</p>
          {error.includes("billetera") && (
            <Link href="/auth?sdpInvite=1" className="text-xs text-red-300 underline mt-1 block">
              Iniciar sesión de nuevo
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
