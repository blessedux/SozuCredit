import { NextResponse } from "next/server";
import { getSdpApiContext } from "@/lib/sdp/sdpApiContext";
import { getSdpSep10JwtCookie } from "@/lib/sdp/jwtCookie";
import { parseSdpAssetParam } from "@/lib/sdp/assetParam";
import { postSep24DepositInteractive } from "@/lib/sdp/sep24Server";

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

  const { invite, stellarAccount } = ctx;
  const { code, issuer } = parseSdpAssetParam(invite.asset);

  const extra: Record<string, string> = {};
  if (invite.token) {
    extra.token = invite.token;
  }

  const res = await postSep24DepositInteractive({
    sep24Base: invite.sep24Base,
    jwt,
    account: stellarAccount,
    assetCode: code,
    assetIssuer: issuer,
    extra: Object.keys(extra).length ? extra : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }

  return NextResponse.json({ url: res.url, id: res.id ?? null });
}
