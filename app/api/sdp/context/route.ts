import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseInviteCookie, SDP_INVITE_COOKIE_NAME } from "@/lib/sdp/invitePayload";

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
      { organizationName: null, asset: null, requiresIdentityVerification: false },
      { status: 200 }
    );
  }

  const requiresIdentityVerification = Boolean(
    payload.expectedFullName || payload.expectedDateOfBirth
  );

  const maskEmail = (email: string) => {
    const at = email.indexOf("@");
    if (at < 2) return email;
    return `${email.slice(0, 2)}***${email.slice(at)}`;
  };

  return NextResponse.json({
    organizationName: payload.organizationName,
    asset: payload.asset,
    sdpHost: payload.sdpHost,
    requiresIdentityVerification,
    expectedEmailHint: payload.expectedBeneficiaryEmail
      ? maskEmail(payload.expectedBeneficiaryEmail.trim())
      : null,
    expectedDateOfBirthHint: payload.expectedDateOfBirth?.trim() || null,
    isTestnet:
      process.env.STELLAR_NETWORK !== "public" &&
      process.env.NEXT_PUBLIC_STELLAR_NETWORK !== "public",
  });
}
