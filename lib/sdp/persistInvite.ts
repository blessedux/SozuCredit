import "server-only";

import { cookies } from "next/headers";
import {
  serializeInviteCookie,
  SDP_INVITE_COOKIE_NAME,
  SDP_INVITE_COOKIE_MAX_AGE_SEC,
  type SdpInvitePayload,
} from "./invitePayload";

export async function persistInvitePayload(payload: SdpInvitePayload): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SDP_INVITE_COOKIE_NAME, serializeInviteCookie(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SDP_INVITE_COOKIE_MAX_AGE_SEC,
    path: "/",
  });
}
