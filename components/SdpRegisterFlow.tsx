"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { Transaction, Networks } from "@stellar/stellar-sdk";
import { loadClientWalletSession } from "@/lib/client-wallet-session";

const CTA_CLASS =
  "inline-flex items-center justify-center gap-2 w-full rounded-xl border border-orange-400/35 bg-orange-500/15 hover:bg-orange-500/25 active:bg-orange-500/30 backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed text-orange-100 font-semibold py-3 px-6 transition-colors";

const INPUT_CLASS =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-orange-400/40";

type WalletState = {
  publicKey: string | null;
  credentialId: string | null;
  userId: string | null;
};

type Status = "idle" | "busy" | "done" | "error";
type Step = "identity" | "funds";

export function SdpRegisterFlow() {
  const [wallet, setWallet] = useState<WalletState>({
    publicKey: null,
    credentialId: null,
    userId: null,
  });
  const [orgName, setOrgName] = useState<string>("");
  const [expectedEmailHint, setExpectedEmailHint] = useState<string | null>(null);
  const [expectedDobHint, setExpectedDobHint] = useState<string | null>(null);
  const [isTestnet, setIsTestnet] = useState(false);
  const [requiresIdentity, setRequiresIdentity] = useState(false);
  const [step, setStep] = useState<Step>("identity");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [identityVerified, setIdentityVerified] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasWalletSession, setHasWalletSession] = useState(false);

  const refreshWallet = useCallback(async () => {
    const session = await loadClientWalletSession();
    setWallet({
      publicKey: session.publicKey,
      credentialId: session.credentialId,
      userId: session.userId,
    });
    setHasWalletSession(session.isAuthenticated);
    setSessionReady(true);
  }, []);

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch("/api/sdp/context", { credentials: "include" });
      if (res.ok) {
        const d = (await res.json().catch(() => ({}))) as {
          organizationName?: string;
          requiresIdentityVerification?: boolean;
          expectedEmailHint?: string | null;
          expectedDateOfBirthHint?: string | null;
          isTestnet?: boolean;
        };
        if (d.organizationName) setOrgName(d.organizationName);
        setExpectedEmailHint(d.expectedEmailHint ?? null);
        setExpectedDobHint(d.expectedDateOfBirthHint ?? null);
        setIsTestnet(Boolean(d.isTestnet));
        const needsIdentity = Boolean(d.requiresIdentityVerification);
        setRequiresIdentity(needsIdentity);
        setStep(needsIdentity ? "identity" : "funds");
      }
    } catch {
      // non-fatal — org name is just display text
    }
  }, []);

  useEffect(() => {
    void refreshWallet();
    void loadContext();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshWallet();
    };
    window.addEventListener("storage", () => void refreshWallet());
    window.addEventListener("focus", () => void refreshWallet());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", () => void refreshWallet());
      window.removeEventListener("focus", () => void refreshWallet());
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshWallet, loadContext]);

  const verifyIdentity = async () => {
    setError(null);
    if (!fullName.trim() || !dateOfBirth.trim()) {
      setError("Completá tu nombre completo y fecha de nacimiento.");
      return;
    }

    setStatus("busy");
    try {
      const res = await fetch("/api/sdp/verify-identity", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          date_of_birth: dateOfBirth.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No pudimos verificar tu identidad.");

      setIdentityVerified(true);
      setStep("funds");
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal. Intentá de nuevo.");
      setStatus("error");
    }
  };

  /**
   * SEP-10 passkey sign → SEP-24 deposit redirect.
   */
  const requestFunds = async () => {
    setError(null);
    if (!wallet.publicKey) {
      setError("No encontramos tu billetera. Iniciá sesión primero.");
      return;
    }

    setStatus("busy");

    try {
      const freshSession = await loadClientWalletSession();
      const userId = freshSession.userId ?? wallet.userId ?? "";
      const credentialId =
        freshSession.credentialId ?? wallet.credentialId ?? undefined;

      if (!userId) {
        throw new Error("No encontramos tu sesión. Iniciá sesión primero.");
      }

      const { syncPasskeySignerToServer } = await import(
        "@/lib/stellar/ensure-passkey-signer"
      );
      const syncedSigner = await syncPasskeySignerToServer(userId, credentialId);

      const authHeaders: HeadersInit = {
        "x-user-id": userId,
        "x-sep10-signer": syncedSigner.publicKey,
        ...(wallet.publicKey ? { "x-stellar-public-key": wallet.publicKey } : {}),
      };

      const chRes = await fetch("/api/sdp/sep10/challenge", {
        credentials: "include",
        headers: authHeaders,
        cache: "no-store",
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
      const sep10Signer = tx.source.trim().toUpperCase();

      const { signTransactionWithPasskeyApproval } = await import(
        "@/lib/stellar/client-signing"
      );
      const signed = await signTransactionWithPasskeyApproval(
        tx,
        syncedSigner.credentialId,
        sep10Signer,
        userId
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

  if (!sessionReady) {
    return (
      <div className="max-w-sm mx-auto mt-12 flex justify-center">
        <span className="h-8 w-8 rounded-full border-2 border-orange-200/30 border-t-orange-100 animate-spin" />
      </div>
    );
  }

  if (!hasWalletSession) {
    return (
      <div className="max-w-sm mx-auto mt-12 space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">Tenés un pago esperándote</h1>
          <p className="text-sm text-white/55">
            Iniciá sesión o creá tu cuenta con passkey. Después volvés acá para recibir el pago.
          </p>
        </div>
        <Link href="/auth?sdpInvite=1" className={CTA_CLASS}>
          <Fingerprint className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
          Entrar con passkey
        </Link>
      </div>
    );
  }

  if (requiresIdentity && step === "identity" && !identityVerified) {
    return (
      <div className="max-w-sm mx-auto mt-12 space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-white text-center">Confirmá tu identidad</h1>
          {orgName && (
            <p className="text-sm text-white/55 text-center">
              Pago de <span className="text-white">{orgName}</span>
            </p>
          )}
          <p className="text-xs text-white/45 text-center pt-1">
            Ingresá los mismos datos que la organización registró para este beneficiario.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="sdp-full-name" className="block text-sm text-white/70 mb-1">
              Nombre completo
            </label>
            <input
              id="sdp-full-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. María García"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="sdp-dob" className="block text-sm text-white/70 mb-1">
              Fecha de nacimiento
            </label>
            <input
              id="sdp-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void verifyIdentity()}
          disabled={status === "busy"}
          className={CTA_CLASS}
        >
          {status === "busy" ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-orange-200/30 border-t-orange-100 animate-spin" />
              Verificando…
            </>
          ) : (
            "Continuar"
          )}
        </button>

        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-800/50 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
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
        <div className="space-y-2 text-xs text-white/45 text-center">
          <p>Firmá con passkey para autorizar la recepción del pago en tu billetera.</p>
          <p className="text-white/35">
            En la pantalla del operador (SDP), usá el mismo correo y fecha de nacimiento que
            registró la organización para este beneficiario.
          </p>
          {expectedEmailHint && (
            <p>
              Correo esperado: <span className="text-white/70">{expectedEmailHint}</span>
            </p>
          )}
          {expectedDobHint && (
            <p>
              Fecha de nacimiento: <span className="text-white/70">{expectedDobHint}</span>
            </p>
          )}
          {isTestnet && (
            <p className="text-orange-200/70">
              Testnet: si no recibís el OTP por correo, probá el código{" "}
              <span className="font-mono text-white/80">000000</span> (válido en SDP testnet).
            </p>
          )}
        </div>
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
