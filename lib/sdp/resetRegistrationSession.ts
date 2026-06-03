import "server-only";

import { cookies } from "next/headers";
import {
  parseInviteCookie,
  SDP_INVITE_COOKIE_NAME,
  type SdpInvitePayload,
} from "./invitePayload";
import { persistInvitePayload } from "./persistInvite";
import {
  clearSdpSep10JwtCookie,
  clearSdpSep24JwtCookie,
} from "./jwtCookie";

/** Drop SEP-24 / passkey progress so a new Sozu account must re-link before OTP. */
export async function resetSdpWalletLinkSession(): Promise<{
  ok: boolean;
  hadInvite: boolean;
}> {
  await clearSdpSep10JwtCookie();
  await clearSdpSep24JwtCookie();

  const raw = (await cookies()).get(SDP_INVITE_COOKIE_NAME)?.value;
  const invite = parseInviteCookie(raw);
  if (!invite) {
    return { ok: true, hadInvite: false };
  }

  const next: SdpInvitePayload = { ...invite };
  delete next.sep24TransactionId;
  delete next.sdpVerificationField;
  delete next.registrationCompletedAt;
  await persistInvitePayload(next);

  return { ok: true, hadInvite: true };
}
