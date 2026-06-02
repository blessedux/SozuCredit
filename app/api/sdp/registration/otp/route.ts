import { NextResponse } from "next/server";
import { postSdpRegistrationOtp } from "@/lib/sdp/sep24Registration";
import { requireSdpRegistrationSession } from "@/lib/sdp/requireRegistrationSession";
import { persistInvitePayload } from "@/lib/sdp/persistInvite";

/** POST — send SDP OTP to the email already collected on Sozu. */
export async function POST() {
  const session = await requireSdpRegistrationSession();
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const result = await postSdpRegistrationOtp({
    apiBase: session.apiBase,
    sep24Jwt: session.sep24Jwt,
    email: session.email,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  await persistInvitePayload({
    ...session.invite,
    sdpVerificationField: result.verificationField,
  });

  return NextResponse.json({
    ok: true,
    message: result.message,
    verificationField: result.verificationField,
  });
}
