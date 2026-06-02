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

const DOB_PLACEHOLDER = "1997-08-05";

function DobIsoInput({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const isoOk = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-white/70 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder={DOB_PLACEHOLDER}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} font-mono`}
      />
      {hint ? <p className="mt-1 text-xs text-white/40">{hint}</p> : null}
      {isoOk ? (
        <p className="mt-1 text-xs font-mono text-white/55">
          Formato SDP: {value.trim()}
        </p>
      ) : null}
    </div>
  );
}

type Step = "contact" | "passkey" | "otp" | "done";

type SdpDebug = {
  sep24Account?: string;
  stellarAccount?: string;
  depositAccount?: string;
  clientDomain?: string;
  transactionId?: string | null;
  verifiedEmail?: string;
  verifiedDateOfBirth?: string | null;
  verificationField?: string;
  verificationSent?: string;
  dobSource?: string;
  inviteExpectedDob?: string | null;
};

function orgPaymentLabel(orgName: string): string {
  const label = decodeSdpOrganizationName(orgName) || orgName.trim();
  return label ? `Recibir pago de ${label}` : "Recibir tu pago";
}

function DebugPanel({ debug }: { debug: SdpDebug | null }) {
  if (!debug) return null;
  return (
    <details className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-white/50">
      <summary className="cursor-pointer text-white/70">Debug SDP</summary>
      <ul className="mt-2 space-y-1 font-mono break-all">
        {debug.clientDomain && <li>client_domain: {debug.clientDomain}</li>}
        {debug.sep24Account && <li>sep24_account: {debug.sep24Account}</li>}
        {debug.stellarAccount && <li>signer_G: {debug.stellarAccount}</li>}
        {debug.depositAccount && <li>wallet_C: {debug.depositAccount}</li>}
        {debug.transactionId && <li>tx_id: {debug.transactionId}</li>}
        {debug.verifiedEmail && <li>email: {debug.verifiedEmail}</li>}
        {debug.verifiedDateOfBirth && <li>dob: {debug.verifiedDateOfBirth}</li>}
        {debug.verificationField && <li>verification_field: {debug.verificationField}</li>}
        {debug.verificationSent && <li>verification_sent: {debug.verificationSent}</li>}
        {debug.dobSource && <li>dob_source: {debug.dobSource}</li>}
        {debug.inviteExpectedDob && <li>invite_bd: {debug.inviteExpectedDob}</li>}
      </ul>
    </details>
  );
}

export function SdpRegisterFlow() {
  const [orgName, setOrgName] = useState("");
  const [step, setStep] = useState<Step>("contact");
  const [hasInviteToken, setHasInviteToken] = useState(true);
  const [isTestnet, setIsTestnet] = useState(false);
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<SdpDebug | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasWalletSession, setHasWalletSession] = useState(false);
  const [walletUserId, setWalletUserId] = useState<string | null>(null);
  const [walletCredentialId, setWalletCredentialId] = useState<string | null>(null);
  const [verificationField, setVerificationField] = useState("DATE_OF_BIRTH");

  const paymentTitle = orgPaymentLabel(orgName);

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch("/api/sdp/context", { credentials: "include" });
      if (!res.ok) return;
      const d = (await res.json().catch(() => ({}))) as {
        organizationName?: string;
        step?: Step | "invite_missing";
        hasInviteToken?: boolean;
        isTestnet?: boolean;
        verifiedEmail?: string | null;
        verifiedDateOfBirth?: string | null;
        transactionId?: string | null;
        verificationField?: string;
      };
      if (d.organizationName) setOrgName(d.organizationName);
      setHasInviteToken(d.hasInviteToken !== false);
      setIsTestnet(Boolean(d.isTestnet));
      if (d.verifiedEmail) setEmail(d.verifiedEmail);
      if (d.verifiedDateOfBirth) setDateOfBirth(d.verifiedDateOfBirth);
      if (d.verificationField) setVerificationField(d.verificationField);
      if (d.step && d.step !== "invite_missing") setStep(d.step);
      if (d.transactionId) {
        setDebug((prev) => ({ ...prev, transactionId: d.transactionId }));
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await loadClientWalletSession();
      setHasWalletSession(session.isAuthenticated);
      setWalletUserId(session.userId);
      setWalletCredentialId(session.credentialId);
      setSessionReady(true);
    })();
    void loadContext();
  }, [loadContext]);

  const saveContact = async () => {
    setError(null);
    if (!email.trim() || !dateOfBirth.trim()) {
      setError("Ingresá correo y fecha de nacimiento (AAAA-MM-DD).");
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
          date_of_birth: dateOfBirth.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No pudimos guardar tus datos.");
      setStep("passkey");
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus("error");
    }
  };

  const linkWalletWithPasskey = async () => {
    setError(null);
    setStatus("busy");
    try {
      const userId = walletUserId;
      const credentialId = walletCredentialId;
      if (!userId || !credentialId) {
        throw new Error("Iniciá sesión con passkey primero.");
      }

      const { alignWalletMaterialAfterLogin } = await import(
        "@/lib/storage/post-login-wallet"
      );
      const aligned = await alignWalletMaterialAfterLogin(userId, credentialId);
      if (aligned.needsWalletSync || !aligned.publicKey) {
        throw new Error(aligned.setupError ?? "Billetera no lista.");
      }
      persistClientWalletSession({
        userId,
        publicKey: aligned.publicKey,
        credentialId,
      });

      const { prepareSdpSigningMaterial } = await import(
        "@/lib/stellar/ensure-passkey-signer"
      );
      const syncedSigner = await prepareSdpSigningMaterial(userId, credentialId);

      const authHeaders: HeadersInit = {
        "x-user-id": userId,
        "x-sep10-signer": syncedSigner.publicKey,
        "x-stellar-public-key": aligned.publicKey,
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
      if (!chRes.ok) throw new Error(chData.error ?? "Challenge falló");

      const networkPassphrase =
        chData.network_passphrase ??
        (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "public"
          ? Networks.PUBLIC
          : Networks.TESTNET);

      const tx = new Transaction(chData.transaction_xdr as string, networkPassphrase);
      const userSignerG = syncedSigner.publicKey.trim().toUpperCase();
      const challengeClientG = getSep10ClientAccountId(tx);
      if (challengeClientG && challengeClientG !== userSignerG) {
        throw new Error("La billetera del desafío no coincide con la tuya.");
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
      if (!tokRes.ok) throw new Error(tokData.error ?? "Token SEP-10 falló");

      const depRes = await fetch("/api/sdp/sep24/deposit", {
        method: "POST",
        credentials: "include",
        headers: authHeaders,
      });
      const depData = (await depRes.json().catch(() => ({}))) as {
        error?: string;
        debug?: SdpDebug;
        transactionId?: string;
      };
      if (!depRes.ok) throw new Error(depData.error ?? "SEP-24 falló");

      setDebug(depData.debug ?? null);
      setStep("otp");
      setStatus("idle");
      void loadRegistrationInfo();
      void sendOtp();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus("error");
    }
  };

  const loadRegistrationInfo = async () => {
    try {
      const res = await fetch("/api/sdp/registration/info", { credentials: "include" });
      if (!res.ok) return;
      const d = (await res.json()) as {
        verificationField?: string;
        debug?: SdpDebug;
      };
      if (d.verificationField) setVerificationField(d.verificationField);
      if (d.debug) {
        setDebug((prev) => ({
          ...prev,
          ...d.debug,
          verifiedEmail: email || prev?.verifiedEmail,
          verifiedDateOfBirth: dateOfBirth || prev?.verifiedDateOfBirth,
          verificationField: d.verificationField ?? prev?.verificationField,
        }));
      }
    } catch {
      // non-fatal
    }
  };

  const sendOtp = async () => {
    setError(null);
    setStatus("busy");
    try {
      const res = await fetch("/api/sdp/registration/otp", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar el código.");
      setOtpSent(true);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus("error");
    }
  };

  const verifyOtp = async () => {
    setError(null);
    if (!otp.trim()) {
      setError("Ingresá el código de 6 dígitos.");
      return;
    }
    setStatus("busy");
    try {
      const res = await fetch("/api/sdp/registration/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp: otp.trim(),
          date_of_birth: dateOfBirth.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        verificationField?: string;
        debug?: SdpDebug;
      };
      // #region agent log
      if (process.env.NODE_ENV === "development") {
        fetch("http://127.0.0.1:7454/ingest/aec984e4-6773-4680-98b7-b535bc491a52", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "d5ebeb",
        },
        body: JSON.stringify({
          sessionId: "d5ebeb",
          location: "SdpRegisterFlow.tsx:verifyOtp",
          message: "registration/verify response",
          data: {
            httpStatus: res.status,
            ok: res.ok,
            verificationSent: data.debug?.verificationSent ?? null,
            dobSource: data.debug?.dobSource ?? null,
            inviteExpectedDob: data.debug?.inviteExpectedDob ?? null,
            verificationField: data.verificationField ?? verificationField,
            hasDebug: Boolean(data.debug),
          },
          hypothesisId: "B",
          timestamp: Date.now(),
          runId: "pre-fix",
        }),
      }).catch(() => {});
      }
      // #endregion
      if (!res.ok) {
        if (data.debug) {
          setDebug((prev) => ({
            ...prev,
            ...data.debug,
            verifiedEmail: email,
            verifiedDateOfBirth: dateOfBirth,
            verificationField: data.verificationField ?? verificationField,
          }));
        }
        const sentNote = data.debug?.verificationSent
          ? ` (enviado a SDP: ${data.debug.verificationSent})`
          : "";
        throw new Error(
          ([data.error, data.hint].filter(Boolean).join(" ") || "Verificación falló") +
            sentNote
        );
      }
      if (data.debug) {
        setDebug((prev) => ({
          ...prev,
          ...data.debug,
          verifiedEmail: email,
          verifiedDateOfBirth: dateOfBirth,
          verificationField: data.verificationField ?? verificationField,
        }));
      }
      setStep("done");
      setStatus("idle");
      void pollStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus("error");
    }
  };

  const pollStatus = async () => {
    try {
      const res = await fetch("/api/sdp/registration/status", {
        credentials: "include",
      });
      if (!res.ok) return;
      const d = (await res.json()) as { completed?: boolean; transactionStatus?: string };
      if (d.completed) setStep("done");
    } catch {
      // ignore
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
        <p className="text-sm text-white/55">Entrá con passkey para continuar.</p>
        <Link href="/auth?sdpInvite=1" className={CTA_CLASS}>
          <Fingerprint className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
          Entrar con passkey
        </Link>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="max-w-sm mx-auto mt-12 space-y-6 text-center">
        <h1 className="text-xl font-semibold text-white">{paymentTitle}</h1>
        <p className="text-sm text-green-300/90">
          Billetera vinculada. La organización puede iniciar o continuar el desembolso en
          SozuPay.
        </p>
        <Link href="/home" className={CTA_CLASS}>
          Ir a mi billetera
        </Link>
        <DebugPanel debug={debug} />
      </div>
    );
  }

  if (step === "contact") {
    return (
      <div className="max-w-sm mx-auto mt-12 space-y-6">
        <h1 className="text-xl font-semibold text-white text-center">{paymentTitle}</h1>
        <p className="text-sm text-white/55 text-center">
          Datos del lote (una sola vez). No los pedimos de nuevo en SDP.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="sdp-email" className="block text-sm text-white/70 mb-1">
              Correo del beneficiario
            </label>
            <input
              id="sdp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <DobIsoInput
            id="sdp-dob"
            label="Fecha de nacimiento (AAAA-MM-DD)"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            hint="Usá año-mes-día con guiones, igual que en el lote de SozuPay."
          />
        </div>
        <button
          type="button"
          onClick={() => void saveContact()}
          disabled={status === "busy"}
          className={CTA_CLASS}
        >
          {status === "busy" ? "Guardando…" : "Continuar"}
        </button>
        {!hasInviteToken && (
          <p className="text-xs text-amber-300/90 text-center">
            Abrí el enlace completo del correo de la organización.
          </p>
        )}
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  if (step === "passkey") {
    return (
      <div className="max-w-sm mx-auto mt-12 space-y-6">
        <h1 className="text-xl font-semibold text-white text-center">{paymentTitle}</h1>
        <p className="text-sm text-white/55 text-center">
          Vinculá tu billetera con passkey para recibir el pago.
        </p>
        <button
          type="button"
          onClick={() => void linkWalletWithPasskey()}
          disabled={status === "busy"}
          className={CTA_CLASS}
        >
          {status === "busy" ? (
            "Vinculando…"
          ) : (
            <>
              <Fingerprint className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              Confirmar con passkey
            </>
          )}
        </button>
        {status === "busy" && (
          <p className="text-xs text-white/45 text-center">
            Firmá con huella, rostro o PIN.
          </p>
        )}
        <DebugPanel debug={debug} />
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  // step === "otp"
  return (
    <div className="max-w-sm mx-auto mt-12 space-y-6">
      <h1 className="text-xl font-semibold text-white text-center">{paymentTitle}</h1>
      <p className="text-sm text-white/55 text-center">
        Código enviado a <span className="text-white/80">{email || "tu correo"}</span>
      </p>
      <p className="text-xs text-white/45 text-center">
        Si no ves el código, revisá la carpeta de spam o correo no deseado.
      </p>
      {isTestnet && (
        <p className="text-xs text-orange-200/80 text-center">
          Testnet: probá OTP <span className="font-mono">000000</span>
        </p>
      )}
      {verificationField === "DATE_OF_BIRTH" ? (
        <DobIsoInput
          id="sdp-dob-otp"
          label="Fecha de nacimiento (AAAA-MM-DD, igual que el lote)"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          hint="Debe coincidir con la columna «verification» del CSV en SozuPay."
        />
      ) : verificationField === "YEAR_MONTH" ? (
        <div>
          <label htmlFor="sdp-ym-otp" className="block text-sm text-white/70 mb-1">
            Año y mes (AAAA-MM)
          </label>
          <input
            id="sdp-ym-otp"
            type="month"
            value={dateOfBirth.slice(0, 7)}
            onChange={(e) => setDateOfBirth(e.target.value ? `${e.target.value}-01` : "")}
            className={INPUT_CLASS}
          />
        </div>
      ) : null}
      <div>
        <label htmlFor="sdp-otp" className="block text-sm text-white/70 mb-1">
          Código OTP
        </label>
        <input
          id="sdp-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className={INPUT_CLASS}
        />
      </div>
      <button
        type="button"
        onClick={() => void verifyOtp()}
        disabled={status === "busy"}
        className={CTA_CLASS}
      >
        {status === "busy" ? "Verificando…" : "Confirmar registro"}
      </button>
      <button
        type="button"
        onClick={() => void sendOtp()}
        disabled={status === "busy"}
        className="text-sm text-white/50 underline w-full text-center"
      >
        {otpSent ? "Reenviar código" : "Enviar código"}
      </button>
      <DebugPanel debug={debug} />
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
    </div>
  );
}
