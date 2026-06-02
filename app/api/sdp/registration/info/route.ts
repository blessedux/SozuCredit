import { NextResponse } from "next/server";
import { getSdpRegistrationInfo } from "@/lib/sdp/sep24Registration";
import { requireSdpRegistrationSession } from "@/lib/sdp/requireRegistrationSession";
import { normalizeVerificationField } from "@/lib/sdp/formatVerificationValue";

/** GET — SDP registration context (org, verification type) for the OTP step. */
export async function GET() {
  const session = await requireSdpRegistrationSession();
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const info = await getSdpRegistrationInfo({
    apiBase: session.apiBase,
    sep24Jwt: session.sep24Jwt,
  });

  const verificationField = normalizeVerificationField(session.verificationField);

  return NextResponse.json({
    ok: true,
    organizationName: info.ok ? info.organizationName : null,
    isRegistered: info.ok ? info.isRegistered : false,
    truncatedContactInfo: info.ok ? info.truncatedContactInfo : undefined,
    verificationField,
    verifiedEmail: session.email,
    debug: {
      sep24Account: session.sep24Account,
      clientDomain: session.clientDomain,
      stellarAccount: session.stellarAccount,
      depositAccount: session.depositAccount,
    },
  });
}
