import { NextResponse } from "next/server";
import { getSdpApiContext } from "@/lib/sdp/sdpApiContext";
import { getSdpSep10JwtCookie } from "@/lib/sdp/jwtCookie";
import { fetchSep24Transactions } from "@/lib/sdp/sep24Server";
import { getSdpRegistrationInfo } from "@/lib/sdp/sep24Registration";
import { requireSdpRegistrationSession } from "@/lib/sdp/requireRegistrationSession";

/**
 * GET — poll SDP registration / payout status after verification.
 */
export async function GET() {
  const session = await requireSdpRegistrationSession();
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const info = await getSdpRegistrationInfo({
    apiBase: session.apiBase,
    sep24Jwt: session.sep24Jwt,
  });

  const sep10Jwt = await getSdpSep10JwtCookie();
  let transactionStatus: string | null = null;
  const txId = session.invite.sep24TransactionId;

  if (sep10Jwt && txId) {
    const ctx = await getSdpApiContext();
    if (ctx.ok) {
      const txs = await fetchSep24Transactions({
        sep24Base: ctx.invite.sep24Base,
        jwt: sep10Jwt,
        id: txId,
      });
      if (txs.ok && txs.transactions[0]) {
        const row = txs.transactions[0] as { status?: string };
        transactionStatus =
          typeof row.status === "string" ? row.status : null;
      }
    }
  }

  const completed =
    info.ok && info.isRegistered
      ? true
      : transactionStatus === "completed";

  return NextResponse.json({
    ok: true,
    isRegistered: info.ok ? info.isRegistered : false,
    organizationName: info.ok ? info.organizationName : null,
    transactionStatus,
    completed,
    registrationCompletedAt: session.invite.registrationCompletedAt ?? null,
    debug: {
      sep24Account: session.sep24Account,
      clientDomain: session.clientDomain,
      transactionId: txId ?? null,
    },
  });
}
