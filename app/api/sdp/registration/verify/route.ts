import { NextResponse } from "next/server";
import { postSdpRegistrationVerify } from "@/lib/sdp/sep24Registration";
import { requireSdpRegistrationSession } from "@/lib/sdp/requireRegistrationSession";
import { persistInvitePayload } from "@/lib/sdp/persistInvite";
import {
  formatVerificationValueForSdp,
  normalizeVerificationField,
  verificationFieldLabel,
} from "@/lib/sdp/formatVerificationValue";
import { normalizeDateOfBirth } from "@/lib/sdp/beneficiaryIdentity";

const SDP_NOT_FOUND = "The information you provided could not be found";

function mapSdpVerifyError(params: {
  sdpError: string;
  verificationField: string;
}): { error: string; hint: string } {
  const field = normalizeVerificationField(params.verificationField);
  const label = verificationFieldLabel(field);

  if (params.sdpError.includes(SDP_NOT_FOUND)) {
    if (field === "DATE_OF_BIRTH") {
      return {
        error:
          "La fecha de nacimiento no coincide con la del lote en SozuPay.",
        hint:
          "Debe ser exactamente AAAA-MM-DD como en la columna «verification» del CSV (ej. 1997-08-05). Confirmá con la organización si no estás seguro. Pedí un OTP nuevo si pasaron más de 5 minutos.",
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

  const rawVerification =
    verificationOverride ||
    session.invite.expectedDateOfBirth?.trim() ||
    session.dateOfBirth;

  const verificationValue = formatVerificationValueForSdp(
    verificationField,
    rawVerification
  );
  if (!verificationValue) {
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

  const result = await postSdpRegistrationVerify({
    apiBase: session.apiBase,
    sep24Jwt: session.sep24Jwt,
    email: session.email,
    otp,
    verificationValue,
    verificationField,
  });

  if (!result.ok) {
    const mapped = mapSdpVerifyError({
      sdpError: result.error,
      verificationField,
    });
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
        },
      },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  const normalizedDob =
    verificationField === "DATE_OF_BIRTH"
      ? normalizeDateOfBirth(verificationOverride || session.dateOfBirth)
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
      verificationSent: verificationValue,
      transactionId: session.invite.sep24TransactionId ?? null,
    },
  });
}
