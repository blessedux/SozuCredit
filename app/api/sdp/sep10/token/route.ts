import { NextRequest, NextResponse } from "next/server";
import { getSdpApiContext } from "@/lib/sdp/sdpApiContext";
import { submitSep10SignedTransaction } from "@/lib/sdp/sep10Server";
import { setSdpSep10JwtCookie } from "@/lib/sdp/jwtCookie";

export async function POST(request: NextRequest) {
  const ctx = await getSdpApiContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await request.json().catch(() => ({}));
  const transactionXdr =
    typeof body.transaction_xdr === "string" ? body.transaction_xdr.trim() : "";
  const networkPassphrase =
    typeof body.network_passphrase === "string" ? body.network_passphrase.trim() : "";
  const serverAccountId =
    typeof body.server_account_id === "string" ? body.server_account_id.trim() : "";
  const webAuthDomain =
    typeof body.web_auth_domain === "string" ? body.web_auth_domain.trim() : "";
  const homeDomains = Array.isArray(body.home_domains)
    ? (body.home_domains as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  if (!transactionXdr || !networkPassphrase || !serverAccountId || !webAuthDomain || homeDomains.length === 0) {
    return NextResponse.json(
      { error: "Missing transaction_xdr, network_passphrase, server_account_id, web_auth_domain, or home_domains" },
      { status: 400 }
    );
  }

  const { invite, clientSigningSecret, stellarAccount, tenantName } = ctx;

  const tokenResult = await submitSep10SignedTransaction({
    webAuthEndpoint: invite.webAuthEndpoint,
    userSignedTransactionXdr: transactionXdr,
    networkPassphrase,
    serverAccountId,
    homeDomains,
    webAuthDomain,
    userAccountId: stellarAccount,
    clientSigningSecret,
    tenantName,
  });

  if (!tokenResult.ok) {
    return NextResponse.json({ error: tokenResult.error }, { status: 502 });
  }

  await setSdpSep10JwtCookie(tokenResult.token);

  return NextResponse.json({ ok: true });
}
