import { NextResponse } from "next/server";
import { getSdpApiContext } from "@/lib/sdp/sdpApiContext";
import { getSdpSep10JwtCookie, setSdpSep24JwtCookie } from "@/lib/sdp/jwtCookie";
import { parseSdpAssetParam } from "@/lib/sdp/assetParam";
import { resolveSep24RegistrationAccount } from "@/lib/sdp/resolveSep10Account";
import { postSep24DepositInteractive } from "@/lib/sdp/sep24Server";
import { parseSep24SessionFromInteractiveUrl } from "@/lib/sdp/sep24Session";
import { persistInvitePayload } from "@/lib/sdp/persistInvite";
import { maskEmail, sdpDebugLog } from "@/lib/sdp/debugLog";

/**
 * SEP-10 JWT → SEP-24 interactive session. Stores SEP-24 JWT for in-app OTP (no redirect).
 */
export async function POST() {
  const ctx = await getSdpApiContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const jwt = await getSdpSep10JwtCookie();
  if (!jwt) {
    return NextResponse.json(
      { error: "SEP-10 session expired. Sign in with Stellar again." },
      { status: 401 }
    );
  }

  const { invite, stellarAccount, depositAccount, tenantName, clientDomain } = ctx;
  const sep24Account = resolveSep24RegistrationAccount({
    stellarAccount,
    depositAccount,
  });
  const { code, issuer } = parseSdpAssetParam(invite.asset);

  if (!tenantName) {
    return NextResponse.json(
      {
        error:
          "Falta el tenant del desembolso. Abrí de nuevo el enlace del correo o contactá al remitente.",
      },
      { status: 400 }
    );
  }

  const registrationEmail = invite.verifiedEmail?.trim();
  if (!registrationEmail) {
    return NextResponse.json(
      {
        error:
          "Falta el correo del beneficiario. Completá el paso anterior antes de firmar con passkey.",
      },
      { status: 400 }
    );
  }

  const extra: Record<string, string> = { email: registrationEmail };
  if (invite.token) {
    extra.token = invite.token;
  }

  const res = await postSep24DepositInteractive({
    sep24Base: invite.sep24Base,
    jwt,
    account: sep24Account,
    assetCode: code,
    assetIssuer: issuer,
    tenantName,
    lang: "es",
    extra,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }

  const session = parseSep24SessionFromInteractiveUrl(res.url);
  if (!session) {
    return NextResponse.json(
      { error: "SDP no devolvió una sesión de registro válida." },
      { status: 502 }
    );
  }

  await setSdpSep24JwtCookie(session.sep24Jwt);

  const updatedInvite = {
    ...invite,
    sep24TransactionId: session.transactionId,
  };
  await persistInvitePayload(updatedInvite);

  sdpDebugLog(
    "sep24/deposit/route.ts:session",
    "SEP-24 interactive session created",
    {
      emailMasked: maskEmail(registrationEmail),
      transactionId: session.transactionId,
      verifiedDob: invite.verifiedDateOfBirth ?? null,
      inviteExpectedDob: invite.expectedDateOfBirth ?? null,
      clientDomain,
      sep24Account,
    },
    "C"
  );

  const debug = {
    sep24Account,
    stellarAccount,
    depositAccount,
    clientDomain,
    sdpHost: invite.sdpHost,
    transactionId: session.transactionId,
    verifiedEmail: registrationEmail,
    verifiedDateOfBirth: invite.verifiedDateOfBirth ?? null,
    tenantName,
    hasInviteToken: Boolean(invite.token?.trim()),
  };

  return NextResponse.json({
    ok: true,
    transactionId: session.transactionId,
    debug,
  });
}
