import { NextResponse } from "next/server";
import { getSdpApiContext } from "@/lib/sdp/sdpApiContext";
import { requestSep10Challenge } from "@/lib/sdp/sep10Server";

export async function GET() {
  const ctx = await getSdpApiContext();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { invite, clientDomain, stellarAccount } = ctx;

  const challenge = await requestSep10Challenge({
    webAuthEndpoint: invite.webAuthEndpoint,
    account: stellarAccount,
    clientDomain,
    sdpHomeDomain: invite.sdpHost,
    sdpSigningPublicKey: invite.sdpSigningPublicKey,
  });

  if (!challenge.ok) {
    return NextResponse.json({ error: challenge.error }, { status: 502 });
  }

  return NextResponse.json({
    transaction_xdr: challenge.transactionXdr,
    network_passphrase: challenge.networkPassphrase,
    server_account_id: challenge.serverAccountId,
    web_auth_domain: challenge.webAuthDomain,
    home_domains: challenge.homeDomains,
  });
}
