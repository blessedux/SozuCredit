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
    return NextResponse.json({ organizationName: null, asset: null }, { status: 200 });
  }

  return NextResponse.json({
    organizationName: payload.organizationName,
    asset: payload.asset,
    sdpHost: payload.sdpHost,
  });
}
