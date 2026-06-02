"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { Transaction, Networks } from "@stellar/stellar-sdk";
import {
  loadClientWalletSession,
  persistClientWalletSession,
} from "@/lib/client-wallet-session";
import { getSep10ClientAccountId } from "@/lib/sdp/sep10ClientAccount";
import { decodeSdpOrganizationName } from "@/lib/sdp/displayName";

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
type Step = "contact" | "funds";

function orgPaymentLabel(orgName: string): string {
  const label = decodeSdpOrganizationName(orgName) || orgName.trim();
  return label ? `Recibir pago de ${label}` : "Recibir tu pago";
}

export function SdpRegisterFlow() {
  const [wallet, setWallet] = useState<WalletState>({
    publicKey: null,
    credentialId: null,
    userId: null,
  });
  const [orgName, setOrgName] = useState("");
  const [requiresFullName, setRequiresFullName] = useState(false);
  const [requiresDateOfBirth, setRequiresDateOfBirth] = useState(false);
  const [hasInviteToken, setHasInviteToken] = useState(true);
  const [step, setStep] = useState<Step>("contact");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasWalletSession, setHasWalletSession] = useState(false);

  const paymentTitle = orgPaymentLabel(orgName);

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
      if (!res.ok) return;
      const d = (await res.json().catch(() => ({}))) as {
        organizationName?: string;
        needsEmailStep?: boolean;
        requiresFullName?: boolean;
        requiresDateOfBirth?: boolean;
        hasInviteToken?: boolean;
      };
      if (d.organizationName) setOrgName(d.organizationName);
      setRequiresFullName(Boolean(d.requiresFullName));
      setRequiresDateOfBirth(Boolean(d.requiresDateOfBirth));
      setHasInviteToken(d.hasInviteToken !== false);
      setStep(d.needsEmailStep === false ? "funds" : "contact");
    } catch {
      // non-fatal
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

  const saveContact = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Ingresá el correo que registró la organización.");
      return;
    }

    setStatus("busy");
    try {
      const res = await fetch("/api/sdp/verify-identity", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
          ...(dateOfBirth.trim() ? { date_of_birth: dateOfBirth.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No pudimos guardar tu correo.");

      setStep("funds");
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal. Intentá de nuevo.");
      setStatus("error");
    }
  };

  const ensureWalletReadyForSdp = async (
    userId: string,
    credentialId?: string
  ): Promise<{ publicKey: string; credentialId: string }> => {
    const cred =
      credentialId?.trim() ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("credential_id") ?? localStorage.getItem("credential_id")
        : null) ||
      undefined;

    if (!cred) {
      throw new Error(
        "No encontramos tu passkey. Cerrá sesión e iniciá de nuevo con passkey."
      );
    }

    const { alignWalletMaterialAfterLogin } = await import(
      "@/lib/storage/post-login-wallet"
    );
    const aligned = await alignWalletMaterialAfterLogin(userId, cred);
    if (aligned.needsWalletSync || !aligned.publicKey) {
      throw new Error(
        aligned.setupError ??
          "Tu billetera aún no está lista. Completá la configuración en la app e intentá de nuevo."
      );
    }

    persistClientWalletSession({
      userId,
      publicKey: aligned.publicKey,
      credentialId: cred,
    });

    return { publicKey: aligned.publicKey, credentialId: cred };
  };

  const requestFunds = async () => {
    setError(null);
    setStatus("busy");

    try {
      const freshSession = await loadClientWalletSession();
      const userId = freshSession.userId ?? wallet.userId ?? "";
      const credentialId =
        freshSession.credentialId ?? wallet.credentialId ?? undefined;

      if (!userId) {
        throw new Error("Iniciá sesión con passkey primero.");
      }

      const walletReady = await ensureWalletReadyForSdp(userId, credentialId);
      const { prepareSdpSigningMaterial } = await import(
        "@/lib/stellar/ensure-passkey-signer"
      );
      const syncedSigner = await prepareSdpSigningMaterial(
        userId,
        walletReady.credentialId
      );

      const authHeaders: HeadersInit = {
        "x-user-id": userId,
        "x-sep10-signer": syncedSigner.publicKey,
        "x-stellar-public-key": walletReady.publicKey,
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
      const userSignerG = syncedSigner.publicKey.trim().toUpperCase();
      const challengeClientG = getSep10ClientAccountId(tx);
      if (challengeClientG && challengeClientG !== userSignerG) {
        throw new Error(
          "La billetera del desafío no coincide con la tuya. Contactá soporte."
        );
      }

      const { signTransactionWithPasskeyApproval } = await import(
        "@/lib/stellar/client-signing"
      );
      const signed = await signTransactionWithPasskeyApproval(
        tx,
        syncedSigner.credentialId,
        userSignerG,
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
        <h1 className="text-xl font-semibold text-white">{paymentTitle}</h1>
        <p className="text-sm text-white/55">
          Entrá con passkey para continuar.
        </p>
        <Link href="/auth?sdpInvite=1" className={CTA_CLASS}>
          <Fingerprint className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
          Entrar con passkey
        </Link>
      </div>
    );
  }

  if (step === "contact") {
    return (
      <div className="max-w-sm mx-auto mt-12 space-y-6">
        <h1 className="text-xl font-semibold text-white text-center">{paymentTitle}</h1>
        <p className="text-sm text-white/55 text-center">
          Mismo correo que la organización tiene en el lote.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="sdp-email" className="block text-sm text-white/70 mb-1">
              Correo electrónico
            </label>
            <input
              id="sdp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className={INPUT_CLASS}
            />
          </div>
          {requiresFullName && (
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
                className={INPUT_CLASS}
              />
            </div>
          )}
          {requiresDateOfBirth && (
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
          )}
        </div>

        <button
          type="button"
          onClick={() => void saveContact()}
          disabled={status === "busy"}
          className={CTA_CLASS}
        >
          {status === "busy" ? "Guardando…" : "Continuar"}
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
      <h1 className="text-xl font-semibold text-white text-center">
        {status === "done" ? "Redirigiendo…" : paymentTitle}
      </h1>

      {status !== "done" && (
        <button
          type="button"
          onClick={() => void requestFunds()}
          disabled={status === "busy"}
          className={CTA_CLASS}
        >
          {status === "busy" ? (
            "Autenticando…"
          ) : (
            <>
              <Fingerprint className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              Confirmar con passkey
            </>
          )}
        </button>
      )}

      {status === "busy" && (
        <p className="text-xs text-white/45 text-center">
          Confirmá con huella, rostro o PIN del dispositivo.
        </p>
      )}

      {!hasInviteToken && (status === "idle" || status === "error") && (
        <p className="text-xs text-amber-300/90 text-center">
          Abrí de nuevo el enlace completo del correo de la organización.
        </p>
      )}

      {(status === "idle" || status === "error") && (
        <p className="text-xs text-white/45 text-center">
          En el siguiente paso solo ingresás el código OTP y tu fecha de nacimiento (ya
          cargamos tu correo acá).
        </p>
      )}

      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 p-3">
          <p className="text-sm text-red-400">{error}</p>
          {error.includes("billetera") || error.includes("passkey") ? (
            <button
              type="button"
              className="text-xs text-red-300 underline mt-1 block"
              onClick={() => {
                void (async () => {
                  const { clearClientSession } = await import("@/lib/storage/clear-session");
                  clearClientSession();
                  window.location.href = "/auth?sdpInvite=1";
                })();
              }}
            >
              Cerrar sesión e intentar de nuevo
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
