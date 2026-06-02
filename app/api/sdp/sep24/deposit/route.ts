import { NextResponse } from "next/server";
import { getSdpApiContext } from "@/lib/sdp/sdpApiContext";
import { getSdpSep10JwtCookie } from "@/lib/sdp/jwtCookie";
import { parseSdpAssetParam } from "@/lib/sdp/assetParam";
import { resolveSep24RegistrationAccount } from "@/lib/sdp/resolveSep10Account";
import { postSep24DepositInteractive, augmentSdpInteractiveUrl } from "@/lib/sdp/sep24Server";

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

  const { invite, stellarAccount, depositAccount, tenantName } = ctx;
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

  const extra: Record<string, string> = {};
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
    extra: Object.keys(extra).length ? extra : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }

  return NextResponse.json({
    url: augmentSdpInteractiveUrl(res.url, {
      tenantName,
      lang: "es",
      token: invite.token,
    }),
    id: res.id ?? null,
    sep24Account,
    depositAccount,
  });
}
