import { cookies } from "next/headers";

export const SDP_SEP10_JWT_COOKIE = "sozupay_sdp_sep10_jwt";
/** SEP-24 interactive session JWT (from wallet-registration/start?token=…). */
export const SDP_SEP24_JWT_COOKIE = "sozupay_sdp_sep24_jwt";

const MAX_AGE_SEC = 60 * 15;

export async function setSdpSep10JwtCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SDP_SEP10_JWT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SEC,
    path: "/",
  });
}

export async function getSdpSep10JwtCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SDP_SEP10_JWT_COOKIE)?.value ?? null;
}

export async function clearSdpSep10JwtCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SDP_SEP10_JWT_COOKIE);
}

export async function setSdpSep24JwtCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SDP_SEP24_JWT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SEC,
    path: "/",
  });
}

export async function getSdpSep24JwtCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SDP_SEP24_JWT_COOKIE)?.value ?? null;
}

export async function clearSdpSep24JwtCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SDP_SEP24_JWT_COOKIE);
}
