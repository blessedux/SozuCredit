import { NextResponse } from "next/server";
import { postSdpRegistrationVerifyWithCandidates } from "@/lib/sdp/sep24Registration";
import { requireSdpRegistrationSession } from "@/lib/sdp/requireRegistrationSession";
import { persistInvitePayload } from "@/lib/sdp/persistInvite";
import {
  formatVerificationValueForSdp,
  normalizeVerificationField,
  verificationFieldLabel,
} from "@/lib/sdp/formatVerificationValue";
import { normalizeDateOfBirth } from "@/lib/sdp/beneficiaryIdentity";
import { maskEmail, sdpDebugLog } from "@/lib/sdp/debugLog";
import { lookupReceiverVerificationByEmail } from "@/lib/sdp/adminLookup";

const SDP_NOT_FOUND = "The information you provided could not be found";

function mapSdpVerifyError(params: {
  sdpError: string;
  sdpErrorCode?: string;
  sdpExtrasCodes?: string[];
  verificationField: string;
  verificationSent?: string | null;
  inviteExpectedDob?: string | null;
  batchLookupNote?: string | null;
  sep24Linked?: boolean | null;
  receiverWalletStatus?: string | null;
  disbursementStatus?: string | null;
  sdpHttpStatus?: number | null;
}): { error: string; hint: string } {
  const field = normalizeVerificationField(params.verificationField);
  const label = verificationFieldLabel(field);
  const code = params.sdpErrorCode;
  const extras = params.sdpExtrasCodes ?? [];

  if (code === "400_6" || /invalid otp/i.test(params.sdpError)) {
    return {
      error: "Código OTP incorrecto.",
      hint: "Pedí un código nuevo y usá el último que llegó al correo (6 dígitos).",
    };
  }

  if (code === "400_5" || /expired/i.test(params.sdpError)) {
    return {
      error: "El OTP expiró.",
      hint: "Pedí un código nuevo (válido 5 minutos).",
    };
  }

  if (code === "400_4" || code === "400_3") {
    return {
      error: "Demasiados intentos de verificación.",
      hint: "Pedí un OTP nuevo o contactá a la organización para resetear el receiver.",
    };
  }

  if (code === "400_1") {
    return {
      error: "reCAPTCHA inválido en SDP.",
      hint: "Reintentá en unos minutos o desde otra red/navegador.",
    };
  }

  if (extras.includes("EXTRA_2") || extras.includes("EXTRA_3")) {
    return {
      error: "Formato de fecha inválido para SDP.",
      hint: "Usá exactamente AAAA-MM-DD (ej. 1991-01-01). SDP no acepta barras ni otros formatos.",
    };
  }

  if (
    code === "400_2" ||
    params.sdpError.includes(SDP_NOT_FOUND) ||
    /could not be found/i.test(params.sdpError)
  ) {
    if (
      field === "DATE_OF_BIRTH" &&
      params.receiverWalletStatus?.toUpperCase() === "DRAFT"
    ) {
      return {
        error: "El lote aún no está iniciado en SDP (wallet del beneficiario en DRAFT).",
        hint:
          "En SozuPay, abrí el lote y tocá «Send invites» — eso inicia la campaña (STARTED) y abre el registro en SozuCredit. SDP solo permite registrar cuando el wallet pasa de DRAFT → READY. Después pedí OTP nuevo.",
      };
    }
    if (field === "DATE_OF_BIRTH") {
      const sentIso =
        params.verificationSent &&
        /^\d{4}-\d{2}-\d{2}$/.test(params.verificationSent);
      return {
        error: sentIso
          ? params.inviteExpectedDob === params.verificationSent
            ? `SDP no aceptó la verificación (${params.verificationSent}).`
            : `SDP rechazó la fecha ${params.verificationSent}.`
          : "La fecha de nacimiento no coincide con la del lote en SozuPay.",
        hint: sentIso
          ? params.inviteExpectedDob === params.verificationSent
            ? params.sep24Linked === false
              ? `La DOB ${params.verificationSent} coincide con el enlace del lote. SDP guarda la fecha como hash (el admin API la muestra vacía aunque esté bien). Tu sesión SEP-24 aún no está vinculada al wallet del lote — es normal antes de terminar. Pedí un OTP nuevo, usá el último código en cuanto llegue (~5 min) y reintentá.`
              : `La DOB ${params.verificationSent} coincide con el enlace del lote. Si SDP sigue con 400_2, pedí OTP nuevo (vence en ~5 min) o abrí un enlace de invitación recién enviado. ${params.batchLookupNote ? `Debug: ${params.batchLookupNote}` : ""}`.trim()
            : `SozuCredit ya envió ${params.verificationSent} a SDP. Si el lote tiene otra fecha (revisá la columna DOB en SozuPay), usá esa exacta. También puede haber otro lote con el mismo correo. Pedí OTP nuevo después de corregir el lote.`
          : "Debe ser exactamente AAAA-MM-DD como en la columna «verification» del CSV (ej. 1997-08-05). Confirmá con la organización si no estás seguro. Pedí un OTP nuevo si pasaron más de 5 minutos.",
      };
    }
    if (field === "YEAR_MONTH") {
      return {
        error: "El año/mes no coincide con el lote.",
        hint: "Usá el formato AAAA-MM (ej. 1997-08), no el día completo.",
      };
    }
    return {
      error: `El ${label} no coincide con el registrado en el lote.`,
      hint:
        "Revisá que el OTP sea el último recibido (vence en 5 minutos) y que el dato coincida exactamente con el CSV del desembolso.",
    };
  }

  if (/invalid in some way/i.test(params.sdpError)) {
    return {
      error: "SDP rechazó la solicitud (validación genérica).",
      hint:
        "Revisá OTP de 6 dígitos (el último recibido) y fecha AAAA-MM-DD. Si persiste, abrí Debug SDP: sdp_error_code y sdp_extras_codes indican OTP vs fecha.",
    };
  }

  if (
    code === "500_0" ||
    params.sdpHttpStatus === 500 ||
    /internal error occurred/i.test(params.sdpError)
  ) {
    if (params.receiverWalletStatus?.toUpperCase() === "REGISTERED") {
      return {
        error: "Este correo ya completó el registro en SDP.",
        hint:
          "Entrá con la passkey o $tag de esa cuenta Sozu (tocá «Otra passkey o $tag + PIN»). Si fue un error, la organización debe resetear el receiver en SozuPay.",
      };
    }
    const started =
      params.disbursementStatus === "STARTED" || params.disbursementStatus === "PAUSED";
    const dupNote = params.batchLookupNote?.includes("multiple batch rows")
      ? " Hay más de un lote con este correo en SDP — la org debe usar un correo único o eliminar filas duplicadas."
      : "";
    return {
      error: "SDP tuvo un error interno al completar el registro.",
      hint:
        (started
          ? "Pedí un OTP nuevo y reintentá en cuanto llegue (~5 min). Si ya tenés cuenta Sozu con otra passkey, volvé al paso anterior y tocá «Otra passkey o $tag + PIN»."
          : "El lote puede no estar iniciado: en SozuPay tocá «Send invites», pedí OTP nuevo y reintentá.") + dupNote,
    };
  }

  return {
    error: params.sdpError,
    hint:
      "Revisá que el OTP sea el último recibido y que la fecha de nacimiento sea AAAA-MM-DD como en el lote.",
  };
}

function dobSource(params: {
  verificationOverride: string;
  inviteExpected: string | undefined;
  sessionDob: string;
}): "override" | "invite" | "session" {
  if (params.verificationOverride) return "override";
  if (params.inviteExpected?.trim()) return "invite";
  return "session";
}

/** POST body: { otp: string, date_of_birth?: string, verification?: string } */
export async function POST(request: Request) {
  const session = await requireSdpRegistrationSession();
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const body = await request.json().catch(() => ({}));
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!otp || otp.length < 4) {
    return NextResponse.json({ error: "Ingresá el código OTP." }, { status: 400 });
  }

  const verificationField = normalizeVerificationField(session.verificationField);
  const verificationOverride =
    typeof body.verification === "string"
      ? body.verification.trim()
      : typeof body.date_of_birth === "string"
        ? body.date_of_birth.trim()
        : "";

  const inviteExpected = session.invite.expectedDateOfBirth?.trim();
  const rawVerification =
    verificationOverride || inviteExpected || session.dateOfBirth;

  const source = dobSource({
    verificationOverride,
    inviteExpected,
    sessionDob: session.dateOfBirth,
  });

  const verificationValue = formatVerificationValueForSdp(
    verificationField,
    rawVerification
  );

  sdpDebugLog(
    "registration/verify/route.ts:pre-sdp",
    "verify inputs assembled",
    {
      emailMasked: maskEmail(session.email),
      verificationField,
      dobSource: source,
      rawVerificationLen: rawVerification.length,
      rawVerificationIso: /^\d{4}-\d{2}-\d{2}$/.test(rawVerification),
      verificationNormalized: verificationValue,
      inviteExpectedDob: inviteExpected ?? null,
      sessionStoredDob: session.dateOfBirth,
      overrideRawLen: verificationOverride.length,
      transactionId: session.invite.sep24TransactionId ?? null,
      clientDomain: session.clientDomain,
      sep24Account: session.sep24Account,
    },
    "D"
  );

  if (!verificationValue) {
    sdpDebugLog(
      "registration/verify/route.ts:invalid-dob",
      "formatVerificationValueForSdp returned null",
      { rawVerificationLen: rawVerification.length, dobSource: source },
      "B"
    );
    return NextResponse.json(
      {
        error:
          verificationField === "DATE_OF_BIRTH"
            ? "Fecha inválida. Usá AAAA-MM-DD (ej. 1997-08-05)."
            : verificationField === "YEAR_MONTH"
              ? "Formato inválido. Usá AAAA-MM (ej. 1997-08)."
              : "Dato de verificación inválido.",
      },
      { status: 400 }
    );
  }

  if (inviteExpected && inviteExpected !== verificationValue) {
    sdpDebugLog(
      "registration/verify/route.ts:invite-mismatch",
      "invite bd differs from value sent to SDP",
      {
        inviteExpectedDob: inviteExpected,
        verificationSent: verificationValue,
        dobSource: source,
      },
      "A"
    );
  }

  const result = await postSdpRegistrationVerifyWithCandidates({
    apiBase: session.apiBase,
    sep24Jwt: session.sep24Jwt,
    email: session.email,
    otp,
    verificationValue,
    verificationField,
    tenantName: session.tenantName || undefined,
  });

  sdpDebugLog(
    "registration/verify/route.ts:post-sdp",
    "SDP verification response",
    {
      ok: result.ok,
      sdpStatus: result.ok ? 200 : (result.status ?? 502),
      sdpErrorCategory: result.ok
        ? "success"
        : "sdpErrorCode" in result && result.sdpErrorCode === "400_2"
          ? "not_found"
          : result.error.includes(SDP_NOT_FOUND)
            ? "not_found"
            : "sdpErrorCode" in result && result.sdpErrorCode === "400_6"
              ? "invalid_otp"
              : "sdpErrorCode" in result && result.sdpErrorCode === "400_5"
                ? "expired"
                : /invalid otp/i.test(result.error)
                  ? "invalid_otp"
                  : /expired/i.test(result.error)
                    ? "expired"
                    : "other",
      sdpErrorCode: result.ok ? null : ("sdpErrorCode" in result ? result.sdpErrorCode : null),
      verificationSent: verificationValue,
      transactionId: session.invite.sep24TransactionId ?? null,
    },
    result.ok ? "E" : "A"
  );

  if (!result.ok) {
    let batchLookup: Awaited<ReturnType<typeof lookupReceiverVerificationByEmail>> | null =
      null;
    try {
      batchLookup = await lookupReceiverVerificationByEmail(session.email, {
        sep24TransactionId: session.invite.sep24TransactionId ?? undefined,
      });
    } catch (e) {
      sdpDebugLog(
        "registration/verify/route.ts:batch-lookup-failed",
        "SDP admin lookup failed",
        { error: e instanceof Error ? e.message : String(e) },
        "A"
      );
    }

    const mapped = mapSdpVerifyError({
      sdpError: result.error,
      sdpErrorCode: "sdpErrorCode" in result ? result.sdpErrorCode : undefined,
      sdpExtrasCodes: "sdpExtrasCodes" in result ? result.sdpExtrasCodes : undefined,
      verificationField,
      verificationSent: verificationValue,
      inviteExpectedDob: inviteExpected ?? null,
      batchLookupNote:
        batchLookup && "sdpVerifyNote" in batchLookup ? batchLookup.sdpVerifyNote : null,
      sep24Linked:
        batchLookup && "hits" in batchLookup
          ? batchLookup.transactionHit?.sep24Linked ??
            batchLookup.hits?.[0]?.sep24Linked ??
            null
          : null,
      receiverWalletStatus:
        batchLookup && "hits" in batchLookup
          ? batchLookup.hits?.[0]?.walletStatus ?? null
          : null,
      disbursementStatus:
        batchLookup && "hits" in batchLookup
          ? batchLookup.hits?.[0]?.disbursementStatus ?? null
          : null,
      sdpHttpStatus: result.status ?? null,
    });

    sdpDebugLog(
      "registration/verify/route.ts:verify-failed",
      "verify failed with batch context",
      {
        runId: "post-fix",
        emailMasked: maskEmail(session.email),
        verificationSent: verificationValue,
        tenantName: session.tenantName || null,
        transactionId: session.invite.sep24TransactionId ?? null,
        batchLookupConfigured: batchLookup?.configured ?? false,
        batchHitCount:
          batchLookup && "count" in batchLookup ? batchLookup.count : null,
        batchUniqueDobs:
          batchLookup && "uniqueDobs" in batchLookup ? batchLookup.uniqueDobs : null,
        inviteExpectedDob: inviteExpected ?? null,
        sep24Linked:
          batchLookup && "hits" in batchLookup
            ? batchLookup.hits?.[0]?.sep24Linked ?? null
            : null,
        batchLookupNote:
          batchLookup && "sdpVerifyNote" in batchLookup ? batchLookup.sdpVerifyNote : null,
        candidatesTried:
          "candidatesTried" in result ? result.candidatesTried : null,
        sepErrorCode: "sdpErrorCode" in result ? result.sdpErrorCode : null,
        receiverWalletStatus:
          batchLookup && "hits" in batchLookup
            ? batchLookup.hits?.[0]?.walletStatus ?? null
            : null,
      },
      "H3"
    );

    return NextResponse.json(
      {
        error: mapped.error,
        hint: mapped.hint,
        verificationField,
        debug: {
          sep24Account: session.sep24Account,
          clientDomain: session.clientDomain,
          verificationField,
          verificationSent: verificationValue,
          dobSource: source,
          inviteExpectedDob: inviteExpected ?? null,
          transactionId: session.invite.sep24TransactionId ?? null,
          tenantName: session.tenantName || null,
          batchDobIfCsvBlank: "2000-01-01",
          candidatesTried:
            "candidatesTried" in result ? result.candidatesTried : undefined,
          sdpHttpStatus: result.status ?? null,
          sdpErrorCode: "sdpErrorCode" in result ? result.sdpErrorCode ?? null : null,
          sdpExtrasCodes:
            "sdpExtrasCodes" in result ? result.sdpExtrasCodes ?? null : null,
          batchLookup:
            batchLookup && "count" in batchLookup
              ? {
                  count: batchLookup.count,
                  duplicateEmail: batchLookup.duplicateEmail,
                  uniqueDobs: batchLookup.uniqueDobs,
                  transactionHit: batchLookup.transactionHit ?? null,
                  hits: batchLookup.hits.map((h) => ({
                    disbursementName: h.disbursementName,
                    disbursementStatus: h.disbursementStatus,
                    verificationDob: h.verificationDob,
                    receiverId: h.receiverId,
                    walletStatus: h.walletStatus,
                    sep24TransactionId: h.sep24TransactionId,
                    sep24Linked: h.sep24Linked,
                    matchesCurrentTx: h.matchesCurrentTx,
                  })),
                  note: batchLookup.sdpVerifyNote,
                }
              : batchLookup?.configured === false
                ? {
                    note: "Set SDP_API_URL + SDP_ADMIN_EMAIL + SDP_ADMIN_PASSWORD on SozuCredit to auto-lookup batch DOB here.",
                  }
                : null,
        },
      },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  const verificationUsed =
    result.ok && "verificationUsed" in result
      ? result.verificationUsed
      : verificationValue;

  const normalizedDob =
    verificationField === "DATE_OF_BIRTH"
      ? normalizeDateOfBirth(verificationOverride || verificationUsed || session.dateOfBirth)
      : null;

  await persistInvitePayload({
    ...session.invite,
    ...(normalizedDob ? { verifiedDateOfBirth: normalizedDob } : {}),
    registrationCompletedAt: Math.floor(Date.now() / 1000),
  });

  return NextResponse.json({
    ok: true,
    message: result.message,
    debug: {
      sep24Account: session.sep24Account,
      clientDomain: session.clientDomain,
      verificationField,
      verificationSent: verificationUsed,
      transactionId: session.invite.sep24TransactionId ?? null,
      candidatesTried:
        result.ok && "candidatesTried" in result ? result.candidatesTried : undefined,
    },
  });
}
