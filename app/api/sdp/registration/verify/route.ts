import { NextResponse } from "next/server";
import { postSdpRegistrationVerify } from "@/lib/sdp/sep24Registration";
import { requireSdpRegistrationSession } from "@/lib/sdp/requireRegistrationSession";
import { persistInvitePayload } from "@/lib/sdp/persistInvite";

/** POST body: { otp: string } — email and DOB come from invite cookie. */
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

  const result = await postSdpRegistrationVerify({
    apiBase: session.apiBase,
    sep24Jwt: session.sep24Jwt,
    email: session.email,
    otp,
    verificationValue: session.dateOfBirth,
    verificationField: session.verificationField,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        hint:
          "Revisá que el OTP sea el último recibido y que la fecha de nacimiento sea AAAA-MM-DD como en el lote.",
      },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  await persistInvitePayload({
    ...session.invite,
    registrationCompletedAt: Math.floor(Date.now() / 1000),
  });

  return NextResponse.json({
    ok: true,
    message: result.message,
    debug: {
      sep24Account: session.sep24Account,
      clientDomain: session.clientDomain,
      transactionId: session.invite.sep24TransactionId ?? null,
    },
  });
}
