import "server-only";

import { getSdpApiContext } from "./sdpApiContext";
import { getSdpSep24JwtCookie } from "./jwtCookie";
import { sdpInteractiveDepositApiBase } from "./sep24Session";
import type { SdpInvitePayload } from "./invitePayload";

export async function requireSdpRegistrationSession(): Promise<
  | {
      ok: true;
      invite: SdpInvitePayload;
      sep24Jwt: string;
      apiBase: string;
      email: string;
      dateOfBirth: string;
      verificationField: string;
      clientDomain: string;
      stellarAccount: string;
      depositAccount: string;
      sep24Account: string;
    }
  | { ok: false; status: number; error: string }
> {
  const ctx = await getSdpApiContext();
  if (!ctx.ok) {
    return { ok: false, status: ctx.status, error: ctx.error };
  }

  const sep24Jwt = await getSdpSep24JwtCookie();
  if (!sep24Jwt) {
    return {
      ok: false,
      status: 400,
      error: "Completá el paso de passkey antes de verificar el código.",
    };
  }

  const email = ctx.invite.verifiedEmail?.trim();
  const dateOfBirth = ctx.invite.verifiedDateOfBirth?.trim();
  if (!email || !dateOfBirth) {
    return {
      ok: false,
      status: 400,
      error: "Falta correo o fecha de nacimiento. Volvé al primer paso.",
    };
  }

  const verificationField =
    ctx.invite.sdpVerificationField?.trim() || "DATE_OF_BIRTH";

  const { resolveSep24RegistrationAccount } = await import("./resolveSep10Account");
  const sep24Account = resolveSep24RegistrationAccount({
    stellarAccount: ctx.stellarAccount,
    depositAccount: ctx.depositAccount,
  });

  return {
    ok: true,
    invite: ctx.invite,
    sep24Jwt,
    apiBase: sdpInteractiveDepositApiBase(ctx.invite.sdpHost),
    email,
    dateOfBirth,
    verificationField,
    clientDomain: ctx.clientDomain,
    stellarAccount: ctx.stellarAccount,
    depositAccount: ctx.depositAccount,
    sep24Account,
  };
}
