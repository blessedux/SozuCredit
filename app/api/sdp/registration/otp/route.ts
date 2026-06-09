import { NextResponse } from "next/server";
import { postSdpRegistrationOtp } from "@/lib/sdp/sep24Registration";
import { requireSdpRegistrationSession } from "@/lib/sdp/requireRegistrationSession";
import { persistInvitePayload } from "@/lib/sdp/persistInvite";
import { lookupReceiverVerificationByEmail } from "@/lib/sdp/adminLookup";
import { maskEmail } from "@/lib/sdp/debugLog";

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
    tenantName: session.tenantName || undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        debug: {
          emailMasked: maskEmail(session.email),
          apiBase: session.apiBase.replace(/^https?:\/\//, "").split("/")[0],
          httpStatus: result.status ?? null,
        },
      },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  await persistInvitePayload({
    ...session.invite,
    sdpVerificationField: result.verificationField,
  });

  const batchLookup = await lookupReceiverVerificationByEmail(session.email).catch(
    () => ({ configured: false as const })
  );

  return NextResponse.json({
    ok: true,
    message: result.message,
    verificationField: result.verificationField,
    debug: {
      emailMasked: maskEmail(session.email),
      apiBase: session.apiBase.replace(/^https?:\/\//, "").split("/")[0],
      verificationField: result.verificationField,
      batchLookup:
        batchLookup.configured === false
          ? { configured: false, note: "Set SDP admin env on SozuCredit for batch row hints." }
          : {
              configured: true,
              receiverCount: batchLookup.count,
              duplicateEmail: batchLookup.duplicateEmail,
              walletStatus: batchLookup.hits[0]?.walletStatus ?? null,
              disbursementStatus: batchLookup.hits[0]?.disbursementStatus ?? null,
              sdpVerifyNote: batchLookup.sdpVerifyNote,
            },
      otpDeliveryHint:
        "OTP email is sent by SDP on Railway (SendGrid), not SozuCredit. If EMAIL_SENDER_TYPE=DRY_RUN, read the code in Railway sdp-v2 logs or use testnet OTP 000000.",
    },
  });
}
