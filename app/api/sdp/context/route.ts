import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseInviteCookie, SDP_INVITE_COOKIE_NAME } from "@/lib/sdp/invitePayload";
import { decodeSdpOrganizationName } from "@/lib/sdp/displayName";
import { getSdpSep24JwtCookie } from "@/lib/sdp/jwtCookie";

/**
 * GET /api/sdp/context
 * Returns non-sensitive fields from the invite cookie for display in the UI.
 */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SDP_INVITE_COOKIE_NAME)?.value;
  const payload = parseInviteCookie(raw);

  if (!payload) {
    return NextResponse.json(
      { organizationName: null, asset: null, step: "invite_missing" },
      { status: 200 }
    );
  }

  const organizationName =
    decodeSdpOrganizationName(payload.organizationName) || payload.organizationName;

  const hasContact = Boolean(
    payload.verifiedEmail?.trim() && payload.verifiedDateOfBirth?.trim()
  );
  const sep24Jwt = await getSdpSep24JwtCookie();
  const hasPasskeySession = Boolean(
    payload.sep24TransactionId?.trim() && sep24Jwt?.trim()
  );
  const isComplete = Boolean(payload.registrationCompletedAt);

  let step: "contact" | "passkey" | "otp" | "done" = "contact";
  if (isComplete) step = "done";
  else if (hasPasskeySession) step = "otp";
  else if (hasContact) step = "passkey";

  const maskEmail = (email: string) => {
    const at = email.indexOf("@");
    if (at < 2) return email;
    return `${email.slice(0, 2)}***${email.slice(at)}`;
  };

  return NextResponse.json({
    organizationName,
    asset: payload.asset,
    sdpHost: payload.sdpHost,
    step,
    hasInviteToken: Boolean(payload.token?.trim()),
    verifiedEmail: hasContact ? payload.verifiedEmail?.trim() || null : null,
    verifiedEmailHint: payload.verifiedEmail
      ? maskEmail(payload.verifiedEmail.trim())
      : null,
    verifiedDateOfBirth: payload.verifiedDateOfBirth?.trim() || null,
    transactionId: payload.sep24TransactionId ?? null,
    verificationField: payload.sdpVerificationField ?? "DATE_OF_BIRTH",
    isTestnet:
      process.env.STELLAR_NETWORK !== "public" &&
      process.env.NEXT_PUBLIC_STELLAR_NETWORK !== "public",
  });
}
