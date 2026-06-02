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
  verificationField: string;
  verificationSent?: string | null;
  inviteExpectedDob?: string | null;
}): { error: string; hint: string } {
  const field = normalizeVerificationField(params.verificationField);
  const label = verificationFieldLabel(field);

  if (params.sdpError.includes(SDP_NOT_FOUND)) {
    if (field === "DATE_OF_BIRTH") {
      const sentIso =
        params.verificationSent &&
        /^\d{4}-\d{2}-\d{2}$/.test(params.verificationSent);
      return {
        error: sentIso
          ? `SDP rechazó la fecha ${params.verificationSent} aunque la ingresaste en formato correcto.`
          : "La fecha de nacimiento no coincide con la del lote en SozuPay.",
        hint: sentIso
          ? params.inviteExpectedDob === params.verificationSent
            ? `SozuCredit y el enlace del lote coinciden en ${params.verificationSent}, pero SDP rechazó el hash. Suele ser: (1) otro registro de verificación más reciente para el mismo correo, (2) verificación DATE_OF_BIRTH ausente en el receiver que SDP usa al verificar, o (3) fecha confirmada en un registro anterior que no se puede cambiar sin un correo nuevo. Revisá batch_lookup en Debug SDP (requiere credenciales admin en SozuCredit).`
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

  if (/invalid otp/i.test(params.sdpError)) {
    return {
      error: "Código OTP incorrecto.",
      hint: "Pedí un código nuevo y usá el último que llegó al correo.",
    };
  }

  if (/expired/i.test(params.sdpError)) {
    return {
      error: "El OTP expiró.",
      hint: "Pedí un código nuevo (válido 5 minutos).",
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
        : result.error.includes(SDP_NOT_FOUND)
          ? "not_found"
          : /invalid otp/i.test(result.error)
            ? "invalid_otp"
            : /expired/i.test(result.error)
              ? "expired"
              : "other",
      verificationSent: verificationValue,
      transactionId: session.invite.sep24TransactionId ?? null,
    },
    result.ok ? "E" : "A"
  );

  if (!result.ok) {
    const mapped = mapSdpVerifyError({
      sdpError: result.error,
      verificationField,
      verificationSent: verificationValue,
      inviteExpectedDob: inviteExpected ?? null,
    });

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

    sdpDebugLog(
      "registration/verify/route.ts:verify-failed",
      "verify failed with batch context",
      {
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
        candidatesTried:
          "candidatesTried" in result ? result.candidatesTried : null,
      },
      "A"
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
                    sep24TransactionId: h.sep24TransactionId,
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
